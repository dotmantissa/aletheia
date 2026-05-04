"use client";

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { PROGRAM_ID, RPC_URL } from "./constants";

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const AUCTION_SEED = "auction";
const BID_SEED = "bid";
const VAULT_AUTH_SEED = "vault_auth";

type Idl = anchor.Idl;

const IDL: Idl = {
  address: PROGRAM_ID,
  metadata: {
    name: "aletheia",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "createAuction",
      discriminator: [234, 6, 201, 246, 47, 219, 176, 107],
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "auctionState", writable: true, signer: false },
        { name: "tokenMint", writable: false, signer: false },
        { name: "tokenVault", writable: true, signer: true },
        { name: "vaultAuthority", writable: false, signer: false },
        { name: "authorityTokenAccount", writable: true, signer: false },
        { name: "tokenProgram", writable: false, signer: false },
        { name: "systemProgram", writable: false, signer: false },
        { name: "rent", writable: false, signer: false },
      ],
      args: [
        { name: "totalSupply", type: "u64" },
        { name: "minBidFloor", type: "u64" },
        { name: "durationSeconds", type: "i64" },
      ],
    },
    {
      name: "submitBid",
      discriminator: [19, 164, 237, 254, 64, 139, 237, 93],
      accounts: [
        { name: "bidder", writable: true, signer: true },
        { name: "auctionState", writable: true, signer: false },
        { name: "bidReceipt", writable: true, signer: false },
        { name: "systemProgram", writable: false, signer: false },
      ],
      args: [
        { name: "encryptedBidPayload", type: { vec: "u8" } },
        { name: "collateralLamports", type: "u64" },
      ],
    },
    {
      name: "claimTokens",
      discriminator: [108, 216, 210, 231, 0, 212, 42, 64],
      accounts: [
        { name: "bidder", writable: true, signer: true },
        { name: "bidReceipt", writable: true, signer: false },
        { name: "auctionState", writable: true, signer: false },
        { name: "tokenVault", writable: true, signer: false },
        { name: "vaultAuthority", writable: false, signer: false },
        { name: "bidderTokenAccount", writable: true, signer: false },
        { name: "tokenProgram", writable: false, signer: false },
      ],
      args: [],
    },
    {
      name: "claimRefund",
      discriminator: [15, 16, 30, 161, 255, 228, 97, 60],
      accounts: [
        { name: "bidder", writable: true, signer: true },
        { name: "bidReceipt", writable: true, signer: false },
        { name: "auctionState", writable: true, signer: false },
      ],
      args: [],
    },
    {
      name: "settleAuction",
      discriminator: [246, 196, 183, 98, 222, 139, 46, 133],
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "auctionState", writable: true, signer: false },
        { name: "arciumResultAccount", writable: false, signer: false },
      ],
      args: [
        { name: "clearingPrice", type: "u64" },
        { name: "winnerList", type: { vec: "pubkey" } },
      ],
    },
  ],
  accounts: [
    {
      name: "auctionState",
      discriminator: [252, 227, 205, 147, 72, 64, 250, 126],
    },
    {
      name: "bidReceipt",
      discriminator: [186, 150, 141, 135, 59, 122, 39, 99],
    },
  ],
  types: [
    {
      name: "auctionState",
      type: {
        kind: "struct",
        fields: [
          { name: "bump", type: "u8" },
          { name: "vaultAuthorityBump", type: "u8" },
          { name: "auctionId", type: "pubkey" },
          { name: "authority", type: "pubkey" },
          { name: "tokenMint", type: "pubkey" },
          { name: "tokenVault", type: "pubkey" },
          { name: "totalSupply", type: "u64" },
          { name: "minBidFloor", type: "u64" },
          { name: "startTime", type: "i64" },
          { name: "endTime", type: "i64" },
          { name: "isSettled", type: "bool" },
          { name: "clearingPrice", type: "u64" },
          { name: "winnerCount", type: "u64" },
          { name: "bidCount", type: "u64" },
          { name: "winners", type: { vec: "pubkey" } },
        ],
      },
    },
    {
      name: "bidReceipt",
      type: {
        kind: "struct",
        fields: [
          { name: "bump", type: "u8" },
          { name: "auction", type: "pubkey" },
          { name: "bidder", type: "pubkey" },
          { name: "encryptedBidPayload", type: { vec: "u8" } },
          { name: "collateralLamports", type: "u64" },
          { name: "isWinner", type: "bool" },
          { name: "claimed", type: "bool" },
        ],
      },
    },
  ],
} as Idl;

