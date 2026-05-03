"use client";

import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { PROGRAM_ID, RPC_URL } from "./constants";

const IDL = {
  version: "0.1.0",
  name: "aletheia",
  instructions: [],
} as anchor.Idl;

export function getConnection() {
  return new Connection(RPC_URL, "confirmed");
}

export function getProvider(wallet: anchor.Wallet) {
  return new anchor.AnchorProvider(getConnection(), wallet, { commitment: "confirmed" });
}

export function getProgram(wallet: anchor.Wallet): Program {
  const provider = getProvider(wallet);
  return new Program(IDL, new web3.PublicKey(PROGRAM_ID), provider);
}
