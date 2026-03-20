# SolEscrow — Study Guide

This guide covers what to learn before and during each phase of building an escrow program on Solana using Anchor. The format mirrors your BaseVault study guide: learn just enough to do the work, then deepen as you build.

---

## Before You Start: Mental Model

Solana's programming model is fundamentally different from the EVM. If BaseVault taught you "storage slots and mappings," Solana will teach you "accounts and ownership." Here are the key shifts:

**Everything is an account.** Programs, user wallets, token balances, your escrow state — all of them are accounts in Solana's global state. A program doesn't have internal storage like a Solidity contract. Instead, it reads and writes to external accounts that are passed into each transaction.

**Programs don't own data by default.** A Solana program can only modify accounts it owns. When your escrow program creates an account to hold state, that account's "owner" field is set to your program's ID. The program can then read/write to it. This is very different from EVM where the contract's storage is implicit.

**Program Derived Addresses (PDAs) replace mappings.** In Solidity, you'd use `mapping(address => uint256)` to associate data with a user. On Solana, you derive a deterministic address from seeds (like the user's pubkey + a label) using `Pubkey::find_program_address`. This PDA becomes the address of an account your program controls. PDAs are the single most important Solana concept — you'll use them for the escrow vault and the escrow state account.

**Transactions declare all accounts upfront.** Unlike EVM where a function can access any storage slot, a Solana transaction must list every account it will read or write. Anchor automates most of this with its `#[derive(Accounts)]` macro, but understanding why helps you debug when things go wrong.

**Rent and space allocation.** Every account on Solana costs rent (lamports proportional to the data size). Below a threshold, accounts are garbage collected. Most programs pay for "rent exemption" upfront — enough lamports that the account lives forever. Anchor handles this with the `init` constraint, but you need to calculate `space` correctly.

Keep all this in mind: the escrow project is specifically chosen to exercise PDAs, Cross-Program Invocations (CPIs), and token account management — the three pillars you'll need for the hackathon.

---

## Phase 1 — Tooling & Rust Basics

### What You Need to Understand

**Rust survival skills.** You don't need to master Rust. You need to be comfortable with: `struct` definitions, `impl` blocks, `enum` variants, `Result<T, E>` error handling, references (`&` and `&mut`), and basic pattern matching. Anchor's macros hide most of the complexity, but you'll read compiler errors in Rust, so familiarity matters.

**Anchor project anatomy.** `programs/` contains your Rust program code. `tests/` has TypeScript integration tests. `Anchor.toml` is the config (cluster, program ID, wallet path). `target/` holds build artifacts including the IDL (Interface Description Language) — Solana's equivalent of an ABI.

**The Anchor development loop.** `anchor build` compiles your program. `anchor test` spins up a local validator, deploys, runs TypeScript tests, then tears down. `anchor deploy` pushes to a live cluster. This is your build-test-deploy cycle.

**Solana CLI basics.** `solana config set --url devnet` switches clusters. `solana airdrop 5` gives you devnet SOL. `solana balance` checks your wallet. `solana-keygen new` creates a wallet.

### Where to Study

- **Rust survival (first 9 chapters)** — https://doc.rust-lang.org/book/ — Chapters 1-6 are essential. Chapters 7-9 (modules, collections, error handling) are good to skim. Skip lifetimes deep dives for now.
- **Rust Survival Guide video** — Search "Rust Survival Guide" on YouTube — A condensed alternative if you prefer video.
- **Anchor official docs (installation)** — https://www.anchor-lang.com/docs — Follow the installation guide. Make sure `anchor --version`, `solana --version`, and `rustc --version` all work.
- **Solana docs (Anchor CLI basics)** — https://solana.com/docs/intro/installation/anchor-cli-basics — Covers `anchor init`, `anchor build`, `anchor test`, `anchor deploy`.
- **Helius: Beginner's Guide to Anchor** — https://www.helius.dev/blog/an-introduction-to-anchor-a-beginners-guide-to-building-solana-programs — Comprehensive single-page walkthrough covering macros, account types, constraints, PDAs, and CPIs. This is the best single resource for Phase 1.
- **Solana Cookbook** — https://solanacookbook.com — Quick reference for common patterns. Bookmark it.
- **Solana Playground** — https://beta.solpg.io — Browser-based IDE. Good for quick experiments without local setup.

