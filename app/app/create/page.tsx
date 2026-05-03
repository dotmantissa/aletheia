"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";

const durationOptions = [
  { label: "1h", value: 3600 },
  { label: "6h", value: 21600 },
  { label: "12h", value: 43200 },
  { label: "24h", value: 86400 },
  { label: "48h", value: 172800 },
  { label: "Custom", value: -1 },
];

export default function CreateAuctionPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { notify } = useToast();

  const [tokenMint, setTokenMint] = useState("");
  const [tokenName, setTokenName] = useState("TOKEN");
  const [totalSupply, setTotalSupply] = useState("1000000");
  const [minBidFloor, setMinBidFloor] = useState("0.5");
  const [duration, setDuration] = useState("3600");
  const [customDuration, setCustomDuration] = useState("7200");
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const effectiveDuration = duration === "-1" ? Number(customDuration) : Number(duration);

  const preview = useMemo(
    () => ({
      tokenName,
      tokenMint,
      totalSupply,
      minBidFloor,
      effectiveDuration,
    }),
    [tokenName, tokenMint, totalSupply, minBidFloor, effectiveDuration],
  );

  function validate() {
    if (!connected) throw new Error("Connect wallet to participate");
    new PublicKey(tokenMint);
    if (!Number.isFinite(Number(totalSupply)) || Number(totalSupply) <= 0) {
      throw new Error("Total token supply must be greater than zero");
    }
    if (!Number.isFinite(Number(minBidFloor)) || Number(minBidFloor) <= 0) {
      throw new Error("Minimum bid floor must be greater than zero");
    }
    if (!Number.isFinite(effectiveDuration) || effectiveDuration <= 0) {
      throw new Error("Auction duration must be greater than zero");
    }
  }

  function openConfirmation(event: FormEvent) {
    event.preventDefault();
    try {
      validate();
      setShowConfirm(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to validate auction parameters", "error");
    }
  }

  async function sealAuction() {
    setLoading(true);
    try {
      const auctionId = `${tokenName.toLowerCase()}-${Date.now().toString(36)}`;
      notify("The seal is set. Awaiting signature and finality.", "info");
      await new Promise((resolve) => setTimeout(resolve, 1100));
      notify("Auction created. Truth surfaces at close.", "success");
      router.push(`/auction/${auctionId}?created=1`);
    } catch {
      notify("The seal failed to set. Verify parameters and retry.", "error");
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  }

  if (!connected) {
    return (
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <section className="surface max-w-lg p-8 text-center">
          <h1 className="text-4xl">Open a New Auction</h1>
          <p className="mt-3 text-xs text-[#6b6560]">Connect wallet to participate. The seal cannot be formed from the outside.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell pb-16">
      <h1 className="text-5xl">Open a New Auction</h1>
      <p className="mt-2 text-xs text-[#6b6560]">
        Once created, the auction is immutable. Set parameters carefully.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <form className="surface space-y-4 p-5" onSubmit={openConfirmation}>
          <label className="block text-xs text-[#6b6560]">Token Name</label>
          <input className="input-dark text-sm" value={tokenName} onChange={(event) => setTokenName(event.target.value)} />

          <label className="block text-xs text-[#6b6560]">Token Mint Address</label>
          <input className="input-dark text-sm" value={tokenMint} onChange={(event) => setTokenMint(event.target.value)} />

          <label className="block text-xs text-[#6b6560]">Total Token Supply</label>
          <input className="input-dark text-sm" value={totalSupply} onChange={(event) => setTotalSupply(event.target.value)} />

          <label className="block text-xs text-[#6b6560]">Minimum Bid Floor (SOL)</label>
          <input className="input-dark text-sm" value={minBidFloor} onChange={(event) => setMinBidFloor(event.target.value)} />

          <label className="block text-xs text-[#6b6560]">Auction Duration</label>
          <select className="input-dark text-sm" value={duration} onChange={(event) => setDuration(event.target.value)}>
            {durationOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {duration === "-1" ? (
            <input
              className="input-dark text-sm"
              placeholder="Custom duration in seconds"
              value={customDuration}
              onChange={(event) => setCustomDuration(event.target.value)}
            />
          ) : null}

          <button type="submit" className="button-gold mt-4 w-full rounded-[4px] px-4 py-3 text-xs">
            Seal the Auction
          </button>
        </form>

        <aside className="surface p-5">
          <p className="text-xs text-[#6b6560]">Live Preview</p>
          <h2 className="mt-2 text-4xl leading-none">{preview.tokenName || "TOKEN"}</h2>
          <p className="mt-2 font-mono text-xs text-[#6b6560]">{preview.tokenMint || "mint-address"}</p>
          <p className="mt-6 font-mono text-xs">Min bid: {preview.minBidFloor || "0"} SOL</p>
          <p className="mt-2 font-mono text-xs">Supply: {preview.totalSupply || "0"}</p>
          <p className="mt-2 font-mono text-xs">Duration: {preview.effectiveDuration} seconds</p>
          <p className="mt-6 text-xs text-[#6b6560]">Truth surfaces at close.</p>
        </aside>
      </div>

      <ConfirmModal
        title="Confirm Auction Seal"
        description="Review every parameter before your wallet signs."
        open={showConfirm}
        confirmLabel="Seal the Auction"
        loading={loading}
        onClose={() => setShowConfirm(false)}
        onConfirm={sealAuction}
        rows={[
          { label: "Token Name", value: tokenName },
          { label: "Token Mint", value: tokenMint },
          { label: "Total Supply", value: totalSupply },
          { label: "Minimum Bid Floor", value: `${minBidFloor} SOL` },
          { label: "Duration", value: `${effectiveDuration} seconds` },
        ]}
      />
    </main>
  );
}
