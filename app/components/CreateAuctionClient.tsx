"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { createAuctionTx, TOKEN_PROGRAM_ID, toAnchorWallet } from "@/lib/anchor";
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
type ValidationState = {
  status: "idle" | "valid" | "invalid";
  message: string;
};
type ResolvedMetadata = { name: string; symbol: string; imageUri: string | null };
const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function readBorshString(data: Buffer, offset: number): { value: string; nextOffset: number } {
  if (offset + 4 > data.length) return { value: "", nextOffset: data.length };
  const len = data.readUInt32LE(offset);
  const start = offset + 4;
  const end = Math.min(start + len, data.length);
  return {
    value: data.subarray(start, end).toString("utf8").replace(/\0/g, "").trim(),
    nextOffset: end,
  };
}

function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let normalized = url.trim();
  const embedded = normalized.match(/https?:\/\/\S+/i) ?? normalized.match(/https?:\/\S+/i);
  if (embedded) {
    normalized = embedded[0];
  }
  if (normalized.startsWith("ipfs://")) {
    normalized = `https://gateway.pinata.cloud/ipfs/${normalized.slice("ipfs://".length)}`;
  }
  normalized = normalized.replace(/^https:\/(?!\/)/i, "https://");
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:") return null;
    return normalized;
  } catch {
    return null;
  }
}

