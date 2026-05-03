use borsh::{BorshDeserialize, BorshSerialize};
use sha2::{Digest, Sha256};
use solana_program::pubkey::Pubkey;

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct EncryptedBidInput {
    pub bidder: Pubkey,
    pub ciphertext: Vec<u8>,
    pub nonce: [u8; 12],
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct PlainBid {
    pub bidder: Pubkey,
    pub price_lamports: u64,
    pub quantity: u64,
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct AuctionParams {
    pub auction: Pubkey,
    pub total_supply: u64,
    pub min_bid_floor: u64,
}

#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct SettlementOutput {
    pub auction: Pubkey,
    pub clearing_price: u64,
    pub winner_pubkeys: Vec<Pubkey>,
    pub proof: Vec<u8>,
}

pub trait ArciumMpcRuntime {
    fn decrypt_bid(&self, encrypted: &EncryptedBidInput) -> Result<PlainBid, String>;
    fn sign_attestation(&self, message: &[u8]) -> Result<Vec<u8>, String>;
}

pub fn compute_settlement<R: ArciumMpcRuntime>(
    runtime: &R,
    params: &AuctionParams,
    encrypted_bids: &[EncryptedBidInput],
) -> Result<SettlementOutput, String> {
    if params.total_supply == 0 {
        return Err("total_supply must be > 0".into());
    }

    let mut bids: Vec<PlainBid> = encrypted_bids
        .iter()
        .map(|b| runtime.decrypt_bid(b))
        .collect::<Result<Vec<_>, _>>()?;

    bids.retain(|b| b.quantity > 0 && b.price_lamports >= params.min_bid_floor);
    if bids.is_empty() {
        return Err("no valid bids".into());
    }

    bids.sort_by(|a, b| {
        b.price_lamports
            .cmp(&a.price_lamports)
            .then_with(|| b.quantity.cmp(&a.quantity))
    });

    let mut filled: u64 = 0;
    let mut clearing_price = params.min_bid_floor;
    let mut winners: Vec<Pubkey> = Vec::new();

    for bid in &bids {
        if filled >= params.total_supply {
            break;
        }
        let remaining = params.total_supply.saturating_sub(filled);
        let take = remaining.min(bid.quantity);
        if take > 0 {
            filled = filled.saturating_add(take);
            clearing_price = bid.price_lamports;
            winners.push(bid.bidder);
        }
    }

    if filled < params.total_supply {
        return Err("insufficient demand to clear full supply".into());
    }

    winners.sort();
    winners.dedup();

    let mut preimage = Vec::new();
    preimage.extend_from_slice(params.auction.as_ref());
    preimage.extend_from_slice(&clearing_price.to_le_bytes());
    preimage.extend_from_slice(&(winners.len() as u64).to_le_bytes());
    for winner in &winners {
        preimage.extend_from_slice(winner.as_ref());
    }

    let digest = Sha256::digest(&preimage);
    let proof = runtime.sign_attestation(&digest)?;

    Ok(SettlementOutput {
        auction: params.auction,
        clearing_price,
        winner_pubkeys: winners,
        proof,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockRuntime;

    impl ArciumMpcRuntime for MockRuntime {
        fn decrypt_bid(&self, encrypted: &EncryptedBidInput) -> Result<PlainBid, String> {
            PlainBid::try_from_slice(&encrypted.ciphertext).map_err(|e| e.to_string())
        }

        fn sign_attestation(&self, message: &[u8]) -> Result<Vec<u8>, String> {
            let mut sig = b"mock-proof:".to_vec();
            sig.extend_from_slice(message);
            Ok(sig)
        }
    }

    #[test]
    fn computes_uniform_clearing_price() {
        let runtime = MockRuntime;
        let params = AuctionParams {
            auction: Pubkey::new_unique(),
            total_supply: 100,
            min_bid_floor: 1_000_000,
        };

        let bid1 = PlainBid { bidder: Pubkey::new_unique(), price_lamports: 2_000_000, quantity: 60 };
        let bid2 = PlainBid { bidder: Pubkey::new_unique(), price_lamports: 1_500_000, quantity: 50 };

        let inputs = vec![
            EncryptedBidInput { bidder: bid1.bidder, ciphertext: bid1.try_to_vec().unwrap(), nonce: [0u8; 12] },
            EncryptedBidInput { bidder: bid2.bidder, ciphertext: bid2.try_to_vec().unwrap(), nonce: [1u8; 12] },
        ];

        let result = compute_settlement(&runtime, &params, &inputs).unwrap();
        assert_eq!(result.clearing_price, 1_500_000);
        assert_eq!(result.winner_pubkeys.len(), 2);
        assert!(!result.proof.is_empty());
    }
}