### Practical Exercise Before Coding

Install the full toolchain: Rust, Solana CLI, Anchor CLI. Run `anchor init hello-solana && cd hello-solana && anchor test`. If the default counter program compiles, deploys to localnet, and tests pass, your environment is ready. Then modify the counter to add a `decrement` instruction and make the test pass. This forces you through the full edit-build-test loop once before touching the escrow.

---

## Phase 2 — Solana Account Model & PDAs

### What You Need to Understand

**Account structure.** Every Solana account has: a public key (its address), a lamport balance, an owner (the program that can modify it), data (a byte array), and an `executable` flag. Your escrow program will create accounts to store escrow state — the data field holds a serialized Rust struct.

**PDAs (Program Derived Addresses).** A PDA is an address derived from seeds and a program ID that has no corresponding private key. This means no human can sign for it — only your program can authorize operations on it. In the escrow, you'll derive a PDA for the vault (which holds tokens) and for the escrow state account.

In Anchor, you declare a PDA with:
```rust
#[account(
    init,
    payer = maker,
    space = 8 + EscrowState::INIT_SPACE,
    seeds = [b"escrow", maker.key().as_ref(), &id.to_le_bytes()],
    bump
)]
pub escrow: Account<'info, EscrowState>,
```

The `seeds` define uniqueness. The `bump` is a single byte that makes the address fall off the ed25519 curve (ensuring no private key exists). Anchor finds and stores the bump automatically.

**Space calculation.** You must tell Solana how many bytes your account needs. The formula is `8` (Anchor discriminator) + the size of your struct. For a struct with a `Pubkey` (32 bytes), a `u64` (8 bytes), and a `u8` (1 byte), the total is `8 + 32 + 8 + 1 = 49`. Anchor's `#[derive(InitSpace)]` macro can calculate this for you.

**Account constraints in Anchor.** `init` creates a new account. `mut` marks an account as writable. `has_one = field` validates that an account matches a stored pubkey. `constraint = expr` adds custom validation. `close = target` closes an account and sends its lamports to `target`. You'll use all of these in the escrow.

**SPL Token accounts.** Solana's token system is a separate program (the SPL Token Program). Each token balance is stored in a Token Account, which is an account owned by the Token Program containing: the mint (which token), the owner (who controls it), and the amount. The escrow will create a vault Token Account controlled by a PDA.

### Where to Study

- **Solana docs: Accounts and PDAs** — https://solana.com/docs/core/accounts — Start here. Read "Accounts" and "Program Derived Addresses" sections.
- **Anchor: Account Constraints** — https://www.anchor-lang.com/docs/account-constraints — The reference for `init`, `mut`, `seeds`, `bump`, `has_one`, `close`, etc.
- **Solidity-to-Solana mental model** — Think of PDAs as `mapping(key => struct)` where the "key" is derived from seeds, and the "struct" is a separate account. Think of `init` as `new` + storage allocation combined.
- **SPL Token overview** — https://spl.solana.com/token — Skim the concepts: Mint, Token Account, Associated Token Account. You don't need to know the low-level details — Anchor's `anchor_spl` crate handles it.
- **Anchor Escrow 2025 repo** — https://github.com/mikemaccana/anchor-escrow-2025 — Don't copy the code yet. Read the README and the animated explanation to understand the flow.

### Practical Exercise Before Coding

In Solana Playground or locally, create a program that: (1) initializes a PDA account with `seeds = [b"my-data", user.key().as_ref()]`, (2) stores a `u64` value in it, (3) has a second instruction that reads and increments that value. Write a test that calls both instructions. This confirms you understand PDA derivation and account creation before adding token complexity.

---

## Phase 3 — Escrow Program (Make Offer)

### What You Need to Understand

**The escrow flow.** Two parties want to swap tokens. The Maker creates an offer: "I'll give X of Token A and I want Y of Token B." The Maker's Token A gets locked in a vault (a PDA-controlled token account). A Taker can later accept the offer by sending Token B to the Maker and receiving Token A from the vault.

**Cross-Program Invocations (CPIs).** Your escrow program doesn't implement token transfers itself — it calls the SPL Token Program via a CPI. Anchor provides `transfer_checked` from `anchor_spl::token_interface` which handles this. When transferring from a PDA-owned vault, you pass signer seeds so the Token Program knows your program authorized it.

