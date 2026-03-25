# sol-escrow

Trustless token swap escrow on Solana. Two parties agree on an all-or-nothing SPL token exchange — no partial fills, no intermediaries.

Built with **Anchor** (Rust) and a **React + Vite** frontend.

[![CI](https://github.com/davigiroux/sol-escrow/actions/workflows/ci.yml/badge.svg)](https://github.com/davigiroux/sol-escrow/actions/workflows/ci.yml)

## How It Works

1. **Maker** creates an escrow offer — locks Token A in a PDA vault and specifies how much Token B they want in return.
2. **Taker** fills the offer — sends Token B to the maker, receives Token A from the vault. Both transfers happen atomically.
3. **Cancel** — the maker can cancel at any time to reclaim their locked tokens.

All state is stored in PDAs derived from deterministic seeds. Vault accounts are closed after each swap or cancellation, reclaiming rent back to the maker.

## Project Structure

```
programs/escrow/       Anchor Rust program (3 instructions)
packages/web/          React frontend (Vite + Tailwind + wallet-adapter)
tests/                 Integration tests (ts-mocha)
scripts/               Devnet end-to-end test script
.github/workflows/     CI pipeline
```

## Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Solana CLI](https://docs.solanalabs.com/cli/install) v2.3+
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) 0.32.x
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 10+

## Quick Start

```bash
# Install dependencies
pnpm install

# Build the program
anchor build

# Run integration tests (starts a local validator automatically)
anchor test
```

## Program

**Program ID:** `Huid51EyAoXC4M1XLDDL756pRmmZZ1D7XCD3rowxX4hq`

### Instructions

| Instruction      | Signer | Description                                            |
| ---------------- | ------ | ------------------------------------------------------ |
| `make_escrow`    | Maker  | Create an offer and lock Token A in a vault             |
| `take_escrow`    | Taker  | Fill the offer — atomic swap of Token A and Token B     |
| `cancel_escrow`  | Maker  | Cancel the offer and reclaim Token A from the vault     |

### Accounts

**Escrow PDA** — seeds: `[b"escrow", maker, seed]`
Stores offer details: mints, amounts, maker, bumps.

**Vault PDA** — seeds: `[b"vault", escrow]`
SPL Token account holding the maker's locked Token A, authority is the escrow PDA.

### Design

- Classic SPL Token (not Token-2022)
- All-or-nothing swaps — no partial fills
- Rent is reclaimed to the maker when escrow/vault accounts close
- `init_if_needed` on taker ATAs so takers don't need to pre-create token accounts

## Frontend

The React app lives in `packages/web/` and connects to **devnet**.

```bash
cd packages/web
pnpm install
pnpm dev
```

Features:
- Wallet connection via `@solana/wallet-adapter`
- Create new escrow offers
- Browse and fill open offers
- Cancel your own offers
- Toast notifications for transaction status

## Testing

### Local (localnet)

```bash
anchor test
```

Runs two test suites:
- **make + cancel** — verifies offer creation and refund
- **make + take** — verifies full atomic swap and balance correctness

### Devnet

```bash
npx ts-node scripts/devnet-test.ts
```

End-to-end test that creates wallets, mints tokens, and executes the full make-then-take flow on devnet.

## CI

GitHub Actions runs on every push/PR to `main`:
1. Install Rust, Solana CLI v2.3.0, Anchor 0.32.1, Node 20, pnpm
2. `anchor build`
3. `anchor test`

## License

MIT
