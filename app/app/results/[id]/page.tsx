"use client";

import { useParams } from "next/navigation";
import ResultsReveal from "@/components/ResultsReveal";
import { useAuctionStore } from "@/hooks/useAuction";

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const auction = useAuctionStore((s) => s.byId(id));

  if (!auction || auction.status !== "SETTLED") {
    return <main className="p-8">Results are not available yet.</main>;
  }

  const clearingPriceSol = Number(auction.clearingPrice ?? 0n) / 1_000_000_000;
  const winners = auction.winnerCount ?? 0;
  const totalRaised = clearingPriceSol * Number(auction.totalSupply);

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl mb-6">Settlement Result</h1>
      <ResultsReveal
        clearingPriceSol={clearingPriceSol}
        winnerCount={winners}
        totalRaisedSol={totalRaised}
      />
      <div className="mt-6 border border-[#2a7a4e] p-3">If you won, claim tokens.</div>
      <div className="mt-3 border border-[#5a5a5a] p-3">If you did not win, claim refund.</div>
      <div className="mt-4 flex gap-3">
        <button className="px-4 py-2 bg-[#2a7a4e] text-white">Claim Tokens</button>
        <button className="px-4 py-2 bg-[#444] text-white">Claim Refund</button>
      </div>
    </main>
  );
}
