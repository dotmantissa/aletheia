import dynamic from "next/dynamic";

const CreateAuctionClient = dynamic(() => import("@/components/CreateAuctionClient"), { ssr: false });

export default function Page() {
  return <CreateAuctionClient />;
}
