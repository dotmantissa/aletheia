"use client";

import { create } from "zustand";

export type AuctionStatus = "LIVE" | "CLOSED" | "SETTLED";

export interface Auction {
  id: string;
  tokenName: string;
  tokenMint: string;
  totalSupply: bigint;
  minBidFloor: bigint;
  endTime: number;
  bidCount: number;
  status: AuctionStatus;
  clearingPrice?: bigint;
  winnerCount?: number;
  totalRaised?: bigint;
}

const mockAuctions: Auction[] = [
  {
    id: "atlas-001",
    tokenName: "ATLAS",
    tokenMint: "8f9Q6k3dEzg3o2h4L9C4SYh8nvbnW5WnH2f9A1wP3tDd",
    totalSupply: 1_000_000n,
    minBidFloor: 500_000_000n,
    endTime: Date.now() + 1000 * 60 * 60 * 5,
    bidCount: 14,
    status: "LIVE",
  },
  {
    id: "helios-002",
    tokenName: "HELIOS",
    tokenMint: "6T8w6D8hJ2b4nD8Tk9xw9H3v8B9vQ4L8x9wA3s4s1Q9t",
    totalSupply: 750_000n,
    minBidFloor: 300_000_000n,
    endTime: Date.now() - 1000 * 60 * 20,
    bidCount: 39,
    status: "CLOSED",
  },
  {
    id: "mnemos-003",
    tokenName: "MNEMOS",
    tokenMint: "2Nf7yNmK9a1v8Y7bJ5u2R6q4z1H8W2r4k9J3t5s1A0zB",
    totalSupply: 500_000n,
    minBidFloor: 400_000_000n,
    endTime: Date.now() - 1000 * 60 * 60 * 9,
    bidCount: 51,
    status: "SETTLED",
    clearingPrice: 740_000_000n,
    winnerCount: 12,
    totalRaised: 370_000_000_000n,
  },
];

interface AuctionStore {
  auctions: Auction[];
  hydrated: boolean;
  hydrateMock: () => void;
  upsertAuction: (auction: Auction) => void;
  byId: (id: string) => Auction | undefined;
}

export const useAuctionStore = create<AuctionStore>((set, get) => ({
  auctions: [],
  hydrated: false,
  hydrateMock: () =>
    set((state) => {
      if (state.hydrated) return state;
      return { auctions: mockAuctions, hydrated: true };
    }),
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
