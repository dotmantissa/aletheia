"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import BidForm from "@/components/BidForm";
import CopyableText from "@/components/CopyableText";
import { useAuctionStore } from "@/hooks/useAuction";
import { useArcium } from "@/hooks/useArcium";
import { useToast } from "@/components/ToastProvider";
import { formatLamportsToSol } from "@/lib/format";

function timer(endTime: number, now: number) {
  const delta = Math.max(0, Math.floor((endTime - now) / 1000));
  const hours = Math.floor(delta / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((delta % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(delta % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export default function AuctionPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const created = searchParams.get("created");

  const { connected } = useWallet();
  const { notify } = useToast();
  const { publicKey: arciumPublicKey, loading: arciumLoading, error: arciumError } = useArcium();

  const hydrateMock = useAuctionStore((s) => s.hydrateMock);
  const auction = useAuctionStore((s) => s.byId(id));

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    hydrateMock();
  }, [hydrateMock]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (created === "1") {
      notify("The seal is formed. Configure your opening narrative and invite bidders.", "success");
    }
  }, [created, notify]);

  const computedStatus = useMemo(() => {
    if (!auction) return "UNKNOWN";
    if (auction.status === "SETTLED") return "SETTLED";
    if (auction.endTime <= now) return "CLOSED";
    return "LIVE";
  }, [auction, now]);

  if (!auction) {
    return (
      <main className="page-shell pb-12 sm:pb-16">
        <section className="surface p-8 text-center">
          <h1 className="text-4xl">The oracle is quiet.</h1>
          <p className="mt-2 text-xs text-[#6b6560]">This auction was not found in the current horizon.</p>
          <Link className="button-outline mt-4 inline-flex rounded-[4px] px-4 py-2 text-xs" href="/">
            Browse Auctions
          </Link>
        </section>
      </main>
    );
  }

  const countdown = timer(auction.endTime, now);
  const finalHour = auction.endTime - now <= 1000 * 60 * 60;
  const isLive = computedStatus === "LIVE";
  const isClosedPending = computedStatus === "CLOSED";
  const isSettled = computedStatus === "SETTLED";

  return (
    <main className="page-shell pb-12 sm:pb-16">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="surface p-6">
          <h1 className="text-4xl leading-none sm:text-5xl">{auction.tokenName}</h1>
          <CopyableText value={auction.tokenMint} className="mt-3 text-xs text-[#6b6560]" head={10} tail={8} />

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-[4px] border px-2 py-1 text-[11px] ${
                isLive
                  ? "border-[#c8892a] text-[#c8892a]"
                  : isClosedPending
                    ? "border-[#6b6560] text-[#6b6560]"
                    : "border-[#c8892a] text-[#f0ede8]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isLive ? "bg-[#c8892a]" : isClosedPending ? "bg-[#6b6560]" : "bg-[#c8892a]"
                }`}
              />
              {computedStatus}
            </span>
            <p className="font-mono text-xs text-[#6b6560]">[ {auction.bidCount} bids sealed ]</p>
          </div>

          <p
            className={`mt-8 text-center font-mono text-4xl tracking-[0.16em] sm:text-6xl sm:tracking-[0.22em] ${
              finalHour && isLive ? "text-[#c8892a]" : "text-[#f0ede8]"
            }`}
          >
            {countdown}
          </p>

          <div className="mt-8">
            <div className="h-[2px] w-full bg-[#1a3a5c]">
              <div
                className={`h-full transition-soft ${
                  isSettled
                    ? "bg-[#c8892a] w-full"
                    : isClosedPending
                      ? "bg-[#1a3a5c] w-full animate-pulse"
                      : "bg-[#1a3a5c]"
                }`}
                style={{ width: isSettled ? "100%" : isClosedPending ? "100%" : "78%" }}
              />
            </div>
            <p className="mt-2 text-xs text-[#6b6560]">Concealment → Revelation</p>
          </div>

          <p className="mt-6 text-xs text-[#6b6560]">
            All bids are encrypted via Arcium MPC. Amounts are invisible until settlement.
          </p>

          <p className="mt-4 text-xs text-[#6b6560]">
            Minimum bid floor: {formatLamportsToSol(auction.minBidFloor).toFixed(2)} SOL
          </p>

          {isClosedPending ? (
            <div
              className="mt-6 rounded-[4px] border border-[#1a3a5c] bg-[#0d1218] p-4 text-xs text-[#9fb3c8]"
              style={{ animation: "pulse-sealed 1.9s infinite" }}
            >
              The seal is closed. Arcium is computing the result.
            </div>
          ) : null}
        </section>

        <section>
          {arciumLoading ? (
            <div className="surface p-6 text-xs text-[#6b6560]">Arcium key attestation is emerging...</div>
          ) : arciumError ? (
            <div className="surface p-6 text-xs text-[#7a2a2a]">
              The hidden channel failed to open. Reattempt from a trusted network.
            </div>
          ) : (
            <BidForm arciumPublicKey={arciumPublicKey} locked={!isLive || !connected} />
          )}
        </section>
      </div>
    </main>
  );
}