export default function CreateAuctionPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { connection } = useConnection();
  const wallet = useWallet();
  const [mounted, setMounted] = useState(false);
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
  const [selectedTokenDecimals, setSelectedTokenDecimals] = useState(0);
  const [autoState, setAutoState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [mintValidation, setMintValidation] = useState<ValidationState>({ status: "idle", message: "" });
  const [accountValidation, setAccountValidation] = useState<ValidationState>({ status: "idle", message: "" });
  const [manualMetadata, setManualMetadata] = useState<ResolvedMetadata | null>(null);
  const [manualMintDecimals, setManualMintDecimals] = useState(0);
  const [customDurationValue, setCustomDurationValue] = useState("2");
  const [customDurationUnit, setCustomDurationUnit] = useState<"hours" | "days">("hours");

  const effectiveDuration =
    duration === "-1"
      ? Number(customDurationValue) * (customDurationUnit === "days" ? 86400 : 3600)
      : Number(duration);

  function humanDuration(totalSeconds: number) {
    if (totalSeconds % 86400 === 0) {
      const days = totalSeconds / 86400;
      return `${days} day${days === 1 ? "" : "s"}`;
    }
    const hours = Math.floor(totalSeconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const hasFormValues =
    tokenMint.trim().length > 0 ||
    authorityTokenAccount.trim().length > 0 ||
    tokenName.trim() !== "TOKEN" ||
    totalSupply.trim() !== "1000000" ||
    minBidFloor.trim() !== "0.5";

  const selectedToken = useMemo(
    () => tokenChoices.find((choice) => choice.mint === selectedTokenMint) ?? null,
    [tokenChoices, selectedTokenMint],
  );
  const preview = useMemo(
    () => ({
      tokenName: selectedToken?.name || manualMetadata?.name || tokenName,
      tokenSymbol: selectedToken?.symbol || manualMetadata?.symbol || tokenName,
      tokenImageUri: selectedToken?.imageUri || manualMetadata?.imageUri || null,
      tokenMint,
      totalSupply,
      minBidFloor,
      effectiveDuration,
    }),
    [selectedToken, manualMetadata, tokenName, tokenMint, totalSupply, minBidFloor, effectiveDuration],
  );
  const closeAtUtc = useMemo(() => new Date(Date.now() + effectiveDuration * 1000).toUTCString(), [effectiveDuration]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mode === "AUTO" && connected && wallet.publicKey && autoState === "idle") {
      loadWalletTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, connected, wallet.publicKey]);

  if (!mounted) {
    return (
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <p className="font-mono text-sm text-[#6b6560]">Initializing...</p>
      </main>
    );
  }

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
      const withMetadata = await Promise.all(
        choices.map(async (choice) => {
          try {
            const metadata = await resolveMetadata(choice.mint);
            return {
              ...choice,
              symbol: metadata.symbol || choice.symbol,
              name: metadata.name || choice.name,
              imageUri: metadata.imageUri,
            };
          } catch {
            return choice;
          }
        }),
      );
      setTokenChoices(withMetadata);
      setAutoState("ready");
    } catch {
      setAutoState("error");
      setTokenChoices([]);
    }
  }

  function isStrictSolanaAddress(value: string) {
    return /^[1-9A-HJ-NP-Za-km-z]{44}$/.test(value);
  }

  async function resolveMetadata(mintAddress: string): Promise<ResolvedMetadata> {
    const mint = new PublicKey(mintAddress);
    const [metadataPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      METADATA_PROGRAM_ID,
    );
    const accountInfo = await connection.getAccountInfo(metadataPda);
    if (!accountInfo) {
      return { name: truncateAddress(mintAddress, 4, 4), symbol: truncateAddress(mintAddress, 4, 4), imageUri: null };
    }

    const data = Buffer.from(accountInfo.data);
    // mpl-token-metadata layout: key + update_authority + mint + Data{name,symbol,uri,...}
    let cursor = 1 + 32 + 32;
    const nameField = readBorshString(data, cursor);
    cursor = nameField.nextOffset;
    const symbolField = readBorshString(data, cursor);
    cursor = symbolField.nextOffset;
    const uriField = readBorshString(data, cursor);

    const name = nameField.value;
    const symbol = symbolField.value;
    const uri = uriField.value;
    if (!uri) {
      return {
        name: name || truncateAddress(mintAddress, 4, 4),
        symbol: symbol || truncateAddress(mintAddress, 4, 4),
        imageUri: null,
      };
    }
    try {
      const json = await fetch(uri).then((res) => (res.ok ? res.json() : null));
      return {
        name: name || truncateAddress(mintAddress, 4, 4),
        symbol: symbol || truncateAddress(mintAddress, 4, 4),
        imageUri: sanitizeImageUrl((json?.image as string | null | undefined) ?? uri),
      };
    } catch {
      return {
        name: name || truncateAddress(mintAddress, 4, 4),
        symbol: symbol || truncateAddress(mintAddress, 4, 4),
        imageUri: sanitizeImageUrl(uri),
      };
    }
  }

  async function validateMintField(value: string) {
    const trimmed = value.trim();
    if (!isStrictSolanaAddress(trimmed)) {
      setMintValidation({ status: "invalid", message: "Invalid Solana address" });
      return;
    }
    try {
      const metadata = await resolveMetadata(trimmed);
      const mintInfo = await connection.getParsedAccountInfo(new PublicKey(trimmed), "confirmed");
      const parsed = mintInfo.value?.data && "parsed" in mintInfo.value.data ? mintInfo.value.data.parsed : null;
      const decimals = Number(parsed?.info?.decimals ?? 0);
      setManualMintDecimals(Number.isFinite(decimals) ? decimals : 0);
      const resolvedSymbol = metadata.symbol || truncateAddress(trimmed, 4, 4);
      const resolvedName = metadata.name || resolvedSymbol;
      setTokenName(resolvedSymbol);
      setManualMetadata({ name: resolvedName, symbol: resolvedSymbol, imageUri: metadata.imageUri });
      setMintValidation({ status: "valid", message: `✓ Resolved: ${resolvedSymbol} (${resolvedName})` });
    } catch {
      setManualMetadata({ name: truncateAddress(trimmed, 4, 4), symbol: truncateAddress(trimmed, 4, 4), imageUri: null });
      setMintValidation({ status: "valid", message: `✓ Resolved: ${truncateAddress(trimmed, 4, 4)}` });
    }
  }

  function validateAccountField(value: string) {
    const trimmed = value.trim();
    if (!isStrictSolanaAddress(trimmed)) {
      setAccountValidation({ status: "invalid", message: "Invalid Solana address" });
      return;
    }
    setAccountValidation({ status: "valid", message: "✓ Valid Solana address" });
  }

  function validate() {
    if (!connected) throw new Error("Connect wallet to participate");
    new PublicKey(tokenMint);
    new PublicKey(authorityTokenAccount);
    if (!Number.isFinite(Number(totalSupply)) || Number(totalSupply) <= 0) {
      throw new Error("Total token supply must be greater than zero");
    }
    if (mode === "AUTO" && selectedToken && Number(totalSupply) > selectedToken.balanceUi) {
      throw new Error("Total token supply cannot exceed selected wallet token balance");
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
    setCustomDurationValue("2");
    setCustomDurationUnit("hours");
    setTokenChoices([]);
    setSelectedTokenMint("");
    setSelectedTokenDecimals(0);
    setAutoState(nextMode === "AUTO" ? "idle" : "ready");
    setMintValidation({ status: "idle", message: "" });
    setAccountValidation({ status: "idle", message: "" });
    setManualMetadata(null);
    setManualMintDecimals(0);
  }

  function pickToken(choice: TokenChoice) {
    setSelectedTokenMint(choice.mint);
    setSelectedTokenDecimals(choice.decimals);
    setTokenMint(choice.mint);
    setAuthorityTokenAccount(choice.tokenAccount);
    setTokenName(choice.symbol || "TOKEN");
    setTotalSupply(Math.floor(choice.balanceUi).toString());
    setTokenMenuOpen(false);
  }

  function toBaseUnits(amount: string, decimals: number): bigint {
    const [wholeRaw, fractionRaw = ""] = amount.trim().split(".");
    const whole = wholeRaw === "" ? "0" : wholeRaw;
    if (!/^\d+$/.test(whole) || !/^\d*$/.test(fractionRaw)) {
      throw new Error("Total token supply must be a valid number");
    }
    const clampedFraction = fractionRaw.slice(0, decimals).padEnd(decimals, "0");
    const merged = `${whole}${clampedFraction}`.replace(/^0+(?=\d)/, "");
    return BigInt(merged === "" ? "0" : merged);
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
      const decimals = mode === "AUTO" ? selectedTokenDecimals : manualMintDecimals;
      const result = await createAuctionTx({
        wallet: toAnchorWallet(wallet),
        tokenMint: new PublicKey(tokenMint),
        authorityTokenAccount: new PublicKey(authorityTokenAccount),
        totalSupply: toBaseUnits(totalSupply, decimals),
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
                            {sanitizeImageUrl(choice.imageUri) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={sanitizeImageUrl(choice.imageUri) as string} alt={choice.symbol} className="h-7 w-7 rounded-full object-cover" />
                            ) : (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1f1f1f] text-[11px] text-[#c8892a]">
                                ◉
                              </span>
                            )}
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
                  <p className="mt-2 text-2xl">{selectedToken.name}</p>
                  <div className="mt-3 space-y-2 text-xs">
                    <p className="flex items-center justify-between gap-3 font-mono">
                      <span>Mint: {truncateAddress(selectedToken.mint, 4, 4)}</span>
                      <button
                        type="button"
                        className="button-outline rounded-[4px] px-2 py-1 text-[10px]"
                        onClick={() => navigator.clipboard.writeText(selectedToken.mint)}
                      >
                        copy
                      </button>
                    </p>
                    <p className="flex items-center justify-between gap-3 font-mono">
                      <span>Account: {truncateAddress(selectedToken.tokenAccount, 4, 4)}</span>
                      <button
                        type="button"
                        className="button-outline rounded-[4px] px-2 py-1 text-[10px]"
                        onClick={() => navigator.clipboard.writeText(selectedToken.tokenAccount)}
                      >
                        copy
                      </button>
                    </p>
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
              <input
                className={`input-dark text-sm ${
                  mintValidation.status === "invalid"
                    ? "border-[#7a2a2a]"
                    : mintValidation.status === "valid"
                      ? "border-[#2a7a4a]"
                      : ""
                }`}
                value={tokenMint}
                onChange={(event) => setTokenMint(event.target.value)}
                onBlur={() => validateMintField(tokenMint)}
              />
              {mintValidation.message ? (
                <p className={`text-xs ${mintValidation.status === "invalid" ? "text-[#d49d9d]" : "text-[#88c49f]"}`}>
                  {mintValidation.message}
                </p>
              ) : null}
              <label className="block text-xs text-[#6b6560]">Authority Token Account</label>
              <input
                className={`input-dark text-sm ${
                  accountValidation.status === "invalid"
                    ? "border-[#7a2a2a]"
                    : accountValidation.status === "valid"
                      ? "border-[#2a7a4a]"
                      : ""
                }`}
                value={authorityTokenAccount}
                onChange={(event) => setAuthorityTokenAccount(event.target.value)}
                onBlur={() => validateAccountField(authorityTokenAccount)}
              />
              {accountValidation.message ? (
                <p className={`text-xs ${accountValidation.status === "invalid" ? "text-[#d49d9d]" : "text-[#88c49f]"}`}>
                  {accountValidation.message}
                </p>
              ) : null}
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
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <input
                className="input-dark text-sm"
                placeholder="Custom duration"
                value={customDurationValue}
                onChange={(event) => setCustomDurationValue(event.target.value)}
              />
              <select
                className="input-dark text-sm"
                value={customDurationUnit}
                onChange={(event) => setCustomDurationUnit(event.target.value as "hours" | "days")}
              >
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </div>
          ) : null}

          <button type="submit" className="button-gold mt-4 w-full rounded-[4px] px-4 py-3 text-xs">
            Seal the Auction
          </button>
        </form>

        <aside className="surface p-5">
          <p className="text-xs text-[#6b6560]">Live Preview</p>
          <div className="mt-3 flex items-center gap-3">
            {sanitizeImageUrl(preview.tokenImageUri) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sanitizeImageUrl(preview.tokenImageUri) as string} alt={preview.tokenSymbol} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1f1f1f] text-xs text-[#c8892a]">◉</span>
            )}
            <div>
              <h2 className="text-4xl leading-none">{preview.tokenName || "TOKEN"}</h2>
              <p className="mt-1 text-xs text-[#6b6560]">{preview.tokenSymbol || "SYMBOL"}</p>
            </div>
          </div>
          <p className="mt-3 font-mono text-xs text-[#6b6560]">{preview.tokenMint ? truncateAddress(preview.tokenMint, 4, 4) : "mint-address"}</p>
          <p className="mt-6 font-mono text-xs">Min bid: {preview.minBidFloor || "0"} SOL</p>
          <p className="mt-2 font-mono text-xs">Supply: {preview.totalSupply || "0"}</p>
          <p className="mt-2 font-mono text-xs">Duration: {humanDuration(preview.effectiveDuration)}</p>
          <p className="mt-6 text-xs text-[#6b6560]">Truth surfaces at close.</p>
        </aside>
      </div>

      <ConfirmModal
        title="Confirm Auction Seal"
        description="You are about to seal this auction on-chain. This action is irreversible."
        open={showConfirm}
        confirmLabel="Confirm & Sign →"
        loading={loading}
        onClose={() => setShowConfirm(false)}
        onConfirm={sealAuction}
        rows={[
          { label: "Token", value: preview.tokenSymbol || tokenName },
          { label: "Mint", value: truncateAddress(tokenMint, 4, 4) },
          { label: "Supply", value: Number(totalSupply || 0).toLocaleString() },
          { label: "Min Bid Floor", value: `${minBidFloor} SOL` },
          { label: "Duration", value: humanDuration(effectiveDuration) },
          { label: "Closes at", value: closeAtUtc },
        ]}
      />
    </main>
  );
}
