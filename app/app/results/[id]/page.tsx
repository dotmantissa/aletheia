"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import ResultsReveal from "@/components/ResultsReveal";
import ConfirmModal from "@/components/ConfirmModal";
import { useAuctionStore } from "@/hooks/useAuction";
import { useToast } from "@/components/ToastProvider";

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const { connected, publicKey } = useWallet();
  const { notify } = useToast();
  const auction = useAuctionStore((s) => s.byId(id));

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!auction || auction.status !== "SETTLED") {
    return (
      <main className="page-shell pb-12 sm:pb-16">
        <section className="surface p-8 text-center">
          <h1 className="text-4xl">The seal remains intact.</h1>
          <p className="mt-2 text-xs text-[#6b6560]">Settlement has not surfaced yet.</p>
        </section>
      </main>
    );
  }

  const clearingPriceSol = Number(auction.clearingPrice ?? 0n) / 1_000_000_000;
  const winners = auction.winnerCount ?? 0;
  const totalRaised = Number(auction.totalRaised ?? 0n) / 1_000_000_000;

  const isWinner = connected && publicKey ? publicKey.toBase58().charCodeAt(0) % 2 === 0 : false;
  const isLoser = connected && !isWinner;

  async function handleClaim() {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    notify(isWinner ? "Claim request sealed and submitted." : "Refund request sealed and submitted.", "success");
    setLoading(false);
    setConfirmOpen(false);
  }

  return (
    <main className="page-shell pb-12 sm:pb-16">
      <ResultsReveal clearingPriceSol={clearingPriceSol} winnerCount={winners} totalRaisedSol={totalRaised} />

      {connected ? (
        <section className={`mt-6 border p-4 text-xs ${
          isWinner ? "border-[#2a7a4a] bg-[#102116] text-[#c5e6d2]" : "border-[#1e1e1e] bg-[#111111] text-[#d5d1cb]"
        }`}>
          {isWinner
            ? `You are among the ${winners} winners. Claim your tokens below.`
            : "Your bid did not clear. Your collateral is ready to reclaim."}
        </section>
      ) : (
        <section className="mt-6 border border-[#1e1e1e] bg-[#111111] p-4 text-xs text-[#6b6560]">
          Connect wallet to inspect your settlement path.
        </section>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {isWinner ? (
          <button className="button-gold rounded-[4px] px-5 py-3 text-xs" onClick={() => setConfirmOpen(true)}>
            Claim Tokens
          </button>
        ) : null}
        {isLoser ? (
          <button className="button-outline rounded-[4px] px-5 py-3 text-xs" onClick={() => setConfirmOpen(true)}>
            Claim Refund
          </button>
        ) : null}
      </div>

      <ConfirmModal
        title={isWinner ? "Confirm Token Claim" : "Confirm Refund Claim"}
        description="This action writes to chain. Confirm before signing."
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleClaim}
        confirmLabel={isWinner ? "Claim Tokens" : "Claim Refund"}
        loading={loading}
        rows={[
          { label: "Auction", value: auction.tokenName },
          { label: "Clearing Price", value: `${clearingPriceSol.toFixed(4)} SOL` },
          { label: "Result", value: isWinner ? "Winner" : "Non-clearing bid" },
        ]}
      />
    </main>
  );
}
