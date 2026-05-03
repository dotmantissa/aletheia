"use client";

import { useEffect, useState } from "react";
import { getArciumClient } from "@/lib/arcium";

export function useArcium() {
  const [publicKey, setPublicKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    getArciumClient()
      .then((client) => setPublicKey(client.publicKey))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { publicKey, loading, error };
}
