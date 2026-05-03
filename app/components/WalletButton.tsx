"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { truncateAddress } from "@/lib/format";

export default function WalletButton() {
  const { connected, publicKey } = useWallet();

  return (
    <WalletMultiButton
      className="!rounded-[4px] !border !border-[#c8892a] !bg-[#c8892a] !px-3 !py-2 !font-mono !text-xs !font-medium !text-[#14110a] hover:!border-[#e0a040] hover:!bg-[#e0a040]"
      startIcon={
        connected ? <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#2a7a4a]" /> : undefined
      }
    >
      {connected && publicKey ? truncateAddress(publicKey.toBase58(), 6, 4) : "Connect wallet to participate"}
    </WalletMultiButton>
  );
}
