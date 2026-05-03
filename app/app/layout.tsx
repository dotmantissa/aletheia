import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Aletheia",
  description: "Sealed-bid token launch auctions on Solana with Arcium MPC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
