export function truncateAddress(address: string, head = 4, tail = 4) {
  if (!address) return "";
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

export function formatLamportsToSol(lamports: bigint) {
  return Number(lamports) / 1_000_000_000;
}
