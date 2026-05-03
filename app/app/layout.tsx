import "./globals.css";
import Providers from "./providers";
import AppHeader from "@/components/AppHeader";

export const metadata = {
  title: "Aletheia",
  description: "Sealed-bid confidential auctions on Solana with Arcium MPC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
