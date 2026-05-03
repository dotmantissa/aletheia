"use client";

import { useEffect, useMemo, useState } from "react";

export default function CountdownTimer({ endTime }: { endTime: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const display = useMemo(() => {
    const delta = Math.max(0, Math.floor((endTime - now) / 1000));
    const h = Math.floor(delta / 3600).toString().padStart(2, "0");
    const m = Math.floor((delta % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(delta % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [endTime, now]);

  return <div className="font-mono text-5xl text-[#f0ede8]">{display}</div>;
}
