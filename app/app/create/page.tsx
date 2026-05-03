"use client";
export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { createAuctionTx, toAnchorWallet } from "@/lib/anchor";
import { useAuctionStore } from "@/hooks/useAuction";
import { truncateAddress } from "@/lib/format";

const durationOptions = [
  { label: "1h", value: 3600 },
  { label: "6h", value: 21600 },
  { label: "12h", value: 43200 },
  { label: "24h", value: 86400 },
  { label: "48h", value: 172800 },
  { label: "Custom", value: -1 },
];

type CreateMode = "AUTO" | "MANUAL";
type TokenChoice = {
  mint: string;
  tokenAccount: string;
  balanceUi: number;
  decimals: number;
  symbol: string;
  name: string;
  imageUri: string | null;
};

export default function CreateAuctionPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { notify } = useToast();
  const hydrateFromChain = useAuctionStore((s) => s.hydrateFromChain);

  const [tokenMint, setTokenMint] = useState("");
  const [authorityTokenAccount, setAuthorityTokenAccount] = useState("");
  const [tokenName, setTokenName] = useState("TOKEN");
  const [mode, setMode] = useState<CreateMode>("AUTO");
  const [totalSupply, setTotalSupply] = useState("1000000");
  const [minBidFloor, setMinBidFloor] = useState("0.5");
  const [duration, setDuration] = useState("3600");
  const [customDuration, setCustomDuration] = useState("7200");
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenChoices, setTokenChoices] = useState<TokenChoice[]>([]);
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const [selectedTokenMint, setSelectedTokenMint] = useState("");
  const [autoState, setAutoState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");

  const effectiveDuration = duration === "-1" ? Number(customDuration) : Number(duration);

  const hasFormValues =
    tokenMint.trim().length > 0 ||
    authorityTokenAccount.trim().length > 0 ||
    tokenName.trim() !== "TOKEN" ||
    totalSupply.trim() !== "1000000" ||
    minBidFloor.trim() !== "0.5";

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

  const selectedToken = useMemo(
    () => tokenChoices.find((choice) => choice.mint === selectedTokenMint) ?? null,
    [tokenChoices, selectedTokenMint],
  );

  useEffect(() => {
    if (mode === "AUTO" && connected && wallet.publicKey && autoState === "idle") {
      loadWalletTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, connected, wallet.publicKey]);

  async function loadWalletTokens() {
    if (!wallet.publicKey) return;
    setAutoState("loading");
    setTokenMenuOpen(false);
    try {
      const response = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });
      const choices: TokenChoice[] = response.value
        .map((item) => {
          const info = item.account.data.parsed.info as {
            mint: string;
            tokenAmount: { uiAmount: number | null; decimals: number };
          };
          return {
            mint: info.mint,
            tokenAccount: item.pubkey.toBase58(),
            balanceUi: info.tokenAmount.uiAmount ?? 0,
            decimals: info.tokenAmount.decimals,
            symbol: truncateAddress(info.mint, 4, 4),
            name: truncateAddress(info.mint, 4, 4),
            imageUri: null,
          };
        })
        .filter((choice) => choice.balanceUi > 0);

      if (choices.length === 0) {
        setTokenChoices([]);
        setAutoState("empty");
        return;
      }
      setTokenChoices(choices);
      setAutoState("ready");
    } catch {
      setAutoState("error");
      setTokenChoices([]);
    }
  }

  function validate() {
    if (!connected) throw new Error("Connect wallet to participate");
    new PublicKey(tokenMint);
    new PublicKey(authorityTokenAccount);
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

  function switchMode(nextMode: CreateMode) {
    if (mode === nextMode) return;
    if (hasFormValues) {
      const shouldSwitch = window.confirm("Switch modes? Your current inputs will be cleared.");
      if (!shouldSwitch) return;
    }
    setMode(nextMode);
    setTokenMint("");
    setAuthorityTokenAccount("");
    setTokenName("TOKEN");
    setTotalSupply("1000000");
    setMinBidFloor("0.5");
    setDuration("3600");
    setCustomDuration("7200");
    setTokenChoices([]);
    setSelectedTokenMint("");
    setAutoState(nextMode === "AUTO" ? "idle" : "ready");
  }

  function pickToken(choice: TokenChoice) {
    setSelectedTokenMint(choice.mint);
    setTokenMint(choice.mint);
    setAuthorityTokenAccount(choice.tokenAccount);
    setTokenName(choice.symbol || "TOKEN");
    setTotalSupply(Math.floor(choice.balanceUi).toString());
    setTokenMenuOpen(false);
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
      notify("The seal is set. Awaiting signature and finality.", "info");
      const result = await createAuctionTx({
        wallet: toAnchorWallet(wallet),
        tokenMint: new PublicKey(tokenMint),
        authorityTokenAccount: new PublicKey(authorityTokenAccount),
        totalSupply: BigInt(Math.floor(Number(totalSupply))),
        minBidFloorLamports: BigInt(Math.round(Number(minBidFloor) * 1_000_000_000)),
        durationSeconds: effectiveDuration,
      });
      await hydrateFromChain();
      notify("Auction created. Truth surfaces at close.", "success");
      router.push(`/auction/${result.auction.toBase58()}?created=1`);
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
    <main className="page-shell pb-12 sm:pb-16">
      <h1 className="text-4xl sm:text-5xl">Open a New Auction</h1>
      <p className="mt-2 text-xs text-[#6b6560]">
        Once created, the auction is immutable. Set parameters carefully.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <form className="surface space-y-4 p-5" onSubmit={openConfirmation}>
          <div className="flex gap-2 rounded-[999px] border border-[#1e1e1e] bg-[#0d0d0d] p-1">
            <button
              type="button"
              onClick={() => switchMode("AUTO")}
              className={`flex-1 rounded-[999px] px-3 py-2 text-xs transition-soft ${
                mode === "AUTO" ? "bg-[#c8892a] text-[#14110a]" : "text-[#6b6560] hover:text-[#f0ede8]"
              }`}
            >
              Auto — Select from wallet
            </button>
            <button
              type="button"
              onClick={() => switchMode("MANUAL")}
              className={`flex-1 rounded-[999px] px-3 py-2 text-xs transition-soft ${
                mode === "MANUAL" ? "bg-[#c8892a] text-[#14110a]" : "text-[#6b6560] hover:text-[#f0ede8]"
              }`}
            >
              Manual — Enter addresses
            </button>
          </div>

          {mode === "AUTO" ? (
            <section className="space-y-3">
              {autoState === "idle" ? (
                <button type="button" className="button-outline w-full rounded-[4px] px-4 py-3 text-xs" onClick={loadWalletTokens}>
                  Select token from wallet
                </button>
              ) : null}

              {autoState === "loading" ? (
                <div className="rounded-[4px] border border-[#1e1e1e] bg-[#0b0b0b] p-4">
                  <div className="h-4 w-40 animate-pulse rounded bg-[#1e1e1e]" />
                  <div className="mt-3 h-10 animate-pulse rounded bg-[#161616]" />
                  <p className="mt-3 text-xs text-[#6b6560]">Reading your wallet...</p>
                </div>
              ) : null}

              {autoState === "ready" ? (
                <div className="relative">
                  <button
                    type="button"
                    className="input-dark flex items-center justify-between text-left text-sm"
                    onClick={() => setTokenMenuOpen((open) => !open)}
                  >
                    <span>{selectedToken ? `${selectedToken.name} — ${selectedToken.symbol}` : "Choose token"}</span>
                    <span className="text-[#6b6560]">{tokenMenuOpen ? "▲" : "▼"}</span>
                  </button>
                  {tokenMenuOpen ? (
                    <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-[4px] border border-[#1e1e1e] bg-[#111111]">
                      {tokenChoices.map((choice) => (
                        <button
                          key={choice.tokenAccount}
                          type="button"
                          onClick={() => pickToken(choice)}
                          className="flex w-full items-center justify-between gap-3 border-b border-[#1a1a1a] px-3 py-3 text-left transition-soft hover:bg-[#171717]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1f1f1f] text-[11px] text-[#c8892a]">
                              ◉
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs">{choice.name} — {choice.symbol}</span>
                            </span>
                          </div>
                          <span className="font-mono text-xs text-[#f0ede8]">{choice.balanceUi.toLocaleString()} {choice.symbol}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {autoState === "empty" ? (
                <div className="rounded-[4px] border border-[#1e1e1e] bg-[#0d0d0d] p-3 text-xs text-[#6b6560]">
                  No tokens found in this wallet. Switch to Manual mode to enter addresses directly.
                </div>
              ) : null}

              {autoState === "error" ? (
                <div className="rounded-[4px] border border-[#7a2a2a] bg-[#1a0f0f] p-3 text-xs text-[#d49d9d]">
                  Could not read wallet tokens. Check your connection or switch to Manual mode.
                </div>
              ) : null}

              {selectedToken ? (
                <div className="rounded-[4px] border border-[#1e1e1e] bg-[#0d0d0d] p-4">
                  <p className="text-xs text-[#6b6560]">Selected Token</p>
                  <p className="mt-2 text-2xl">{selectedToken.symbol}</p>
                  <div className="mt-3 space-y-2 text-xs">
                    <p className="font-mono">Mint: {truncateAddress(selectedToken.mint, 4, 4)}</p>
                    <p className="font-mono">Account: {truncateAddress(selectedToken.tokenAccount, 4, 4)}</p>
                    <p className="font-mono">Balance: {selectedToken.balanceUi.toLocaleString()} {selectedToken.symbol}</p>
                  </div>
                </div>
              ) : null}

              <label className="block text-xs text-[#6b6560]">Token Mint Address</label>
              <div className="input-dark flex items-center justify-between gap-2 text-sm opacity-70">
                <span className="truncate">{tokenMint || "Not selected"}</span>
                <span>🔒</span>
              </div>

              <label className="block text-xs text-[#6b6560]">Authority Token Account</label>
              <div className="input-dark flex items-center justify-between gap-2 text-sm opacity-70">
                <span className="truncate">{authorityTokenAccount || "Not selected"}</span>
                <span>🔒</span>
              </div>
            </section>
          ) : (
            <section className="space-y-3">
              <label className="block text-xs text-[#6b6560]">Token Name</label>
              <input className="input-dark text-sm" value={tokenName} onChange={(event) => setTokenName(event.target.value)} />
              <label className="block text-xs text-[#6b6560]">Token Mint Address</label>
              <input className="input-dark text-sm" value={tokenMint} onChange={(event) => setTokenMint(event.target.value)} />
              <label className="block text-xs text-[#6b6560]">Authority Token Account</label>
              <input className="input-dark text-sm" value={authorityTokenAccount} onChange={(event) => setAuthorityTokenAccount(event.target.value)} />
            </section>
          )}

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
          { label: "Authority Token Account", value: authorityTokenAccount },
          { label: "Total Supply", value: totalSupply },
          { label: "Minimum Bid Floor", value: `${minBidFloor} SOL` },
          { label: "Duration", value: `${effectiveDuration} seconds` },
        ]}
      />
    </main>
  );
}
