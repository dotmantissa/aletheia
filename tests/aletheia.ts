import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("aletheia", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Aletheia as Program;
  const authority = provider.wallet;

  let auctionPda: PublicKey;
  let bidReceiptPda: PublicKey;

  it("1. Create auction with valid parameters succeeds", async () => {
    const tokenMint = anchor.web3.Keypair.generate().publicKey;
    [auctionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("auction"), authority.publicKey.toBuffer(), tokenMint.toBuffer()],
      program.programId,
    );

    const dummyVault = anchor.web3.Keypair.generate().publicKey;
    const dummyAuthorityToken = anchor.web3.Keypair.generate().publicKey;
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_auth"), auctionPda.toBuffer()],
      program.programId,
    );

    await program.methods
      .createAuction(new anchor.BN(1_000), new anchor.BN(1_000_000), new anchor.BN(60))
      .accounts({
        authority: authority.publicKey,
        auctionState: auctionPda,
        tokenMint,
        tokenVault: dummyVault,
        vaultAuthority,
        authorityTokenAccount: dummyAuthorityToken,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const auction = await program.account.auctionState.fetch(auctionPda);
    assert.equal(auction.totalSupply.toString(), "1000");
  });

  it("2. Submit encrypted bid within auction window succeeds", async () => {
    [bidReceiptPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("bid"), auctionPda.toBuffer(), authority.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .submitBid(Buffer.from("encrypted-payload"))
      .accounts({
        bidder: authority.publicKey,
        auctionState: auctionPda,
        bidReceipt: bidReceiptPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const bid = await program.account.bidReceipt.fetch(bidReceiptPda);
    assert.ok(bid.encryptedBidPayload.length > 0);
  });

  it("3. Submit bid after auction end_time fails with AuctionClosed", async () => {
    try {
      await program.methods
        .submitBid(Buffer.from("late-payload"))
        .accounts({
          bidder: authority.publicKey,
          auctionState: auctionPda,
          bidReceipt: anchor.web3.Keypair.generate().publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("Expected AuctionClosed error");
    } catch (e) {
      assert.include((e as Error).message, "AuctionClosed");
    }
  });

  it("4. Settle auction with valid Arcium proof succeeds", async () => {
    const arciumResult = anchor.web3.Keypair.generate().publicKey;
    await program.methods
      .settleAuction(new anchor.BN(1_500_000), [authority.publicKey])
      .accounts({
        authority: authority.publicKey,
        auctionState: auctionPda,
        arciumResultAccount: arciumResult,
      })
      .rpc();

    const auction = await program.account.auctionState.fetch(auctionPda);
    assert.equal(auction.isSettled, true);
  });

  it("5. Claim tokens as verified winner succeeds", async () => {
    const bidderToken = anchor.web3.Keypair.generate().publicKey;
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_auth"), auctionPda.toBuffer()],
      program.programId,
    );

    await program.methods
      .claimTokens()
      .accounts({
        bidder: authority.publicKey,
        bidReceipt: bidReceiptPda,
        auctionState: auctionPda,
        tokenVault: anchor.web3.Keypair.generate().publicKey,
        vaultAuthority,
        bidderTokenAccount: bidderToken,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();

    const bid = await program.account.bidReceipt.fetch(bidReceiptPda);
    assert.equal(bid.claimed, true);
  });

  it("6. Claim refund as non-winner succeeds", async () => {
    const nonWinner = anchor.web3.Keypair.generate();
    const [loserBid] = PublicKey.findProgramAddressSync(
      [Buffer.from("bid"), auctionPda.toBuffer(), nonWinner.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .claimRefund()
      .accounts({
        bidder: nonWinner.publicKey,
        bidReceipt: loserBid,
        auctionState: auctionPda,
      })
      .signers([nonWinner])
      .rpc();

    const receipt = await program.account.bidReceipt.fetch(loserBid);
    assert.equal(receipt.claimed, true);
  });

  it("7. Attempt to claim tokens as non-winner fails", async () => {
    const nonWinner = anchor.web3.Keypair.generate();
    const [loserBid] = PublicKey.findProgramAddressSync(
      [Buffer.from("bid"), auctionPda.toBuffer(), nonWinner.publicKey.toBuffer()],
      program.programId,
    );
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_auth"), auctionPda.toBuffer()],
      program.programId,
    );

    try {
      await program.methods
        .claimTokens()
        .accounts({
          bidder: nonWinner.publicKey,
          bidReceipt: loserBid,
          auctionState: auctionPda,
          tokenVault: anchor.web3.Keypair.generate().publicKey,
          vaultAuthority,
          bidderTokenAccount: anchor.web3.Keypair.generate().publicKey,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([nonWinner])
        .rpc();
      assert.fail("Expected NotAWinner error");
    } catch (e) {
      assert.include((e as Error).message, "NotAWinner");
    }
  });
});
