# Aletheia

Aletheia is a sealed-bid auction protocol for fair token launches on Solana. Every bid is encrypted before it touches chain state. The auction reveals only a single truth at close: the uniform clearing price and winner set.

## Why This Exists

Most token launches leak bidder intent in real time. Bots monitor order flow, whales signal price bands, and smaller participants get extracted before distribution even starts.

Aletheia fixes this by making bids unreadable throughout the auction window. No participant, operator, or validator can inspect individual bid values while the market is forming.

## How Arcium Is Used

Arcium is the confidential compute layer for settlement.

1. Bidders encrypt `(price, quantity)` locally with the Arcium cluster public key.
2. Encrypted payloads are stored on Solana through `submit_bid`.
3. After close, Arcium MPC decrypts and computes the uniform clearing price inside confidential execution.
4. Arcium returns only `(clearing_price, winner_pubkeys, proof)`.
5. The Anchor program verifies the Arcium-origin result before final settlement.

Without Arcium, this protocol collapses. Arcium is not an add-on; it is the trust layer.

## Privacy Guarantee

Arcium prevents:
- On-chain visibility of bid amount and quantity.
- Operator-side access to plaintext bids during auction.
- Bid-by-bid leakage in settlement output.

Aletheia only reveals aggregate outcome data needed for distribution.

## Architecture

```text
+-------------------+        encrypted bid         +----------------------+
| Wallet + Frontend | ---------------------------> | Solana Anchor Program|
| Next.js + SDK     |                              | stores ciphertexts    |
+---------+---------+                              +----------+-----------+
          |                                                     |
          | auction close                                       | ciphertext set
          v                                                     v
+------------------------+      proof + outcome      +----------------------+
| Arcium MPC Compute     | -------------------------> | settle_auction       |
| decrypt + clear price  |                           | verify + finalize    |
+-----------+------------+                           +----------+-----------+
            |                                                      |
            | winners / losers claim                               |
            v                                                      v
      token claim + SOL refund flows via on-chain checks and vault escrow
```

## Repository Layout

```text
aletheia/
├── programs/aletheia/src/lib.rs
├── arcium/circuit.rs
├── arcium/encryption.ts
├── app/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   └── lib/
├── tests/
├── Anchor.toml
├── Cargo.toml
└── package.json
```

## Local Setup

### Prerequisites

- Rust stable + Cargo
- Solana CLI (1.18+)
- Anchor CLI (0.30+)
- Node.js 20+
- npm 10+

### Install

```bash
npm install
npm --prefix app install
```

### Build

```bash
anchor build
npm run build
```

### Test

```bash
anchor test
npm --prefix app test
```

### Run Frontend

```bash
npm --prefix app run dev
```

## Deploy to Solana Devnet

1. Configure wallet and cluster.
```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 2
```
2. Build and deploy.
```bash
anchor build
anchor deploy --provider.cluster devnet
```
3. Set deployed program id in `.env`.

## Environment Variables

Create `app/.env.local`:

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_ALETHEIA_PROGRAM_ID=ALETHX1A1111111111111111111111111111111111
NEXT_PUBLIC_ARCIUM_ENDPOINT=https://devnet.arcium.example
```

## Protocol Notes

- All monetary values on-chain are stored in `u64` lamports.
- UI converts lamports to SOL only for presentation.
- Bids are sealed by design and never revealed individually.
