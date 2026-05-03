"use client";

import Link from "next/link";
import AuctionCard from "@/components/AuctionCard";
import WalletButton from "@/components/WalletButton";
import { useAuctionStore } from "@/hooks/useAuction";

export default function HomePage() {
  const auctions = useAuctionStore((s) => s.auctions);

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl tracking-wide">Aletheia</h1>
        <WalletButton />
      </header>

      <div className="mb-6">
        <Link href="/create" className="inline-block px-4 py-2 bg-[#c8892a] text-black">Create Auction</Link>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {auctions.map((auction) => (
          <AuctionCard key={auction.id} auction={auction} />
        ))}
      </section>
    </main>
  );
}