**`anchor_spl` crate.** This gives you Anchor-aware wrappers for the SPL Token Program: `Mint`, `TokenAccount`, `TokenInterface`, `AssociatedToken`, and CPI helpers like `transfer_checked` and `close_account`. Import from `anchor_spl::token_interface` for Token-2022 compatibility.

**The `make_offer` instruction.** It needs these accounts: the maker (signer + payer), the mint for Token A, the mint for Token B, the maker's Token A account (source), a vault Token Account (initialized as PDA, receives Token A), the escrow state account (PDA, stores offer details), the token program, the associated token program, and the system program.

**Escrow state struct.** At minimum:
```rust
#[account]
#[derive(InitSpace)]
pub struct EscrowState {
    pub maker: Pubkey,        // 32 bytes
    pub mint_a: Pubkey,       // 32 bytes
    pub mint_b: Pubkey,       // 32 bytes
    pub amount_offered: u64,  // 8 bytes
    pub amount_wanted: u64,   // 8 bytes
    pub bump: u8,             // 1 byte
}
```

### Where to Study

- **Anchor Escrow 2025 (code)** — https://github.com/mikemaccana/anchor-escrow-2025 — Now read the `programs/escrow/src/` directory. Study how `make_offer` is structured.
- **QuickNode: Transfer SOL and SPL Tokens with Anchor** — https://www.quicknode.com/guides/solana-development/anchor/transfer-tokens — Walks through CPIs for both SOL and SPL tokens.
- **Medium: Escrow Contract on Solana with Anchor** — https://medium.com/@kirtiraj22/the-ultimate-guide-to-building-an-escrow-contract-on-solana-with-anchor-ceca1811bfd2 — Step-by-step breakdown of make_offer and take_offer.
- **Anchor SPL token_interface** — https://docs.rs/anchor-spl/latest/anchor_spl/token_interface/index.html — Rust docs for the CPI helpers.

### Practical Exercise Before Coding

Before writing the full `make_offer`, write a minimal program that: creates a PDA-owned token account (vault), transfers SPL tokens from the signer into it via CPI, and stores the amount in a state account. This isolates the CPI + PDA signing pattern, which is the hardest part of the escrow.

---

## Phase 4 — Escrow Program (Take Offer & Cancel)

### What You Need to Understand

**The `take_offer` instruction.** The Taker sends Token B to the Maker's token account and receives Token A from the vault. Two CPIs happen: (1) Taker → Maker for Token B, (2) Vault → Taker for Token A. The second transfer requires PDA signer seeds because the vault is owned by a PDA. After both transfers, the vault and escrow state accounts are closed, returning rent to the Maker.

**PDA signing for CPIs.** When your program needs to "sign" a CPI on behalf of a PDA, you pass the seeds + bump as `signer_seeds` to the CPI context. This is how the Token Program knows the transfer from the vault is authorized.

```rust
let signer_seeds: &[&[&[u8]]] = &[&[
    b"escrow",
    escrow.maker.as_ref(),
    &escrow.id.to_le_bytes(),
    &[escrow.bump],
]];
```

**Closing accounts.** Anchor's `close = target` constraint transfers all remaining lamports from the account to `target` and zeros out the data. Use this for both the vault token account (`close_account` CPI) and the escrow state account (`close` constraint).

**The `cancel` instruction (refund).** The Maker should be able to cancel an unclaimed offer. This returns Token A from the vault to the Maker and closes both accounts. It's essentially the same as `take_offer` minus the Token B transfer.

**Testing with SPL tokens.** In your TypeScript tests, you'll need to: create mints, create associated token accounts, mint tokens to test accounts, then call your program. The `@solana/spl-token` and `@solana/web3.js` packages handle this. The Anchor Escrow 2025 repo has a complete test file you can reference.

### Where to Study

- **Anchor Escrow 2025 (tests)** — https://github.com/mikemaccana/anchor-escrow-2025 — Read the test file. It shows the full setup: mint creation, token account creation, airdrop, and instruction calls.
- **Solana Cookbook: PDA Signing** — https://solanacookbook.com/references/programs.html — Look for the CPI with PDA signer section.
- **Anchor Book: CPIs** — https://www.anchor-lang.com/docs/cross-program-invocations — Official docs on how Anchor handles CPIs.
- **@solana/spl-token npm** — https://www.npmjs.com/package/@solana/spl-token — Reference for the TypeScript helpers you'll use in tests.

