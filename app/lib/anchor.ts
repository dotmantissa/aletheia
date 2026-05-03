"use client";

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { PROGRAM_ID, RPC_URL } from "./constants";

const IDL = {
  address: PROGRAM_ID,
  metadata: {
    name: "aletheia",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [],
} as unknown as anchor.Idl;

export function getConnection() {
  return new Connection(RPC_URL, "confirmed");
}

export function getProvider(wallet: anchor.Wallet) {
  return new anchor.AnchorProvider(getConnection(), wallet, { commitment: "confirmed" });
}

export function getProgram(wallet: anchor.Wallet): Program {
  const provider = getProvider(wallet);
  return new Program(IDL, provider);
}
