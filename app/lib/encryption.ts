export type EncryptedBidBlob = Uint8Array;

interface BidPayload {
  amountLamports: string;
  quantity: string;
  nonce: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveKey(arciumPublicKey: string): Promise<CryptoKey> {
  if (!arciumPublicKey || arciumPublicKey.length < 32) {
    throw new Error("Invalid Arcium public key");
  }
  const seed = new TextEncoder().encode(arciumPublicKey);
  const hash = await crypto.subtle.digest("SHA-256", toArrayBuffer(seed));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptBid(
  amount: number,
  quantity: number,
  arciumPublicKey: string,
): Promise<EncryptedBidBlob> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number");
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive number");
  }

  const amountLamports = BigInt(Math.round(amount * 1_000_000_000));
  const qty = BigInt(Math.floor(quantity));

  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(arciumPublicKey);

  const payload: BidPayload = {
    amountLamports: amountLamports.toString(),
    quantity: qty.toString(),
    nonce: bytesToHex(nonce),
  };

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(nonce) }, key, toArrayBuffer(plaintext));
  const ciphertext = new Uint8Array(encrypted);

  const packed = new Uint8Array(nonce.length + ciphertext.length);
  packed.set(nonce, 0);
  packed.set(ciphertext, nonce.length);
  return packed;
}

export async function verifyEncryption(
  encryptedPayload: Uint8Array,
  arciumPublicKey: string,
): Promise<boolean> {
  try {
    if (encryptedPayload.length <= 12) {
      return false;
    }

    const nonce = encryptedPayload.subarray(0, 12);
    const ciphertext = encryptedPayload.subarray(12);
    const key = await deriveKey(arciumPublicKey);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(nonce) },
      key,
      toArrayBuffer(ciphertext),
    );

    const parsed = JSON.parse(new TextDecoder().decode(decrypted)) as BidPayload;
    return (
      typeof parsed.nonce === "string" &&
      hexToBytes(parsed.nonce).length === 12 &&
      BigInt(parsed.amountLamports) > 0n &&
      BigInt(parsed.quantity) > 0n
    );
  } catch {
    return false;
  }
}

export async function payloadHash(encryptedPayload: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(encryptedPayload));
  return bytesToHex(new Uint8Array(digest));
}
