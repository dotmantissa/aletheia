"use client";

import { FormEvent, useMemo, useState } from "react";
import { encryptBid } from "@/lib/encryption";
import { useBid } from "@/hooks/useBid";
import { useWallet } from "@solana/wallet-adapter-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import CopyableText from "@/components/CopyableText";
import { truncateAddress } from "@/lib/format";

interface BidFormProps {
  auctionId: string;
  arciumPublicKey: string;
  locked: boolean;
}

export default function BidForm({ auctionId, arciumPublicKey, locked }: BidFormProps) {
  const { connected, publicKey } = useWallet();
  const { notify } = useToast();
  const [amount, setAmount] = useState("0.50");
  const [quantity, setQuantity] = useState("1000");
  const [sealedAt, setSealedAt] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { submitting, receiptHash, submitEncryptedBid } = useBid();

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
      const encrypted = await encryptBid(Number(amount), Number(quantity), arciumPublicKey);
      await submitEncryptedBid(auctionId, encrypted);
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
        <div>
          <label className="text-xs text-[#6b6560]">SOL per token</label>
          <input
            className="input-dark mt-1 text-sm"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={locked || submitted || submitting}
          />
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
          disabled={locked || submitted || submitting || !connected}
          className="button-gold w-full rounded-[4px] px-4 py-3 text-xs"
        >
          {!connected ? "Connect wallet to bid" : submitted ? "Bid sealed ✓" : submitting ? "Sealing..." : "Seal Bid →"}
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
          { label: "Quantity", value: quantity },
          { label: "Collateral", value: `${collateral} SOL` },
        ]}
      />
    </div>
  );
}
