import { ARCIUM_ENDPOINT } from "./constants";

export interface ArciumClient {
  endpoint: string;
  publicKey: string;
}

export interface ArciumComputationRequest {
  circuit: "clearing_price";
  inputs: Array<{ bidder: string; encryptedPayload: Uint8Array }>;
  params: { totalSupply: string };
}

export interface ArciumComputationResult {
  clearingPrice: string;
  winners: string[];
  arciumResultAccount?: string;
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

export async function submitComputation(
  client: ArciumClient,
  request: ArciumComputationRequest,
): Promise<ArciumComputationResult> {
  try {
    const res = await fetch(`${client.endpoint}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        circuit: request.circuit,
        inputs: request.inputs.map((x) => ({
          bidder: x.bidder,
          encryptedPayload: Array.from(x.encryptedPayload),
        })),
        params: request.params,
      }),
    });
    if (!res.ok) {
      throw new Error(`Arcium settle failed: ${res.status}`);
    }
    const data = (await res.json()) as ArciumComputationResult;
    if (!data?.clearingPrice || !Array.isArray(data?.winners)) {
      throw new Error("Invalid Arcium settlement response");
    }
    return data;
  } catch (err) {
    console.error("Arcium computation failed:", err);
    throw err;
  }
}
