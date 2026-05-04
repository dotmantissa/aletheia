import { ARCIUM_ENDPOINT } from "./constants";

export interface ArciumClient {
  endpoint: string;
  publicKey: string;
}

let cache: ArciumClient | null = null;
let inflight: Promise<ArciumClient | null> | null = null;

async function fetchArciumClient(): Promise<ArciumClient | null> {
  try {
    if (!ARCIUM_ENDPOINT) {
      console.warn("NEXT_PUBLIC_ARCIUM_ENDPOINT not set");
      return null;
    }
    const res = await fetch(`${ARCIUM_ENDPOINT}/public-key`);
    if (!res.ok) {
      console.error("Arcium init failed: bad status", res.status);
      return null;
    }
    const data = (await res.json()) as { publicKey?: string };
    if (!data.publicKey) {
      console.error("Arcium init failed: missing public key in response");
      return null;
    }
    cache = { endpoint: ARCIUM_ENDPOINT, publicKey: data.publicKey };
    return cache;
  } catch (err) {
    console.error("Arcium init failed:", err);
    return null;
  }
}

export async function initArcium(): Promise<boolean> {
  if (cache) return true;
  if (inflight) {
    const client = await inflight;
    return Boolean(client);
  }
  inflight = fetchArciumClient();
  const client = await inflight;
  inflight = null;
  return Boolean(client);
}

export async function getArciumClient(): Promise<ArciumClient | null> {
  if (cache) return cache;
  await initArcium();
  return cache;
}

export function getCachedArciumPublicKey(): string {
  return cache?.publicKey ?? "";
}
