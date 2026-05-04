"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { encryptBid } from "@/lib/encryption";
import { useBid } from "@/hooks/useBid";
import { useWallet } from "@solana/wallet-adapter-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import CopyableText from "@/components/CopyableText";
import { truncateAddress } from "@/lib/format";
import { getArciumClient, initArcium } from "@/lib/arcium";

interface BidFormProps {
  auctionId: string;
  arciumPublicKey: string;
  arciumReady: boolean;
  arciumLoading: boolean;
  locked: boolean;
}

export default function BidForm({ auctionId, arciumPublicKey, arciumReady, arciumLoading, locked }: BidFormProps) {
  const { connected, publicKey } = useWallet();
  const { notify } = useToast();
  const [amountMode, setAmountMode] = useState<"SOL" | "USD">("SOL");
  const [amountSol, setAmountSol] = useState("0.50");
  const [amountUsd, setAmountUsd] = useState("100.00");
  const [quantity, setQuantity] = useState("1000");
  const [sealedAt, setSealedAt] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [solUsd, setSolUsd] = useState<number>(0);
  const [priceLoading, setPriceLoading] = useState(false);

  const { submitting, receiptHash, submitEncryptedBid } = useBid();

  useEffect(() => {
    async function fetchSolUsd() {
      setPriceLoading(true);
      try {
        const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
        const data = (await res.json()) as { solana?: { usd?: number } };
        const price = Number(data?.solana?.usd ?? 0);
        if (Number.isFinite(price) && price > 0) setSolUsd(price);
      } catch {
        // keep zero; UI handles unavailable rate
      } finally {
        setPriceLoading(false);
      }
    }
    fetchSolUsd();
  }, []);

  const amount = useMemo(() => {
    if (amountMode === "SOL") return amountSol;
    if (!solUsd || solUsd <= 0) return "0";
    const usd = Number(amountUsd);
    if (!Number.isFinite(usd) || usd <= 0) return "0";
    return (usd / solUsd).toFixed(6);
  }, [amountMode, amountSol, amountUsd, solUsd]);

  const collateral = useMemo(() => {
    const total = Number(amount) * Number(quantity);
    if (!Number.isFinite(total)) return "0.00";
    return total.toFixed(4);
  }, [amount, quantity]);

  const cipherPreview = useMemo(() => {
    const material = `${amount}:${quantity}:${arciumPublicKey}`;
    let acc = 0;
    for (let i = 0; i < material.length; i += 1) acc = (acc + material.charCodeAt(i) * (i + 1)) % 0xfffffff;
    return `0x${acc.toString(16).padStart(8, "0")}...${(acc * 97).toString(16).padStart(8, "0")}`;
  }, [amount, quantity, arciumPublicKey]);

  async function sealBid() {
    try {
      let activeArciumKey = arciumPublicKey;
      if (!arciumReady || !activeArciumKey) {
        const ready = await initArcium();
        if (!ready) {
          notify("Encryption layer unavailable. Please try again.", "error");
          return;
        }
        const client = await getArciumClient();
        activeArciumKey = client?.publicKey ?? "";
      }
      if (!activeArciumKey) {
        notify("Encryption layer unavailable. Please try again.", "error");
        return;
      }

      const encrypted = await encryptBid(Number(amount), Number(quantity), activeArciumKey);
      const collateralLamports = BigInt(Math.round(Number(collateral) * 1_000_000_000));
      await submitEncryptedBid(auctionId, encrypted, collateralLamports);
      setSubmitted(true);
      setSealedAt(new Date().toLocaleString());
      notify("Your bid is locked inside Arcium. It cannot be seen or changed.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "The seal resisted this attempt. Re-enter with valid values.", "error");
    } finally {
      setConfirmOpen(false);
    }
  }

  function openConfirm(event: FormEvent) {
    event.preventDefault();
    if (!connected) {
      notify("Connect wallet to bid", "error");
      return;
    }
    if (locked || submitted) return;
    setConfirmOpen(true);
  }

  return (
    <div className="relative surface p-5">
      {!connected ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#080808de] p-6 text-center">
          <p className="text-xs text-[#f0ede8]">Connect wallet to bid</p>
        </div>
      ) : null}

      <h3 className="text-3xl">Place Your Sealed Bid</h3>
      <p className="mt-1 text-xs text-[#6b6560]">Truth surfaces at close.</p>

      <form className="mt-5 space-y-4" onSubmit={openConfirm}>
        <div className="flex gap-2 rounded-[999px] border border-[#1e1e1e] bg-[#0d0d0d] p-1">
          <button
            type="button"
            onClick={() => setAmountMode("SOL")}
            className={`flex-1 rounded-[999px] px-3 py-2 text-xs transition-soft ${amountMode === "SOL" ? "bg-[#c8892a] text-[#14110a]" : "text-[#6b6560] hover:text-[#f0ede8]"}`}
            disabled={locked || submitted || submitting}
          >
            SOL / token
          </button>
          <button
            type="button"
            onClick={() => setAmountMode("USD")}
            className={`flex-1 rounded-[999px] px-3 py-2 text-xs transition-soft ${amountMode === "USD" ? "bg-[#c8892a] text-[#14110a]" : "text-[#6b6560] hover:text-[#f0ede8]"}`}
            disabled={locked || submitted || submitting}
          >
            USD / token
          </button>
        </div>

        <div>
          <label className="text-xs text-[#6b6560]">{amountMode === "SOL" ? "SOL per token" : "USD per token"}</label>
          {amountMode === "SOL" ? (
            <input
              className="input-dark mt-1 text-sm"
              value={amountSol}
              onChange={(event) => setAmountSol(event.target.value)}
              disabled={locked || submitted || submitting}
            />
          ) : (
            <input
              className="input-dark mt-1 text-sm"
              value={amountUsd}
              onChange={(event) => setAmountUsd(event.target.value)}
              disabled={locked || submitted || submitting}
            />
          )}
          {amountMode === "USD" ? (
            <p className="mt-1 text-[11px] text-[#6b6560]">
              {priceLoading
                ? "Fetching SOL/USD rate..."
                : solUsd > 0
                  ? `Rate: 1 SOL = $${solUsd.toFixed(2)} · Converted: ${amount} SOL/token`
                  : "SOL/USD rate unavailable; conversion paused."}
            </p>
          ) : null}
        </div>

        <div>
          <label className="text-xs text-[#6b6560]">Quantity of tokens</label>
          <input
            className="input-dark mt-1 text-sm"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            disabled={locked || submitted || submitting}
          />
        </div>

        <div className="rounded-[4px] border border-[#1e1e1e] bg-[#0b0b0b] p-3 text-xs">
          <p className="text-[#6b6560]">Total collateral required: <span className="font-mono text-[#f0ede8]">{collateral} SOL</span></p>
          <p className="mt-2 text-[#6b6560]">Encrypted payload preview:</p>
          <p className="mt-1 font-mono text-[#c8892a]">{cipherPreview}</p>
        </div>

        <button
          type="submit"
          disabled={locked || submitted || submitting || !connected || !arciumReady}
          className="button-gold w-full rounded-[4px] px-4 py-3 text-xs"
        >
          {!connected
            ? "Connect wallet to bid"
            : submitted
              ? "Bid sealed ✓"
              : submitting
                ? "Sealing..."
                : arciumReady
                  ? "Seal Bid →"
                  : arciumLoading
                    ? "Preparing encryption..."
                    : "Preparing encryption..."}
        </button>
      </form>

      {submitted && receiptHash ? (
        <div className="mt-4 rounded-[4px] border border-[#1e1e1e] bg-[#0c0c0c] p-4 text-xs">
          <p className="text-[#6b6560]">Bid Receipt</p>
          <p className="mt-2 font-mono">Timestamp: {sealedAt}</p>
          <p className="mt-1 text-[#6b6560]">Bid hash:</p>
          <CopyableText value={receiptHash} className="mt-1 text-[#c8892a]" head={12} tail={10} />
          <p className="mt-2 text-[#6b6560]">Your bid is locked inside Arcium. It cannot be seen or changed.</p>
        </div>
      ) : null}

      <ConfirmModal
        title="Confirm Sealed Bid"
        description="Review your parameters before your wallet signs."
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={sealBid}
        confirmLabel="Seal Bid →"
        loading={submitting}
        rows={[
          { label: "Bidder", value: publicKey ? truncateAddress(publicKey.toBase58(), 8, 6) : "Unknown" },
          { label: "SOL per token", value: amount },
          ...(amountMode === "USD" ? [{ label: "USD per token", value: amountUsd }] : []),
          { label: "Quantity", value: quantity },
          { label: "Collateral", value: `${collateral} SOL` },
        ]}
      />
    </div>
  );
}
