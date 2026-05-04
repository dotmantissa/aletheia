export const NETWORK = "devnet";
export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const RPC_FALLBACK_URLS = [
  RPC_URL,
  "https://rpc.ankr.com/solana_devnet",
  "https://solana-devnet.g.alchemy.com/v2/demo",
].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);
export const PROGRAM_ID = process.env.NEXT_PUBLIC_ALETHEIA_PROGRAM_ID ?? "GT5NYsctT5vnR6U1o45Jk28KREtjho6EApuAbaMrVK8g";
export const ARCIUM_ENDPOINT = process.env.NEXT_PUBLIC_ARCIUM_ENDPOINT ?? "";

export const UI_COLORS = {
  bg: "#0a0a0a",
  text: "#f0ede8",
  accent: "#c8892a",
};
