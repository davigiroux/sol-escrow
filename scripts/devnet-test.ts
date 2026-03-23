import * as anchor from "@coral-xyz/anchor";
import { Program, BN, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Escrow } from "../target/types/escrow";
import {
  createMint,
  mintTo,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Connection,
  clusterApiUrl,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const EXPLORER = "https://explorer.solana.com";

function explorerLink(sig: string): string {
  return `${EXPLORER}/tx/${sig}?cluster=devnet`;
}

function explorerAccount(addr: string): string {
  return `${EXPLORER}/address/${addr}?cluster=devnet`;
}

async function airdropAndConfirm(connection: Connection, pubkey: PublicKey, amount: number) {
  try {
    const sig = await connection.requestAirdrop(pubkey, amount);
    await connection.confirmTransaction(sig, "confirmed");
    console.log(`  Airdropped ${amount / 1e9} SOL to ${pubkey.toBase58().slice(0, 8)}...`);
  } catch {
    console.log(`  Airdrop failed for ${pubkey.toBase58().slice(0, 8)}... (rate limited — using existing balance)`);
  }
}

async function main() {
  // Setup connection + provider using the deploy wallet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const walletPath = path.resolve(
    process.env.HOME || "~",
    ".config/solana/id.json"
  );
  const keypairData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.escrow as Program<Escrow>;

  console.log("\n=== Escrow Devnet E2E Test ===\n");
  console.log(`Program: ${explorerAccount(program.programId.toBase58())}`);
  console.log(`Authority: ${authority.publicKey.toBase58()}`);

  // --- Setup: create maker + taker wallets ---
  const maker = Keypair.generate();
  const taker = Keypair.generate();

  console.log(`\nMaker: ${maker.publicKey.toBase58()}`);
  console.log(`Taker: ${taker.publicKey.toBase58()}`);

  console.log("\n1. Funding wallets (transfer from authority)...");
  const fundAmount = 0.2 * 1e9; // 0.2 SOL each
  const fundTx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: maker.publicKey, lamports: fundAmount }),
    SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: taker.publicKey, lamports: fundAmount }),
  );
  await sendAndConfirmTransaction(connection, fundTx, [authority]);
  console.log(`  Funded maker + taker with ${fundAmount / 1e9} SOL each`);

  // --- Create mints ---
  console.log("\n2. Creating token mints...");
  const decimals = 6;
  const mintA = await createMint(connection, authority, authority.publicKey, null, decimals);
  const mintB = await createMint(connection, authority, authority.publicKey, null, decimals);
  console.log(`  Mint A: ${explorerAccount(mintA.toBase58())}`);
  console.log(`  Mint B: ${explorerAccount(mintB.toBase58())}`);

  // --- Create ATAs + mint tokens ---
  console.log("\n3. Creating ATAs and minting tokens...");
  const amountA = new BN(100_000_000); // 100 Token A
  const amountB = new BN(200_000_000); // 200 Token B

  const makerAtaAInfo = await getOrCreateAssociatedTokenAccount(connection, authority, mintA, maker.publicKey);
  const makerAtaA = makerAtaAInfo.address;
  await mintTo(connection, authority, mintA, makerAtaA, authority, amountA.toNumber());
  console.log(`  Minted ${amountA.toNumber() / 1e6} Token A to Maker`);

  const takerAtaBInfo = await getOrCreateAssociatedTokenAccount(connection, authority, mintB, taker.publicKey);
  const takerAtaB = takerAtaBInfo.address;
  await mintTo(connection, authority, mintB, takerAtaB, authority, amountB.toNumber());
  console.log(`  Minted ${amountB.toNumber() / 1e6} Token B to Taker`);

  // --- Make Escrow ---
  console.log("\n4. Making escrow offer...");
  const seed = new BN(Date.now()); // unique seed

  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), maker.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), escrowPda.toBuffer()],
    program.programId
  );

  const makeTxSig = await program.methods
    .makeEscrow(seed, amountA, amountB)
    .accountsStrict({
      maker: maker.publicKey,
      mintA,
      mintB,
      makerAtaA,
      escrow: escrowPda,
      vault: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([maker])
    .rpc();

  console.log(`  make_escrow tx: ${explorerLink(makeTxSig)}`);

  // Verify vault
  const vaultAccount = await getAccount(connection, vaultPda);
  console.log(`  Vault balance: ${Number(vaultAccount.amount) / 1e6} Token A`);

  // --- Take Escrow ---
  console.log("\n5. Taking escrow offer...");
  const takerAtaA = getAssociatedTokenAddressSync(mintA, taker.publicKey);
  const makerAtaB = getAssociatedTokenAddressSync(mintB, maker.publicKey);

  const takeTxSig = await program.methods
    .takeEscrow()
    .accountsStrict({
      taker: taker.publicKey,
      maker: maker.publicKey,
      mintA,
      mintB,
      takerAtaA,
      takerAtaB,
      makerAtaB,
      escrow: escrowPda,
      vault: vaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([taker])
    .rpc();

  console.log(`  take_escrow tx: ${explorerLink(takeTxSig)}`);

  // --- Verify final balances ---
  console.log("\n6. Verifying final balances...");

  const takerAAccount = await getAccount(connection, takerAtaA);
  const makerBAccount = await getAccount(connection, makerAtaB);
  const takerBAccount = await getAccount(connection, takerAtaB);
  const makerAAccount = await getAccount(connection, makerAtaA);

  console.log(`  Taker Token A: ${Number(takerAAccount.amount) / 1e6} (expected: ${amountA.toNumber() / 1e6})`);
  console.log(`  Maker Token B: ${Number(makerBAccount.amount) / 1e6} (expected: ${amountB.toNumber() / 1e6})`);
  console.log(`  Taker Token B: ${Number(takerBAccount.amount) / 1e6} (expected: 0)`);
  console.log(`  Maker Token A: ${Number(makerAAccount.amount) / 1e6} (expected: 0)`);

  // Verify escrow closed
  try {
    await program.account.escrow.fetch(escrowPda);
    console.log("  ERROR: Escrow still exists!");
  } catch {
    console.log("  Escrow account closed (expected)");
  }

  const allCorrect =
    Number(takerAAccount.amount) === amountA.toNumber() &&
    Number(makerBAccount.amount) === amountB.toNumber() &&
    Number(takerBAccount.amount) === 0 &&
    Number(makerAAccount.amount) === 0;

  console.log(`\n=== ${allCorrect ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"} ===\n`);
}

main().catch(console.error);
