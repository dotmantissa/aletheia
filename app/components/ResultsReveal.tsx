"use client";

import { useEffect, useState } from "react";

export default function ResultsReveal({
  clearingPriceSol,
  winnerCount,
  totalRaisedSol,
}: {
  clearingPriceSol: number;
  winnerCount: number;
  totalRaisedSol: number;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`border border-[#232323] p-6 transition-all duration-500 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
      <p className="font-mono text-3xl text-[#c8892a]">{clearingPriceSol.toFixed(4)} SOL</p>
      <p className="mt-2">Clearing Price</p>
      <p className="mt-4 font-mono">Winners: {winnerCount}</p>
      <p className="font-mono">Total Raised: {totalRaisedSol.toFixed(4)} SOL</p>
    </div>
  );
}
