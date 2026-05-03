import { ARCIUM_ENDPOINT } from "./constants";

export interface ArciumClient {
  endpoint: string;
  publicKey: string;
}

let cache: ArciumClient | null = null;

export async function getArciumClient(): Promise<ArciumClient> {
  if (cache) return cache;
  if (!ARCIUM_ENDPOINT) {
    throw new Error("NEXT_PUBLIC_ARCIUM_ENDPOINT is required");
  }

  const res = await fetch(`${ARCIUM_ENDPOINT}/public-key`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Arcium key: ${res.status}`);
  }
  const data = (await res.json()) as { publicKey: string };
  if (!data.publicKey) throw new Error("Invalid Arcium public key response");

  cache = { endpoint: ARCIUM_ENDPOINT, publicKey: data.publicKey };
  return cache;
}
