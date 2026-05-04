import { NextResponse } from "next/server";

export async function GET() {
  const publicKey =
    process.env.ARCIUM_PUBLIC_KEY ||
    "aletheia-devnet-arcium-public-key";

  return NextResponse.json({ publicKey });
}
