import dynamic from "next/dynamic";

const AuctionDetailClient = dynamic(() => import("@/components/AuctionDetailClient"), { ssr: false });

export default function Page() {
  return <AuctionDetailClient />;
}
