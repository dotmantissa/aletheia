"use client";

import { create } from "zustand";

export type AuctionStatus = "LIVE" | "CLOSED" | "SETTLED";

export interface Auction {
  id: string;
  tokenMint: string;
  totalSupply: bigint;
  minBidFloor: bigint;
  endTime: number;
  bidCount: number;
  status: AuctionStatus;
  clearingPrice?: bigint;
  winnerCount?: number;
}

interface AuctionStore {
  auctions: Auction[];
  upsertAuction: (auction: Auction) => void;
  byId: (id: string) => Auction | undefined;
}

export const useAuctionStore = create<AuctionStore>((set, get) => ({
  auctions: [],
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
