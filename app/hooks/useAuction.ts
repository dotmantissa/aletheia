"use client";

import { create } from "zustand";
import { PublicKey } from "@solana/web3.js";
import { getConnection, parseProgramId } from "@/lib/anchor";

export type AuctionStatus = "LIVE" | "CLOSED" | "SETTLED";

export interface Auction {
  id: string;
  authority: string;
  tokenName: string;
  tokenMint: string;
  totalSupply: bigint;
  minBidFloor: bigint;
  endTime: number;
  bidCount: number;
  status: AuctionStatus;
  isSettled: boolean;
  clearingPrice?: bigint;
  winnerCount?: number;
  totalRaised?: bigint;
  winners?: string[];
}

const mockAuctions: Auction[] = [
  {
    id: "atlas-001",
    authority: "11111111111111111111111111111111",
    tokenName: "ATLAS",
    tokenMint: "8f9Q6k3dEzg3o2h4L9C4SYh8nvbnW5WnH2f9A1wP3tDd",
    totalSupply: 1_000_000n,
    minBidFloor: 500_000_000n,
    endTime: Date.now() + 1000 * 60 * 60 * 5,
    bidCount: 14,
    status: "LIVE",
    isSettled: false,
  },
  {
    id: "helios-002",
    authority: "11111111111111111111111111111111",
    tokenName: "HELIOS",
    tokenMint: "6T8w6D8hJ2b4nD8Tk9xw9H3v8B9vQ4L8x9wA3s4s1Q9t",
    totalSupply: 750_000n,
    minBidFloor: 300_000_000n,
    endTime: Date.now() - 1000 * 60 * 20,
    bidCount: 39,
    status: "CLOSED",
    isSettled: false,
  },
  {
    id: "mnemos-003",
    authority: "11111111111111111111111111111111",
    tokenName: "MNEMOS",
    tokenMint: "2Nf7yNmK9a1v8Y7bJ5u2R6q4z1H8W2r4k9J3t5s1A0zB",
    totalSupply: 500_000n,
    minBidFloor: 400_000_000n,
    endTime: Date.now() - 1000 * 60 * 60 * 9,
    bidCount: 51,
    status: "SETTLED",
    isSettled: true,
    clearingPrice: 740_000_000n,
    winnerCount: 12,
    totalRaised: 370_000_000_000n,
  },
];

function readU64(bytes: Uint8Array, offset: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(offset, true);
}

function readI64(bytes: Uint8Array, offset: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigInt64(offset, true);
}

interface AuctionStore {
  auctions: Auction[];
  hydrated: boolean;
  hydrateFromChain: () => Promise<void>;
  upsertAuction: (auction: Auction) => void;
  byId: (id: string) => Auction | undefined;
}

export const useAuctionStore = create<AuctionStore>((set, get) => ({
  auctions: [],
  hydrated: false,
  hydrateFromChain: async () => {
    try {
      const connection = getConnection();
      const programId = parseProgramId();
      const accounts = await connection.getProgramAccounts(programId);
      const next: Auction[] = [];

      for (const entry of accounts) {
        // Minimum size check for AuctionState account layout.
        if (entry.account.data.length < 8 + 2 + 32 * 4 + 8 * 6 + 1 + 4) continue;
        const data = entry.account.data.subarray(8); // skip discriminator
        let offset = 0;
        offset += 1; // bump
        offset += 1; // vault_authority_bump
        const auctionId = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
        offset += 32;
        const authority = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
        offset += 32;
        const tokenMint = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
        offset += 32;
        offset += 32; // token_vault
        const totalSupply = readU64(data, offset);
        offset += 8;
        const minBidFloor = readU64(data, offset);
        offset += 8;
        offset += 8; // start_time i64
        const endTs = Number(readI64(data, offset));
        offset += 8;
        const isSettled = data[offset] === 1;
        offset += 1;
        const clearingPrice = readU64(data, offset);
        offset += 8;
        const winnerCount = Number(readU64(data, offset));
        offset += 8;
        const bidCount = Number(readU64(data, offset));
        const endTime = endTs * 1000;
        const status: AuctionStatus = isSettled ? "SETTLED" : endTime > Date.now() ? "LIVE" : "CLOSED";
        const winners: string[] = [];
        if (offset + 4 <= data.length) {
          const vecLen = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true);
          offset += 4;
          for (let i = 0; i < vecLen; i += 1) {
            if (offset + 32 > data.length) break;
            winners.push(new PublicKey(data.subarray(offset, offset + 32)).toBase58());
            offset += 32;
          }
        }

        next.push({
          id: auctionId,
          authority,
          tokenName: `TOKEN-${tokenMint.slice(0, 4)}`,
          tokenMint,
          totalSupply,
          minBidFloor,
          endTime,
          bidCount,
          status,
          isSettled,
          clearingPrice,
          winnerCount,
          totalRaised: isSettled ? clearingPrice * BigInt(winnerCount) : 0n,
          winners,
        });
      }

      set({ auctions: next, hydrated: true });
    } catch {
      set((state) => ({
        auctions: state.auctions.length === 0 ? mockAuctions : state.auctions,
        hydrated: true,
      }));
    }
  },
  upsertAuction: (auction) =>
    set((state) => {
      const ix = state.auctions.findIndex((a) => a.id === auction.id);
      if (ix === -1) return { auctions: [auction, ...state.auctions] };
      const copy = [...state.auctions];
      copy[ix] = auction;
      return { auctions: copy };
    }),
  byId: (id) => get().auctions.find((a) => a.id === id),
}));
