"use client";

import Link from "next/link";
import WalletButton from "@/components/WalletButton";

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#1e1e1e] bg-[#111111c7] backdrop-blur-md">
      <div className="page-shell flex items-center justify-between gap-4 py-4">
        <Link href="/" className="transition-soft hover:opacity-90">
          <p className="font-display text-[22px] tracking-[0.16em]">Aletheia</p>
          <p className="font-mono text-[11px] text-[#6b6560]">Sealed-bid auctions on Solana</p>
        </Link>
        <WalletButton />
      </div>
    </header>
  );
}
