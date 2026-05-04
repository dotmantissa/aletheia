import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    inputs?: Array<{ bidder?: string }>;
    params?: { totalSupply?: string };
  };

  const inputs = body.inputs ?? [];
  const uniqueBidders = Array.from(new Set(inputs.map((x) => x.bidder).filter(Boolean))) as string[];

  // Mock MPC result endpoint for devnet UX flow.
  const winners = uniqueBidders;
  const clearingPrice = "1";

  return NextResponse.json({
    clearingPrice,
    winners,
    arciumResultAccount: process.env.NEXT_PUBLIC_ARCIUM_RESULT_ACCOUNT ?? "11111111111111111111111111111111",
  });
}
