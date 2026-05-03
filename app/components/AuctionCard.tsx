"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Auction } from "@/hooks/useAuction";
import { formatLamportsToSol, truncateAddress } from "@/lib/format";

function countdownLabel(endTime: number, now: number) {
  const diff = Math.max(0, Math.floor((endTime - now) / 1000));
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export default function AuctionCard({ auction }: { auction: Auction }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const badge = useMemo(() => {
    if (auction.status === "LIVE") return { label: "LIVE", dot: "bg-[#c8892a]", text: "text-[#c8892a]" };
    if (auction.status === "CLOSED") return { label: "CLOSED", dot: "bg-[#6b6560]", text: "text-[#6b6560]" };
    return { label: "SETTLED", dot: "bg-[#c8892a]", text: "text-[#f0ede8]" };
  }, [auction.status]);

  const time = countdownLabel(auction.endTime, now);

  return (
    <article className="surface group transition-soft hover:border-[#2e2e2e] hover:shadow-[0_18px_32px_-20px_rgba(0,0,0,0.8)]">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-3xl leading-none">{auction.tokenName}</h3>
            <p className="mt-2 text-xs text-[#6b6560] font-mono">{truncateAddress(auction.tokenMint, 8, 6)}</p>
          </div>
          <span className={`inline-flex items-center gap-2 text-[11px] font-mono ${badge.text}`}>
            <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        </div>

        <p className="mt-5 text-xs text-[#6b6560] font-mono">[ {auction.bidCount} bids sealed ]</p>
        <p className="mt-2 text-2xl font-mono tracking-widest">{time}</p>
        <p className="mt-2 text-xs text-[#6b6560]">Min bid: {formatLamportsToSol(auction.minBidFloor).toFixed(2)} SOL</p>

        <Link
          href={`/auction/${auction.id}`}
          className="mt-5 inline-flex items-center text-xs text-[#f0ede8] transition-soft group-hover:text-[#c8892a]"
        >
          View Auction →
        </Link>
      </div>
    </article>
  );
}
