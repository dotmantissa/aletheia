"use client";

import { FormEvent, useState } from "react";
import { encryptBid } from "../../arcium/encryption";
import { useBid } from "@/hooks/useBid";

export default function BidForm({ arciumPublicKey, disabled }: { arciumPublicKey: string; disabled?: boolean }) {
  const [amount, setAmount] = useState("0");
  const [quantity, setQuantity] = useState("0");
  const { submitting, receiptHash, error, submitEncryptedBid } = useBid();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const encrypted = encryptBid(Number(amount), Number(quantity), arciumPublicKey);
    await submitEncryptedBid(encrypted);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border border-[#232323] p-4">
      <div>
        <label className="block text-sm mb-1">Amount (SOL per token)</label>
        <input className="w-full bg-[#0f0f0f] border border-[#2a2a2a] p-2 font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={disabled || submitting} />
      </div>
      <div>
        <label className="block text-sm mb-1">Quantity</label>
        <input className="w-full bg-[#0f0f0f] border border-[#2a2a2a] p-2 font-mono" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={disabled || submitting} />
      </div>
      <button disabled={disabled || submitting} className="px-4 py-2 bg-[#c8892a] text-black disabled:opacity-40">
        {disabled ? "Auction Closed" : submitting ? "Sealing..." : "Submit Sealed Bid"}
      </button>
      <p className="text-sm text-[#bdb8b1]">Your bid is sealed. No one can see it - including us.</p>
      {receiptHash && <p className="text-xs font-mono text-[#c8892a] break-all">Receipt Hash: {receiptHash}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