export type AnchorWallet = anchor.Wallet;
export type AletheiaProgram = Program<Idl>;

export function getConnection() {
  return new Connection(RPC_URL, "confirmed");
}

export function getProvider(wallet: anchor.Wallet) {
  return new anchor.AnchorProvider(getConnection(), wallet, { commitment: "confirmed" });
}

export function getProgram(wallet: anchor.Wallet): Program {
  const provider = getProvider(wallet);
  return new Program(IDL, provider);
}

export function toAnchorWallet(wallet: any): AnchorWallet {
  if (!wallet?.publicKey || !wallet?.signTransaction || !wallet?.signAllTransactions) {
    throw new Error("Wallet does not support signing");
  }
  return wallet as AnchorWallet;
}

export function parseProgramId(): PublicKey {
  return new PublicKey(PROGRAM_ID);
}

export function deriveAuctionPda(authority: PublicKey, tokenMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(AUCTION_SEED), authority.toBuffer(), tokenMint.toBuffer()],
    parseProgramId(),
  );
}

export function deriveBidReceiptPda(auction: PublicKey, bidder: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BID_SEED), auction.toBuffer(), bidder.toBuffer()],
    parseProgramId(),
  );
}

export function deriveVaultAuthorityPda(auction: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_AUTH_SEED), auction.toBuffer()],
    parseProgramId(),
  );
}

export function deriveAtaAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

export function createAtaInstruction(payer: PublicKey, owner: PublicKey, mint: PublicKey): TransactionInstruction {
  const ata = deriveAtaAddress(owner, mint);
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.alloc(0),
  });
}

