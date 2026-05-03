"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import BidForm from "@/components/BidForm";
import CountdownTimer from "@/components/CountdownTimer";
import { useAuctionStore } from "@/hooks/useAuction";
import { useArcium } from "@/hooks/useArcium";

export default function AuctionPage() {
  const { id } = useParams<{ id: string }>();
  const auction = useAuctionStore((s) => s.byId(id));
  const { publicKey, loading, error } = useArcium();

  const closed = useMemo(() => {
    if (!auction) return true;
    return auction.status !== "LIVE" || auction.endTime <= Date.now();
  }, [auction]);

  if (!auction) {
    return <main className="p-8">Auction not found.</main>;
  }

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl mb-2 font-mono">Auction {auction.id.slice(0, 10)}...</h1>
      <p className="text-sm text-[#bdb8b1] mb-6">Bids: {auction.bidCount}</p>
      <div className="mb-8"><CountdownTimer endTime={auction.endTime} /></div>
      {closed && <p className="mb-4 text-[#bdb8b1]">🔒 Auction closed. Sealed bidding ended.</p>}
      {loading && <p>Loading Arcium key...</p>}
      {error && <p className="text-red-400">{error}</p>}
      {!loading && !error && <BidForm arciumPublicKey={publicKey} disabled={closed} />}
    </main>
  );
}
