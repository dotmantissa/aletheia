"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import AuctionCard from "@/components/AuctionCard";
import { useAuctionStore } from "@/hooks/useAuction";

export default function HomePage() {
  const { connected } = useWallet();
  const auctions = useAuctionStore((s) => s.auctions);
  const hydrateMock = useAuctionStore((s) => s.hydrateMock);

  useEffect(() => {
    hydrateMock();
  }, [hydrateMock]);

  return (
    <main className="page-shell pb-20">
      <section className="relative mt-6 overflow-hidden border border-[#1e1e1e] bg-[#111111] p-8">
        <p className="pointer-events-none absolute left-6 top-[-70px] select-none font-display text-[250px] leading-none text-[#f0ede8] opacity-[0.04]">
          Α
        </p>
        <div className="relative z-10">
          <h1 className="reveal-up text-4xl leading-tight sm:text-5xl">
            Truth, sealed until the moment it must be known.
          </h1>
          <p className="reveal-up mt-4 max-w-3xl text-sm text-[#6b6560]" style={{ animationDelay: "80ms" }}>
            Encrypted bids. Confidential computation. Trustless settlement. No front-running. No collusion. No
            exceptions.
          </p>

          <div className="reveal-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: "150ms" }}>
            <a href="#auctions" className="button-outline rounded-[4px] px-4 py-2 text-xs">
              Browse Auctions
            </a>
            <Link
              href="/create"
              className="button-gold rounded-[4px] px-4 py-2 text-xs"
              aria-disabled={!connected}
              title={connected ? "" : "Connect your wallet to create an auction"}
              onClick={(event) => {
                if (!connected) event.preventDefault();
              }}
            >
              Create Auction
            </Link>
          </div>
        </div>
      </section>

      <section className="reveal-up mt-6 grid grid-cols-1 gap-3 border border-[#1e1e1e] bg-[#111111] p-4 text-xs sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: "220ms" }}>
        <p>Total Auctions Run: <span className="font-mono">148</span></p>
        <p>Total Volume Settled: <span className="font-mono">42,880 SOL</span></p>
        <p>Bids Processed: <span className="font-mono">8,129</span></p>
        <p>Powered by <span className="font-mono">Arcium MPC</span></p>
      </section>

      <section className="mt-16">
        <h2 className="text-3xl">How The Seal Works</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[
            {
              step: "01",
              title: "Seal",
              body: "Submit your encrypted bid. No one sees it. Not even us.",
            },
            {
              step: "02",
              title: "Wait",
              body: "Arcium's MPC cluster holds all bids in a confidential enclave until close.",
            },
            {
              step: "03",
              title: "Reveal",
              body: "At close, only the clearing price and winners emerge. Individual bids are never exposed.",
            },
          ].map((item, index) => (
            <article key={item.step} className="surface reveal-up relative overflow-hidden p-5" style={{ animationDelay: `${260 + index * 70}ms` }}>
              <p className="absolute right-4 top-0 font-display text-7xl leading-none text-[#f0ede8] opacity-[0.06]">{item.step}</p>
              <p className="font-mono text-xs text-[#6b6560]">Step {item.step}</p>
              <h3 className="mt-2 text-2xl">{item.title}</h3>
              <p className="mt-3 text-xs text-[#6b6560]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-16 border border-[#1e1e1e] bg-[#111111] p-6">
        <h2 className="text-3xl">Without Arcium, this protocol does not exist.</h2>
        <p className="mt-3 max-w-3xl text-xs text-[#6b6560]">
          If bids were visible on-chain, MEV bots could react in real time and collusion would become trivial. Arcium
          is not an accessory here. It is the trust layer that preserves concealment until truth is due.
        </p>
        <a href="https://arcium.com" target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs text-[#c8892a] transition-soft hover:text-[#e0a040]">
          Arcium MPC Network
        </a>
      </section>

      <section id="auctions" className="mt-16">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl">Active Auctions</h2>
          <Link
            href="/create"
            className="button-gold rounded-[4px] px-4 py-2 text-xs"
            aria-disabled={!connected}
            title={connected ? "" : "Connect your wallet to create an auction"}
            onClick={(event) => {
              if (!connected) event.preventDefault();
            }}
          >
            Create Auction
          </Link>
        </div>

        {auctions.length === 0 ? (
          <div className="surface mt-6 p-8 text-center">
            <p className="text-lg font-display">No auctions are live. The oracle is quiet.</p>
            <Link
              href="/create"
              className="button-outline mt-4 inline-flex rounded-[4px] px-4 py-2 text-xs"
              aria-disabled={!connected}
              onClick={(event) => {
                if (!connected) event.preventDefault();
              }}
            >
              Create Auction
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {auctions.map((auction, index) => (
              <div key={auction.id} className="reveal-up" style={{ animationDelay: `${320 + index * 80}ms` }}>
                <AuctionCard auction={auction} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
