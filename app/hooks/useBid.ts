"use client";

import { useState } from "react";
import { payloadHash } from "../../arcium/encryption";

export function useBid() {
  const [submitting, setSubmitting] = useState(false);
  const [receiptHash, setReceiptHash] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function submitEncryptedBid(encryptedPayload: Uint8Array): Promise<string> {
    try {
      setSubmitting(true);
      setError("");
      const hash = payloadHash(encryptedPayload);
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
