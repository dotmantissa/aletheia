"use client";

import { FormEvent, useState } from "react";
import { PublicKey } from "@solana/web3.js";

export default function CreateAuctionPage() {
  const [tokenMint, setTokenMint] = useState("");
  const [totalSupply, setTotalSupply] = useState("");
  const [minBidFloor, setMinBidFloor] = useState("");
  const [duration, setDuration] = useState("3600");
  const [tx, setTx] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      new PublicKey(tokenMint);
      if (Number(totalSupply) <= 0) throw new Error("Total supply must be positive");
      if (Number(minBidFloor) <= 0) throw new Error("Min bid floor must be positive");
      if (Number(duration) <= 0) throw new Error("Duration must be positive");
      setError("");
      setTx(`auction-${Date.now().toString(36)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create auction");
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-xl mx-auto">
      <h1 className="text-2xl mb-6">Create Auction</h1>
      <form onSubmit={onSubmit} className="space-y-3 border border-[#232323] p-4">
        <input placeholder="Token mint address" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] p-2 font-mono" value={tokenMint} onChange={(e) => setTokenMint(e.target.value)} />
        <input placeholder="Total supply" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] p-2 font-mono" value={totalSupply} onChange={(e) => setTotalSupply(e.target.value)} />
        <input placeholder="Min bid floor (SOL)" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] p-2 font-mono" value={minBidFloor} onChange={(e) => setMinBidFloor(e.target.value)} />
        <input placeholder="Duration seconds" className="w-full bg-[#0f0f0f] border border-[#2a2a2a] p-2 font-mono" value={duration} onChange={(e) => setDuration(e.target.value)} />
        <button className="px-4 py-2 bg-[#c8892a] text-black">Create</button>
      </form>
      {tx && <p className="mt-4 font-mono text-sm">Transaction confirmed. Auction ID: {tx}</p>}
      {error && <p className="mt-4 text-red-400">{error}</p>}
    </main>
  );
}
