use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("ALETHX1A1111111111111111111111111111111111");

const AUCTION_SEED: &[u8] = b"auction";
const VAULT_AUTH_SEED: &[u8] = b"vault_auth";
const BID_SEED: &[u8] = b"bid";

// Replace with Arcium verifier program on deployment.
const ARCIUM_VERIFIER_PROGRAM: Pubkey = pubkey!("Arc1umV3r1f13r111111111111111111111111111");

#[program]
pub mod aletheia {
    use super::*;

    pub fn create_auction(
        ctx: Context<CreateAuction>,
        total_supply: u64,
        min_bid_floor: u64,
        duration_seconds: i64,
    ) -> Result<()> {
        require!(total_supply > 0, AuctionError::InvalidTotalSupply);
        require!(min_bid_floor > 0, AuctionError::InvalidMinBidFloor);
        require!(duration_seconds > 0, AuctionError::InvalidDuration);

        let now = Clock::get()?.unix_timestamp;
        let end_time = now
            .checked_add(duration_seconds)
            .ok_or(AuctionError::MathOverflow)?;

        let auction = &mut ctx.accounts.auction_state;
        auction.bump = ctx.bumps.auction_state;
        auction.vault_authority_bump = ctx.bumps.vault_authority;
        auction.authority = ctx.accounts.authority.key();
        auction.auction_id = auction.key();
        auction.token_mint = ctx.accounts.token_mint.key();
        auction.token_vault = ctx.accounts.token_vault.key();
        auction.total_supply = total_supply;
        auction.min_bid_floor = min_bid_floor;
        auction.start_time = now;
        auction.end_time = end_time;
        auction.is_settled = false;
        auction.clearing_price = 0;
        auction.winner_count = 0;
        auction.bid_count = 0;
        auction.winners = Vec::new();

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.authority_token_account.to_account_info(),
                to: ctx.accounts.token_vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, total_supply)?;

        emit!(AuctionCreated {
            auction_id: auction.auction_id,
            authority: auction.authority,
            token_mint: auction.token_mint,
            total_supply,
            min_bid_floor,
            start_time: now,
            end_time,
        });

