"use client";

import Link from "next/link";
import WalletButton from "@/components/WalletButton";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#1e1e1e] bg-[#111111c7] backdrop-blur-md">
      <div className="page-shell flex flex-col items-start justify-between gap-3 py-3 sm:flex-row sm:items-center sm:py-4">
        <Link href="/" className="transition-soft hover:opacity-90">
          <p className="font-display text-[20px] tracking-[0.14em] sm:text-[22px] sm:tracking-[0.16em]">Aletheia</p>
          <p className="font-mono text-[10px] text-[#6b6560] sm:text-[11px]">Sealed-bid auctions on Solana</p>
        </Link>
        <div className="w-full sm:w-auto">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
