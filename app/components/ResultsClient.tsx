"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import ResultsReveal from "@/components/ResultsReveal";
import ConfirmModal from "@/components/ConfirmModal";
import { useAuctionStore } from "@/hooks/useAuction";
import { useToast } from "@/components/ToastProvider";
import { claimRefundTx, claimTokensTx, fetchBidReceiptStatus, toAnchorWallet } from "@/lib/anchor";

export default function ResultsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const wallet = useWallet();
  const { connected, publicKey } = wallet;
  const [mounted, setMounted] = useState(false);
  const { notify } = useToast();
  const hydrateFromChain = useAuctionStore((s) => s.hydrateFromChain);
  const auction = useAuctionStore((s) => s.byId(id));

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bidStatus, setBidStatus] = useState<{
    exists: boolean;
    isWinner: boolean;
    claimed: boolean;
    collateralLamports: bigint;
  }>({
    exists: false,
    isWinner: false,
    claimed: false,
    collateralLamports: 0n,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    hydrateFromChain();
  }, [hydrateFromChain]);

  useEffect(() => {
    if (mounted && auction && !auction.isSettled) {
      router.replace(`/auction/${id}`);
    }
  }, [mounted, auction, id, router]);

  useEffect(() => {
    async function hydrateBidStatus() {
      if (!connected || !publicKey || !auction) {
        setBidStatus({ exists: false, isWinner: false, claimed: false, collateralLamports: 0n });
        return;
      }
      const status = await fetchBidReceiptStatus({
        wallet: toAnchorWallet(wallet),
        auction: new PublicKey(id),
        bidder: publicKey,
      });
      setBidStatus(status);
    }
    hydrateBidStatus();
  }, [connected, publicKey, auction, id, wallet]);

  if (!mounted) {
    return (
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <p className="font-mono text-sm text-[#6b6560]">Initializing...</p>
      </main>
    );
  }

  if (!auction || !auction.isSettled) {
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

  const winnerSet = new Set(auction.winners ?? []);
  const isWinner = connected && publicKey ? winnerSet.has(publicKey.toBase58()) : false;
  const hasBid = connected && bidStatus.exists;
  const allocation = auction.winnerCount && auction.winnerCount > 0 ? auction.totalSupply / BigInt(auction.winnerCount) : 0n;
  const claimCostLamports = (auction.clearingPrice ?? 0n) * allocation;
  const undercollateralizedWinner = Boolean(isWinner && hasBid && bidStatus.collateralLamports < claimCostLamports);
  const canClaimTokens = Boolean(hasBid && isWinner && !undercollateralizedWinner && !bidStatus.claimed);
  const canClaimRefund = Boolean(hasBid && (!isWinner || undercollateralizedWinner) && !bidStatus.claimed);

  async function handleClaim() {
    setLoading(true);
    try {
      if (!connected || !publicKey) throw new Error("Connect wallet to participate");
      if (canClaimTokens) {
        const sig = await claimTokensTx({ wallet: toAnchorWallet(wallet), auction: new PublicKey(id) });
        notify(`Token claim finalized: ${sig.slice(0, 8)}...`, "success");
      } else if (canClaimRefund) {
        const sig = await claimRefundTx({ wallet: toAnchorWallet(wallet), auction: new PublicKey(id) });
        notify(`Refund finalized: ${sig.slice(0, 8)}...`, "success");
      } else {
        throw new Error("No claim path available for this wallet on this auction");
      }
      await hydrateFromChain();
      if (connected && publicKey) {
        const status = await fetchBidReceiptStatus({
          wallet: toAnchorWallet(wallet),
          auction: new PublicKey(id),
          bidder: publicKey,
        });
        setBidStatus(status);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Settlement claim failed", "error");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  return (
    <main className="page-shell pb-12 sm:pb-16">
      <ResultsReveal clearingPriceSol={clearingPriceSol} winnerCount={winners} totalRaisedSol={totalRaised} />

      {connected ? (
        <section
          className={`mt-6 border p-4 text-xs ${
            isWinner
              ? "border-[#2a7a4a] bg-[#102116] text-[#c5e6d2]"
              : "border-[#1e1e1e] bg-[#111111] text-[#d5d1cb]"
          }`}
        >
          {!hasBid
            ? "You did not place a bid in this auction."
            : undercollateralizedWinner
            ? "Your winning bid is undercollateralized at the clearing cost. Reclaim your collateral below."
            : isWinner
            ? `You are among the ${winners} winners. Claim your tokens below.`
            : "Your bid did not clear. Your collateral is ready to reclaim."}
        </section>
      ) : (
        <section className="mt-6 border border-[#1e1e1e] bg-[#111111] p-4 text-xs text-[#6b6560]">
          Connect wallet to inspect your settlement path.
        </section>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {canClaimTokens ? (
          <button className="button-gold rounded-[4px] px-5 py-3 text-xs" onClick={() => setConfirmOpen(true)}>
            Claim Tokens
          </button>
        ) : null}
        {canClaimRefund ? (
          <button className="button-outline rounded-[4px] px-5 py-3 text-xs" onClick={() => setConfirmOpen(true)}>
            Claim Refund
          </button>
        ) : null}
      </div>

      <ConfirmModal
        title={canClaimTokens ? "Confirm Token Claim" : "Confirm Refund Claim"}
        description="This action writes to chain. Confirm before signing."
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleClaim}
        confirmLabel={canClaimTokens ? "Claim Tokens" : "Claim Refund"}
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
