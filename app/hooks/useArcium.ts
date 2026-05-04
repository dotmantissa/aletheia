"use client";

import { useEffect, useState } from "react";
import { getArciumClient, initArcium } from "@/lib/arcium";

export function useArcium() {
  const [publicKey, setPublicKey] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 3;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tryInit() {
      setLoading(true);
      const success = await initArcium();
      if (cancelled) return;
      if (success) {
        const client = await getArciumClient();
        setPublicKey(client?.publicKey ?? "");
        setReady(true);
        setLoading(false);
        return;
      }
      attempts += 1;
      setReady(false);
      setLoading(false);
      if (attempts < maxAttempts) {
        timer = setTimeout(tryInit, 5000);
      }
    }

    tryInit();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { publicKey, loading, ready };
}
