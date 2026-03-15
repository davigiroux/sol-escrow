# sol-escrow

Solana token swap escrow — Anchor program + React frontend monorepo.

## Stack

- **Program**: Rust / Anchor 0.32.x
- **Frontend**: React + Vite + Tailwind + @solana/wallet-adapter
- **Tests**: ts-mocha + @coral-xyz/anchor (integration tests in `tests/`)
- **CI**: GitHub Actions

## Commands

```bash
anchor build          # compile program
anchor test           # build + run local validator + tests
pnpm install          # install JS deps
```

## Structure

- `programs/escrow/` — Anchor Rust program
- `packages/web/` — React frontend (Phase 3+)
- `tests/` — Anchor integration tests (TypeScript)

## Conventions

- Program ID: `Huid51EyAoXC4M1XLDDL756pRmmZZ1D7XCD3rowxX4hq`
- PDAs: escrow state seeded `[b"escrow", maker, seed]`, vault seeded `[b"vault", escrow]`
- Classic SPL Token (not Token-2022)
- All-or-nothing swaps (no partial fills)