        Ok(())
    }

    pub fn submit_bid(ctx: Context<SubmitBid>, encrypted_bid_payload: Vec<u8>) -> Result<()> {
        require!(encrypted_bid_payload.len() <= 1024, AuctionError::BidPayloadTooLarge);

        let now = Clock::get()?.unix_timestamp;
        let auction = &mut ctx.accounts.auction_state;
        require!(now < auction.end_time, AuctionError::AuctionClosed);
        require!(!auction.is_settled, AuctionError::AuctionAlreadySettled);

        let collateral = auction
            .min_bid_floor
            .checked_mul(auction.total_supply)
            .ok_or(AuctionError::MathOverflow)?;

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.bidder.key(),
                &auction.key(),
                collateral,
            ),
            &[
                ctx.accounts.bidder.to_account_info(),
                auction.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let bid_receipt = &mut ctx.accounts.bid_receipt;
        bid_receipt.bump = ctx.bumps.bid_receipt;
        bid_receipt.auction = auction.key();
        bid_receipt.bidder = ctx.accounts.bidder.key();
        bid_receipt.encrypted_bid_payload = encrypted_bid_payload;
        bid_receipt.collateral_lamports = collateral;
        bid_receipt.is_winner = false;
        bid_receipt.claimed = false;

        auction.bid_count = auction
            .bid_count
            .checked_add(1)
            .ok_or(AuctionError::MathOverflow)?;

        emit!(BidSubmitted {
            auction_id: auction.key(),
            bidder: ctx.accounts.bidder.key(),
            bid_receipt: bid_receipt.key(),
            collateral_lamports: collateral,
        });

        Ok(())
    }

    pub fn settle_auction(
        ctx: Context<SettleAuction>,
        clearing_price: u64,
        winner_list: Vec<Pubkey>,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let auction = &mut ctx.accounts.auction_state;

        require!(ctx.accounts.authority.key() == auction.authority, AuctionError::Unauthorized);
        require!(now >= auction.end_time, AuctionError::AuctionStillOpen);
        require!(!auction.is_settled, AuctionError::AuctionAlreadySettled);
        require!(clearing_price >= auction.min_bid_floor, AuctionError::InvalidClearingPrice);

        let arcium_result = &ctx.accounts.arcium_result_account;
        require!(arcium_result.owner == &ARCIUM_VERIFIER_PROGRAM, AuctionError::InvalidArciumVerifier);

        let mut data: &[u8] = &arcium_result.data.borrow();
        let parsed = ArciumResult::try_deserialize(&mut data)
            .map_err(|_| AuctionError::InvalidArciumResultData)?;

        require!(parsed.verified, AuctionError::InvalidArciumProof);
        require!(parsed.auction == auction.key(), AuctionError::ArciumAuctionMismatch);
        require!(parsed.clearing_price == clearing_price, AuctionError::ArciumClearingPriceMismatch);
        require!(parsed.winners == winner_list, AuctionError::ArciumWinnerListMismatch);

        let winner_count = winner_list.len() as u64;
        require!(winner_count > 0, AuctionError::NoWinners);

        auction.clearing_price = clearing_price;
        auction.winner_count = winner_count;
        auction.winners = winner_list.clone();
        auction.is_settled = true;

        emit!(AuctionSettled {
            auction_id: auction.key(),
            clearing_price,
            winner_count,
        });

        Ok(())
    }

    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        let auction = &ctx.accounts.auction_state;
        let bid = &mut ctx.accounts.bid_receipt;

        require!(auction.is_settled, AuctionError::AuctionNotSettled);
        require!(bid.auction == auction.key(), AuctionError::BidAuctionMismatch);
        require!(bid.bidder == ctx.accounts.bidder.key(), AuctionError::Unauthorized);
        require!(!bid.claimed, AuctionError::AlreadyClaimed);

        let is_winner = auction.winners.contains(&ctx.accounts.bidder.key());
        require!(is_winner, AuctionError::NotAWinner);

        let allocation = auction
            .total_supply
            .checked_div(auction.winner_count)
            .ok_or(AuctionError::MathOverflow)?;
        require!(allocation > 0, AuctionError::ZeroAllocation);

        let cost = auction
            .clearing_price
            .checked_mul(allocation)
            .ok_or(AuctionError::MathOverflow)?;
        require!(bid.collateral_lamports >= cost, AuctionError::InsufficientCollateral);

        let refund = bid
            .collateral_lamports
            .checked_sub(cost)
            .ok_or(AuctionError::MathOverflow)?;

        let signer_seeds: &[&[u8]] = &[
            VAULT_AUTH_SEED,
            auction.key().as_ref(),
            &[auction.vault_authority_bump],
        ];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_vault.to_account_info(),
                to: ctx.accounts.bidder_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            &[signer_seeds],
        );
        token::transfer(cpi_ctx, allocation)?;

        **ctx.accounts.auction_state.to_account_info().try_borrow_mut_lamports()? -= refund;
        **ctx.accounts.bidder.to_account_info().try_borrow_mut_lamports()? += refund;

        bid.is_winner = true;
        bid.claimed = true;

        emit!(TokensClaimed {
            auction_id: auction.key(),
            bidder: ctx.accounts.bidder.key(),
            allocation,
            refund_lamports: refund,
        });

        Ok(())
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let auction = &ctx.accounts.auction_state;
        let bid = &mut ctx.accounts.bid_receipt;

        require!(auction.is_settled, AuctionError::AuctionNotSettled);
        require!(bid.auction == auction.key(), AuctionError::BidAuctionMismatch);
        require!(bid.bidder == ctx.accounts.bidder.key(), AuctionError::Unauthorized);
        require!(!bid.claimed, AuctionError::AlreadyClaimed);

        let is_winner = auction.winners.contains(&ctx.accounts.bidder.key());
        require!(!is_winner, AuctionError::WinnerCannotClaimRefund);

        let refund = bid.collateral_lamports;
        **ctx.accounts.auction_state.to_account_info().try_borrow_mut_lamports()? -= refund;
        **ctx.accounts.bidder.to_account_info().try_borrow_mut_lamports()? += refund;

        bid.claimed = true;

        emit!(RefundClaimed {
            auction_id: auction.key(),
            bidder: ctx.accounts.bidder.key(),
            refund_lamports: refund,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(total_supply: u64, min_bid_floor: u64, duration_seconds: i64)]
pub struct CreateAuction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        seeds = [AUCTION_SEED, authority.key().as_ref(), token_mint.key().as_ref()],
        bump,
        space = 8 + AuctionState::MAX_SIZE
    )]
    pub auction_state: Account<'info, AuctionState>,
    pub token_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        token::mint = token_mint,
        token::authority = vault_authority,
    )]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [VAULT_AUTH_SEED, auction_state.key().as_ref()],
        bump
    )]
    /// CHECK: PDA authority for vault signing.
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = authority_token_account.mint == token_mint.key() @ AuctionError::InvalidAuthorityTokenAccount,
        constraint = authority_token_account.owner == authority.key() @ AuctionError::InvalidAuthorityTokenAccount,
    )]
    pub authority_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SubmitBid<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,
    #[account(mut)]
    pub auction_state: Account<'info, AuctionState>,
    #[account(
        init,
        payer = bidder,
        seeds = [BID_SEED, auction_state.key().as_ref(), bidder.key().as_ref()],
        bump,
        space = 8 + BidReceipt::MAX_SIZE
    )]
    pub bid_receipt: Account<'info, BidReceipt>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleAuction<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub auction_state: Account<'info, AuctionState>,
    /// CHECK: Verified by owner and deserialized bytes.
    pub arcium_result_account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,
    #[account(
        mut,
        seeds = [BID_SEED, auction_state.key().as_ref(), bidder.key().as_ref()],
        bump = bid_receipt.bump,
    )]
    pub bid_receipt: Account<'info, BidReceipt>,
    #[account(mut)]
    pub auction_state: Account<'info, AuctionState>,
    #[account(mut, address = auction_state.token_vault)]
    pub token_vault: Account<'info, TokenAccount>,
    #[account(
        seeds = [VAULT_AUTH_SEED, auction_state.key().as_ref()],
        bump = auction_state.vault_authority_bump
    )]
    /// CHECK: PDA authority for vault signing.
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = bidder_token_account.owner == bidder.key() @ AuctionError::InvalidBidderTokenAccount,
        constraint = bidder_token_account.mint == auction_state.token_mint @ AuctionError::InvalidBidderTokenAccount,
    )]
    pub bidder_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,
    #[account(
        mut,
        seeds = [BID_SEED, auction_state.key().as_ref(), bidder.key().as_ref()],
        bump = bid_receipt.bump,
    )]
    pub bid_receipt: Account<'info, BidReceipt>,
    #[account(mut)]
    pub auction_state: Account<'info, AuctionState>,
}