export async function createAuctionTx(params: {
  wallet: AnchorWallet;
  tokenMint: PublicKey;
  authorityTokenAccount: PublicKey;
  totalSupply: bigint;
  minBidFloorLamports: bigint;
  durationSeconds: number;
}): Promise<{ signature: string; auction: PublicKey }> {
  const program = getProgram(params.wallet) as AletheiaProgram;
  const authority = params.wallet.publicKey;
  const [auction] = deriveAuctionPda(authority, params.tokenMint);
  const [vaultAuthority] = deriveVaultAuthorityPda(auction);
  const tokenVault = Keypair.generate();

  const builder = program.methods
    .createAuction(
      new anchor.BN(params.totalSupply.toString()),
      new anchor.BN(params.minBidFloorLamports.toString()),
      new anchor.BN(params.durationSeconds),
    )
    .accounts({
      authority,
      auctionState: auction,
      tokenMint: params.tokenMint,
      tokenVault: tokenVault.publicKey,
      vaultAuthority,
      authorityTokenAccount: params.authorityTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([tokenVault]);

  if (process.env.NODE_ENV === "development") {
    const tx = await builder.transaction();
    tx.feePayer = authority;
    const latest = await program.provider.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = latest.blockhash;
    tx.partialSign(tokenVault);
    const signed = await params.wallet.signTransaction(tx);
    const simulation = await program.provider.connection.simulateTransaction(signed);
    // Keep these logs in dev only for exact on-chain failure visibility.
    console.log("Simulation logs:", simulation.value.logs);
    if (simulation.value.err) {
      console.error("Simulation error:", simulation.value.err);
      throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
    }
  }

  let signature: string;
  try {
    signature = await builder.rpc();
  } catch (err: any) {
    const message = err?.message ?? "create_auction rpc failed";
    const logs = err?.logs ?? err?.error?.logs ?? [];
    // Keep full diagnostics visible in browser/devtools for production debugging.
    console.error("create_auction failed:", {
      message,
      logs,
      err,
    });
    throw new Error(`${message}${Array.isArray(logs) && logs.length ? ` | logs: ${logs.join(" || ")}` : ""}`);
  }

  return { signature, auction };
}

export async function submitBidTx(params: {
  wallet: AnchorWallet;
  auction: PublicKey;
  encryptedBidPayload: Uint8Array;
  collateralLamports: bigint;
}): Promise<{ signature: string; bidReceipt: PublicKey }> {
  const program = getProgram(params.wallet) as AletheiaProgram;
  const bidder = params.wallet.publicKey;
  const [bidReceipt] = deriveBidReceiptPda(params.auction, bidder);

  const signature = await program.methods
    .submitBid(
      Array.from(params.encryptedBidPayload),
      new anchor.BN(params.collateralLamports.toString()),
    )
    .accounts({
      bidder,
      auctionState: params.auction,
      bidReceipt,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { signature, bidReceipt };
}

export async function claimRefundTx(params: { wallet: AnchorWallet; auction: PublicKey }): Promise<string> {
  const program = getProgram(params.wallet) as AletheiaProgram;
  const bidder = params.wallet.publicKey;
  const [bidReceipt] = deriveBidReceiptPda(params.auction, bidder);

  return program.methods
    .claimRefund()
    .accounts({
      bidder,
      bidReceipt,
      auctionState: params.auction,
    })
    .rpc();
}

export async function claimTokensTx(params: { wallet: AnchorWallet; auction: PublicKey }): Promise<string> {
  const program = getProgram(params.wallet) as any;
  const bidder = params.wallet.publicKey;
  const [bidReceipt] = deriveBidReceiptPda(params.auction, bidder);
  const auctionState = await program.account.auctionState.fetch(params.auction);
  const [vaultAuthority] = deriveVaultAuthorityPda(params.auction);
  const bidderTokenAccount = deriveAtaAddress(bidder, auctionState.tokenMint as PublicKey);

  const accountInfo = await program.provider.connection.getAccountInfo(bidderTokenAccount);
  if (!accountInfo) {
    const createIx = createAtaInstruction(bidder, bidder, auctionState.tokenMint as PublicKey);
    const tx = new anchor.web3.Transaction().add(createIx);
    await program.provider.sendAndConfirm(tx, []);
  }

  return program.methods
    .claimTokens()
    .accounts({
      bidder,
      bidReceipt,
      auctionState: params.auction,
      tokenVault: auctionState.tokenVault as PublicKey,
      vaultAuthority,
      bidderTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export async function fetchBidReceiptsForAuction(params: {
  wallet: AnchorWallet;
  auction: PublicKey;
}): Promise<Array<{ bidder: PublicKey; encryptedBidPayload: Uint8Array }>> {
  const program = getProgram(params.wallet) as any;
  const receipts = await program.account.bidReceipt.all([
    {
      memcmp: {
        offset: 8,
        bytes: params.auction.toBase58(),
      },
    },
  ]);
  return receipts.map((r: any) => ({
    bidder: r.account.bidder as PublicKey,
    encryptedBidPayload: new Uint8Array(r.account.encryptedBidPayload as number[]),
  }));
}

export async function settleAuctionTx(params: {
  wallet: AnchorWallet;
  auction: PublicKey;
  clearingPrice: bigint;
  winners: PublicKey[];
  arciumResultAccount: PublicKey;
}): Promise<string> {
  const program = getProgram(params.wallet) as any;
  return program.methods
    .settleAuction(
      new anchor.BN(params.clearingPrice.toString()),
      params.winners,
    )
    .accounts({
      authority: params.wallet.publicKey,
      auctionState: params.auction,
      arciumResultAccount: params.arciumResultAccount,
    })
    .rpc();
}
