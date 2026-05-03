import Link from "next/link";
import type { Auction } from "@/hooks/useAuction";

export default function AuctionCard({ auction }: { auction: Auction }) {
  const badge = {
    LIVE: "bg-[#1a1a1a] text-[#c8892a] border-[#c8892a]",
    CLOSED: "bg-[#1a1a1a] text-[#f0ede8] border-[#5a5a5a]",
    SETTLED: "bg-[#1a1a1a] text-[#f0ede8] border-[#2a7a4e]",
  }[auction.status];

  return (
    <Link href={`/auction/${auction.id}`} className="border border-[#232323] p-4 hover:border-[#c8892a] transition">
      <div className="flex justify-between items-center">
        <h3 className="text-[#f0ede8]">{auction.tokenMint.slice(0, 8)}...</h3>
        <span className={`text-xs border px-2 py-1 ${badge}`}>{auction.status}</span>
      </div>
      <p className="mt-3 text-sm text-[#bdb8b1] font-mono">Bids: {auction.bidCount}</p>
      <p className="mt-1 text-sm text-[#bdb8b1] font-mono">Ends: {new Date(auction.endTime).toLocaleString()}</p>
    </Link>
  );
}
