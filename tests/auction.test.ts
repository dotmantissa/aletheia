import { encryptBid, verifyEncryption } from "../arcium/encryption";

describe("encryption helpers", () => {
  it("encrypts and verifies a bid payload", () => {
    const pk = "arcium-devnet-public-key-material";
    const encrypted = encryptBid(1.25, 100, pk);
    expect(encrypted.length).toBeGreaterThan(0);
    expect(verifyEncryption(encrypted, pk)).toBe(true);
  });

  it("fails verification with wrong key", () => {
    const encrypted = encryptBid(2, 50, "key-one-32-bytes-minimum-material");
    expect(verifyEncryption(encrypted, "different-key-32-bytes-minimum")).toBe(false);
  });
});