### Practical Exercise Before Coding

Before building `take_offer`, add a second instruction to your Phase 3 exercise that transfers tokens back out of the PDA vault to a specified recipient. This forces you to get PDA signing working. If you can move tokens in and out of a PDA, the escrow's take and cancel instructions are just combining those operations with state management.

---

## Phase 5 — React Frontend

### What You Need to Understand

**Solana wallet-adapter.** This is the React equivalent of RainbowKit/ConnectKit for Ethereum. It provides `ConnectionProvider`, `WalletProvider`, and `WalletModalProvider` — three nested context providers. The `WalletMultiButton` component gives you a ready-made connect/disconnect button supporting Phantom, Solflare, Backpack, and others.

**@solana/web3.js and the Connection object.** `Connection` is how your frontend talks to a Solana RPC node. You pass a devnet URL to `ConnectionProvider`, and every hook under it can make RPC calls.

**Anchor client in the browser.** The `@coral-xyz/anchor` package provides a `Program` class. You initialize it with your IDL (auto-generated by `anchor build`) and a wallet provider. Then you call instructions like `program.methods.makeOffer(id, amountA, amountB).accounts({...}).rpc()`. Anchor resolves PDAs automatically if your IDL is correct.

**Transaction confirmation UX.** Solana transactions confirm in ~400ms on devnet. Still, you need loading states. The pattern is: user clicks → wallet popup → user signs → tx sent → wait for confirmation → update UI. The `useWallet` hook gives you the connected wallet, and `program.methods.xxx().rpc()` returns a transaction signature you can await.

**Associated Token Accounts.** When displaying balances or preparing transactions, you'll need the user's Associated Token Account (ATA) for each mint. The `getAssociatedTokenAddress` utility derives the correct address deterministically.

### Where to Study

- **Solana wallet-adapter (official)** — https://github.com/anza-xyz/wallet-adapter/blob/master/APP.md — Setup guide for React. Copy the provider structure.
- **Solana Cookbook: Connect Wallet React** — https://solana.com/developers/cookbook/wallets/connect-wallet-react — Step-by-step React wallet connection.
- **QuickNode: Solana Wallet Adapter & Scaffold** — https://www.quicknode.com/guides/solana-development/dapps/how-to-connect-users-to-your-dapp-with-the-solana-wallet-adapter-and-scaffold — Comprehensive guide with a scaffold template.
- **@coral-xyz/anchor npm** — https://www.npmjs.com/package/@coral-xyz/anchor — The Anchor TypeScript client for calling your program.
- **Solana dApp Scaffold** — https://github.com/solana-labs/dapp-scaffold — A Next.js starter with wallet-adapter pre-configured. Good base to fork.

### Practical Exercise Before Coding

Fork or clone the Solana dApp Scaffold. Connect your Phantom wallet on devnet. Display your SOL balance and list your token accounts. If you can read on-chain data and render it in React, you're ready to build the escrow UI.

---

## Phase 6 — Devnet Deployment & Polish

### What You Need to Understand

**Deploying to devnet.** Update `Anchor.toml` to set `cluster = "devnet"` and configure your wallet path. Run `anchor build`, then `anchor deploy`. Your program gets a unique Program ID. Fund your wallet with `solana airdrop 5` (devnet has a 5 SOL limit per request).

**Program upgrades.** Unlike EVM where contracts are immutable by default, Solana programs are upgradeable by default. The deployer wallet is the "upgrade authority." For a learning project this is fine. For production you'd either freeze or transfer the authority.

**Verifying your program.** Solana doesn't have a Basescan-like auto-verify flow yet. You can use `anchor verify` or publish your IDL with `anchor idl init`. The Solana Explorer at https://explorer.solana.com shows your program's transactions and accounts.

**Testing on devnet with real wallets.** After deploying, create test SPL tokens on devnet, make an offer from one wallet, and take it from another. This end-to-end flow catches issues that localnet testing misses (RPC latency, transaction fees, wallet UX).

### Where to Study

