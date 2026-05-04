"use client";

import { useState } from "react";
import { payloadHash } from "@/lib/encryption";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { submitBidTx, toAnchorWallet } from "@/lib/anchor";

export function useBid() {
  const wallet = useWallet();
  const [submitting, setSubmitting] = useState(false);
  const [receiptHash, setReceiptHash] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function submitEncryptedBid(
    auctionId: string,
    encryptedPayload: Uint8Array,
    collateralLamports: bigint,
  ): Promise<string> {
    try {
      setSubmitting(true);
      setError("");
      if (!wallet.connected) {
        throw new Error("Connect wallet to participate");
      }
      await submitBidTx({
        wallet: toAnchorWallet(wallet),
        auction: new PublicKey(auctionId),
        encryptedBidPayload: encryptedPayload,
        collateralLamports,
      });
      const hash = await payloadHash(encryptedPayload);
      setReceiptHash(hash);
      return hash;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit bid";
      setError(msg);
      throw e;
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, receiptHash, error, submitEncryptedBid };
}
