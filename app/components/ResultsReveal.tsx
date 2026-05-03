"use client";

import { useEffect, useState } from "react";

interface ResultsRevealProps {
  clearingPriceSol: number;
  winnerCount: number;
  totalRaisedSol: number;
}

export default function ResultsReveal({ clearingPriceSol, winnerCount, totalRaisedSol }: ResultsRevealProps) {
  const [phase, setPhase] = useState<"hold" | "sweep" | "show">("hold");

  useEffect(() => {
    const hold = setTimeout(() => setPhase("sweep"), 1500);
    const reveal = setTimeout(() => setPhase("show"), 2600);
    return () => {
      clearTimeout(hold);
      clearTimeout(reveal);
    };
  }, []);

  return (
    <div className="relative overflow-hidden">
      {phase !== "show" ? <div className="absolute inset-0 z-10 bg-[#080808]" /> : null}

      {phase === "sweep" ? (
        <div className="absolute inset-0 z-20 overflow-hidden">
          <div className="h-8 w-full bg-[#c8892a] opacity-90" style={{ animation: "sweep-reveal 1100ms var(--ease-out) forwards" }} />
        </div>
      ) : null}

      <section className="surface p-8 text-center">
        <h2 className="reveal-up text-5xl" style={{ animationDelay: "80ms" }}>
          The truth has been revealed.
        </h2>

        <p className="reveal-up mt-8 font-mono text-6xl text-[#c8892a]" style={{ animationDelay: "260ms" }}>
          {clearingPriceSol.toFixed(4)} SOL
        </p>

        <div className="reveal-up mt-8 grid grid-cols-1 gap-3 text-xs text-[#6b6560] sm:grid-cols-2" style={{ animationDelay: "420ms" }}>
          <p>Total raised: <span className="font-mono text-[#f0ede8]">{totalRaisedSol.toFixed(4)} SOL</span></p>
          <p>Winners: <span className="font-mono text-[#f0ede8]">{winnerCount}</span></p>
        </div>

        <p className="reveal-up mt-8 text-xs italic text-[#6b6560]" style={{ animationDelay: "520ms" }}>
          Individual bids remain sealed — by design.
        </p>
      </section>
    </div>
  );
}