#[account]
pub struct AuctionState {
    pub bump: u8,
    pub vault_authority_bump: u8,
    pub auction_id: Pubkey,
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub token_vault: Pubkey,
    pub total_supply: u64,
    pub min_bid_floor: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub is_settled: bool,
    pub clearing_price: u64,
    pub winner_count: u64,
    pub bid_count: u64,
    pub winners: Vec<Pubkey>,
}

impl AuctionState {
    pub const MAX_WINNERS: usize = 2048;
    pub const MAX_SIZE: usize =
        1 + 1 + // bumps
        32 * 4 + // pubkeys
        8 * 6 + // ints
        1 + // bool
        4 + (32 * Self::MAX_WINNERS); // vec winners
}

#[account]
pub struct BidReceipt {
    pub bump: u8,
    pub auction: Pubkey,
    pub bidder: Pubkey,
    pub encrypted_bid_payload: Vec<u8>,
    pub collateral_lamports: u64,
    pub is_winner: bool,
    pub claimed: bool,
}

impl BidReceipt {
    pub const MAX_PAYLOAD: usize = 1024;
    pub const MAX_SIZE: usize =
        1 + 32 + 32 + 4 + Self::MAX_PAYLOAD + 8 + 1 + 1;
}

#[account]
pub struct ArciumResult {
    pub auction: Pubkey,
    pub clearing_price: u64,
    pub winners: Vec<Pubkey>,
    pub verified: bool,
}

#[event]
pub struct AuctionCreated {
    pub auction_id: Pubkey,
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub total_supply: u64,
    pub min_bid_floor: u64,
    pub start_time: i64,
    pub end_time: i64,
}

#[event]
pub struct BidSubmitted {
    pub auction_id: Pubkey,
    pub bidder: Pubkey,
    pub bid_receipt: Pubkey,
    pub collateral_lamports: u64,
}

#[event]
pub struct AuctionSettled {
    pub auction_id: Pubkey,
    pub clearing_price: u64,
    pub winner_count: u64,
}

#[event]
pub struct TokensClaimed {
    pub auction_id: Pubkey,
    pub bidder: Pubkey,
    pub allocation: u64,
    pub refund_lamports: u64,
}

#[event]
pub struct RefundClaimed {
    pub auction_id: Pubkey,
    pub bidder: Pubkey,
    pub refund_lamports: u64,
}

#[error_code]
pub enum AuctionError {
    #[msg("Invalid total supply")]
    InvalidTotalSupply,
    #[msg("Invalid minimum bid floor")]
    InvalidMinBidFloor,
    #[msg("Invalid auction duration")]
    InvalidDuration,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Auction is closed")]
    AuctionClosed,
    #[msg("Auction is still open")]
    AuctionStillOpen,
    #[msg("Auction already settled")]
    AuctionAlreadySettled,
    #[msg("Auction not settled")]
    AuctionNotSettled,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Bid payload exceeds max size")]
    BidPayloadTooLarge,
    #[msg("Invalid clearing price")]
    InvalidClearingPrice,
    #[msg("Arcium verifier owner mismatch")]
    InvalidArciumVerifier,
    #[msg("Failed to deserialize Arcium result")]
    InvalidArciumResultData,
    #[msg("Invalid Arcium proof")]
    InvalidArciumProof,
    #[msg("Arcium result auction mismatch")]
    ArciumAuctionMismatch,
    #[msg("Arcium clearing price mismatch")]
    ArciumClearingPriceMismatch,
    #[msg("Arcium winner list mismatch")]
    ArciumWinnerListMismatch,
    #[msg("No winners in settlement")]
    NoWinners,
    #[msg("Bid receipt belongs to different auction")]
    BidAuctionMismatch,
    #[msg("Bid has already been claimed")]
    AlreadyClaimed,
    #[msg("Bidder is not a winner")]
    NotAWinner,
    #[msg("Winner cannot claim refund")]
    WinnerCannotClaimRefund,
    #[msg("Insufficient collateral for clearing cost")]
    InsufficientCollateral,
    #[msg("Calculated allocation is zero")]
    ZeroAllocation,
    #[msg("Invalid authority token account")]
    InvalidAuthorityTokenAccount,
    #[msg("Invalid bidder token account")]
    InvalidBidderTokenAccount,
}
