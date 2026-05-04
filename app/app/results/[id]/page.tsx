import dynamic from "next/dynamic";

const ResultsClient = dynamic(() => import("@/components/ResultsClient"), { ssr: false });

export default function Page() {
  return <ResultsClient />;
}
