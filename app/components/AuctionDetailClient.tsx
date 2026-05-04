"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import BidForm from "@/components/BidForm";
import CopyableText from "@/components/CopyableText";
import { useAuctionStore } from "@/hooks/useAuction";
import { useArcium } from "@/hooks/useArcium";
import { useToast } from "@/components/ToastProvider";
import { fetchBidReceiptsForAuction, settleAuctionTx, toAnchorWallet } from "@/lib/anchor";
import { getArciumClient, initArcium, submitComputation } from "@/lib/arcium";
import { formatLamportsToSol } from "@/lib/format";

function timer(endTime: number, now: number) {
  const delta = Math.max(0, Math.floor((endTime - now) / 1000));
  const hours = Math.floor(delta / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((delta % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(delta % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export default function AuctionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const created = searchParams.get("created");
  const [mounted, setMounted] = useState(false);

  const wallet = useWallet();
  const { connected, publicKey } = wallet;
  const { notify } = useToast();
  const { publicKey: arciumPublicKey, ready: arciumReady, loading: arciumLoading } = useArcium();

  const hydrateFromChain = useAuctionStore((s) => s.hydrateFromChain);
  const auction = useAuctionStore((s) => s.byId(id));

  const [now, setNow] = useState(Date.now());
  const [settlementState, setSettlementState] = useState<
    "idle" | "loading" | "computing" | "finalizing" | "failed" | "success"
  >("idle");
  const [settlementError, setSettlementError] = useState("");
  const [settlementBids, setSettlementBids] = useState<Array<{ bidder: string; payload: Uint8Array }>>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    hydrateFromChain();
  }, [hydrateFromChain]);

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

  if (!mounted) {
    return (
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <p className="font-mono text-sm text-[#6b6560]">Initializing...</p>
      </main>
    );
  }

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
  const isAuthority = connected && publicKey?.toBase58() === auction.authority;
  const showSettlePanel = Boolean(isAuthority && isClosedPending && !auction.isSettled);
  const showPendingMessage = Boolean(!isAuthority && isClosedPending && !auction.isSettled);
  const showResults = auction.isSettled;

  async function handleSettleAuction() {
    setSettlementError("");
    setSettlementState("loading");
    try {
      if (!wallet.publicKey) throw new Error("Connect wallet to continue");
      if (!auction) throw new Error("Auction not found");
      const auctionPubkey = new PublicKey(auction.id);
      const receipts = await fetchBidReceiptsForAuction({
        wallet: toAnchorWallet(wallet),
        auction: auctionPubkey,
      });
      setSettlementBids(
        receipts.map((r) => ({ bidder: r.bidder.toBase58(), payload: r.encryptedBidPayload })),
      );
      if (receipts.length === 0) {
        setSettlementState("failed");
        setSettlementError("No bids were placed. This auction cannot be settled.");
        return;
      }

      const arciumOk = await initArcium();
      if (!arciumOk) {
        throw new Error("Arcium computation failed. The encrypted bids remain sealed. Retry when the network is available.");
      }
      const client = await getArciumClient();
      if (!client) {
        throw new Error("Arcium computation failed. The encrypted bids remain sealed. Retry when the network is available.");
      }

      setSettlementState("computing");
      const bidInputs = settlementBids.length > 0
        ? settlementBids.map((b) => ({ bidder: b.bidder, encryptedPayload: b.payload }))
        : receipts.map((r) => ({ bidder: r.bidder.toBase58(), encryptedPayload: r.encryptedBidPayload }));
      const result = await submitComputation(client, {
        circuit: "clearing_price",
        inputs: bidInputs,
        params: {
          totalSupply: auction.totalSupply.toString(),
        },
      });

      setSettlementState("finalizing");
      const resultAccount = result.arciumResultAccount ?? "11111111111111111111111111111111";
      await settleAuctionTx({
        wallet: toAnchorWallet(wallet),
        auction: auctionPubkey,
        clearingPrice: BigInt(result.clearingPrice),
        winners: result.winners.map((w) => new PublicKey(w)),
        arciumResultAccount: new PublicKey(resultAccount),
      });
      await hydrateFromChain();
      setSettlementState("success");
      notify("Truth has been revealed.", "success");
      setTimeout(() => router.push(`/results/${auction.id}`), 1500);
    } catch (error) {
      console.error("settlement flow failed:", error);
      setSettlementState("failed");
      setSettlementError(
        error instanceof Error
          ? error.message
          : "Settlement failed. Try again.",
      );
      notify("Settlement failed. Try again.", "error");
    }
  }

  function settlementButtonLabel() {
    if (settlementState === "loading") return "Submitting to Arcium...";
    if (settlementState === "computing") return "Arcium is computing...";
    if (settlementState === "finalizing") return "Writing result on-chain...";
    if (settlementState === "success") return "Truth has been revealed.";
    return "Initiate Settlement →";
  }

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

          {showSettlePanel ? (
            <div className="mt-6 rounded-[4px] border border-[#1e1e1e] bg-[#111111] p-4 text-xs text-[#f0ede8]">
              <p>This auction has closed.</p>
              <p className="mt-1">You are the authority. Initiate settlement to reveal the truth.</p>
              <p className="mt-3 font-mono text-[#6b6560]">
                [ {auction.bidCount} bids sealed ] — ready for computation
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  className="button-gold rounded-[4px] px-4 py-2 text-xs disabled:opacity-60"
                  onClick={handleSettleAuction}
                  disabled={settlementState === "loading" || settlementState === "computing" || settlementState === "finalizing"}
                >
                  {settlementButtonLabel()}
                </button>
                {settlementState === "failed" ? (
                  <button
                    className="button-outline rounded-[4px] px-4 py-2 text-xs"
                    onClick={handleSettleAuction}
                  >
                    Retry Settlement
                  </button>
                ) : null}
              </div>
              {settlementError ? <p className="mt-3 text-[#b87a7a]">{settlementError}</p> : null}
            </div>
          ) : null}

          {showPendingMessage ? (
            <div
              className="mt-6 rounded-[4px] border border-[#1a3a5c] bg-[#0d1218] p-4 text-xs text-[#9fb3c8]"
              style={{ animation: "pulse-sealed 1.9s infinite" }}
            >
              The seal is closed. Arcium is computing the result.
            </div>
          ) : null}

          {showResults ? (
            <div className="mt-6 rounded-[4px] border border-[#2a2a2a] bg-[#101010] p-4 text-xs text-[#f0ede8]">
              Settlement complete. The reveal is ready.
              <div className="mt-3">
                <Link className="button-outline inline-flex rounded-[4px] px-4 py-2 text-xs" href={`/results/${auction.id}`}>
                  View Results
                </Link>
              </div>
            </div>
          ) : null}
        </section>

        <section>
          <BidForm
            auctionId={id}
            arciumPublicKey={arciumPublicKey}
            arciumReady={arciumReady}
            arciumLoading={arciumLoading}
            locked={!isLive || !connected}
          />
        </section>
      </div>
    </main>
  );
}
