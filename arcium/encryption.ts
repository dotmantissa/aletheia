import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export type EncryptedBidBlob = Uint8Array;

interface BidPayload {
  amountLamports: bigint;
  quantity: bigint;
  nonce: string;
}

function normalizeClusterKey(arciumPublicKey: string): Buffer {
  if (!arciumPublicKey || arciumPublicKey.length < 32) {
    throw new Error("Invalid Arcium public key");
  }
  return createHash("sha256").update(arciumPublicKey).digest();
}

export function encryptBid(
  amount: number,
  quantity: number,
  arciumPublicKey: string,
): EncryptedBidBlob {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive number");
  }

  const amountLamports = BigInt(Math.round(amount * 1_000_000_000));
  const qty = BigInt(Math.floor(quantity));

  const nonce = randomBytes(12);
  const key = normalizeClusterKey(arciumPublicKey);

  const payload: BidPayload = {
    amountLamports,
    quantity: qty,
    nonce: nonce.toString("hex"),
  };

  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const packed = Buffer.concat([nonce, authTag, encrypted]);
  return new Uint8Array(packed);
}

export function verifyEncryption(
  encryptedPayload: Uint8Array,
  arciumPublicKey: string,
): boolean {
  try {
    const packed = Buffer.from(encryptedPayload);
    if (packed.length <= 28) {
      return false;
    }

    const nonce = packed.subarray(0, 12);
    const authTag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);

    const key = normalizeClusterKey(arciumPublicKey);
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    const parsed = JSON.parse(decrypted.toString("utf8")) as BidPayload;
    return (
      typeof parsed.nonce === "string" &&
      BigInt(parsed.amountLamports) > 0n &&
      BigInt(parsed.quantity) > 0n
    );
  } catch {
    return false;
  }
}

export function payloadHash(encryptedPayload: Uint8Array): string {
  return createHash("sha256").update(Buffer.from(encryptedPayload)).digest("hex");
}