- **Anchor deploy docs** — https://www.anchor-lang.com/docs — Deployment section covers `Anchor.toml` config.
- **Solana Explorer** — https://explorer.solana.com/?cluster=devnet — Inspect your deployed program and transactions.
- **Solana devnet faucet** — Run `solana airdrop 5` from CLI (more reliable than web faucets).

### Practical Exercise Before Coding

Deploy the escrow program to devnet. Using the CLI or a minimal script, create two token mints, mint tokens to two different wallets, and execute a full make-offer → take-offer flow. Confirm on the Solana Explorer that the vault was created, tokens moved, and accounts closed. This is your "it works on a real network" checkpoint.

---

## General Resources to Bookmark

- **Anchor official docs** — https://www.anchor-lang.com/docs — The authoritative Anchor reference.
- **Solana official docs** — https://solana.com/docs — Core concepts, RPC API, cookbook.
- **Solana Cookbook** — https://solanacookbook.com — Quick reference for common Solana patterns.
- **Helius blog** — https://www.helius.dev/blog — High-quality Solana technical articles.
- **Anchor Escrow 2025** — https://github.com/mikemaccana/anchor-escrow-2025 — Reference implementation, always up to date.
- **Solana Playground** — https://beta.solpg.io — Browser IDE for quick experiments.
- **Solana Explorer** — https://explorer.solana.com — Transaction and account inspector.
- **Solana Stack Exchange** — https://solana.stackexchange.com — Community Q&A, most beginner issues answered.
- **Rust Book** — https://doc.rust-lang.org/book/ — When you hit a Rust concept you don't understand.

---

## EVM → Solana Cheat Sheet

| EVM Concept | Solana Equivalent |
|---|---|
| Contract storage | Accounts (external, passed in) |
| `mapping(key => value)` | PDA derived from seeds |
| `msg.sender` | `ctx.accounts.signer.key()` |
| `msg.value` | Lamport transfers via System Program CPI |
| Constructor | `initialize` instruction |
| ABI | IDL (Interface Description Language) |
| `require(condition)` | Anchor `constraint = condition` or `require!()` |
| Custom errors | `#[error_code] enum ErrorCode { ... }` |
| Events | Anchor `emit!()` macro |
| ERC-20 | SPL Token (separate program) |
| `approve` + `transferFrom` | CPI to Token Program with delegate or PDA signer |
| ethers.js / viem | @solana/web3.js + @coral-xyz/anchor |
| wagmi hooks | @solana/wallet-adapter-react hooks |
| RainbowKit / ConnectKit | WalletMultiButton from wallet-adapter |
| Foundry `forge test` | `anchor test` (TypeScript tests) |
| Basescan | Solana Explorer |

---

## Recommended Study Rhythm

At 4-6 hours/week with ~3 weeks before the hackathon:

**Week 1 — Phases 1 & 2.** Tooling setup, Rust basics, account model, PDAs. By end of week: you can create PDA accounts and read/write to them.

**Week 2 — Phases 3 & 4.** Escrow program: make_offer, take_offer, cancel. By end of week: all instructions work with `anchor test` passing on localnet.

**Week 3 — Phases 5 & 6.** Frontend + devnet deployment. By end of week: a working dApp where you can make and take offers via a browser.

Same session pattern as BaseVault:

**Session A:** Read the docs and do the practical exercise. No project code.

**Session B:** Pure building. The reading removes friction.

**Session C:** Review, clean up, write missing tests. Don't advance until the phase acceptance criteria pass.

---

## When You Get Stuck

Solana errors can be cryptic. Here's your debugging sequence:

1. **Read the full error.** Anchor errors often include a code number (e.g., `Error Code: AccountNotInitialized`). Search the Anchor error codes reference.
2. **Check account ordering.** Many Solana errors come from passing accounts in the wrong order or missing a required account. Compare your client call with your `#[derive(Accounts)]` struct.
3. **Add `msg!()` logging.** Solana's equivalent of `console.log`. View logs with `solana logs` in another terminal or in the Solana Explorer.
4. **Run `anchor test -- --features debug`.** More verbose output.
5. **Verify PDA seeds match.** If client-side PDA derivation doesn't match on-chain seeds, the account won't be found. Print both and compare.
6. **Check rent/space.** "Account data too small" means your `space` calculation is wrong. Recount bytes manually.
7. **Search Solana Stack Exchange** — https://solana.stackexchange.com — Most beginner Anchor issues have answers there.
