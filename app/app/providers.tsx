"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { RPC_URL } from "@/lib/constants";
import "@solana/wallet-adapter-react-ui/styles.css";

const ConnectionProviderCompat = ConnectionProvider as unknown as React.ComponentType<any>;
const WalletProviderCompat = WalletProvider as unknown as React.ComponentType<any>;
const WalletModalProviderCompat = WalletModalProvider as unknown as React.ComponentType<any>;

export default function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProviderCompat endpoint={RPC_URL}>
      <WalletProviderCompat wallets={wallets} autoConnect>
        <WalletModalProviderCompat>{children}</WalletModalProviderCompat>
      </WalletProviderCompat>
    </ConnectionProviderCompat>
  );
}
