import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
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
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.escrow as Program<Escrow>;
  const connection = provider.connection;

  const maker = Keypair.generate();
  const taker = Keypair.generate();
  let mintA: PublicKey;
  let mintB: PublicKey;
  let makerAtaA: PublicKey;
  let takerAtaB: PublicKey;

  const decimals = 6;
  const amountA = new BN(100_000_000); // 100 tokens
  const amountB = new BN(200_000_000); // 200 tokens

  before(async () => {
    // Airdrop SOL
    await Promise.all([
      connection.requestAirdrop(maker.publicKey, 10e9),
      connection.requestAirdrop(taker.publicKey, 10e9),
    ]).then((sigs) =>
      Promise.all(sigs.map((sig) => connection.confirmTransaction(sig)))
    );

    const authority = (provider.wallet as anchor.Wallet).payer;

    // Create mints
    mintA = await createMint(connection, authority, authority.publicKey, null, decimals);
    mintB = await createMint(connection, authority, authority.publicKey, null, decimals);

    // Create maker ATA for Token A + fund
    const makerAtaAInfo = await getOrCreateAssociatedTokenAccount(connection, authority, mintA, maker.publicKey);
    makerAtaA = makerAtaAInfo.address;

    // Create taker ATA for Token B + fund
    const takerAtaBInfo = await getOrCreateAssociatedTokenAccount(connection, authority, mintB, taker.publicKey);
    takerAtaB = takerAtaBInfo.address;
  });

  // ── Make + Cancel flow (seed=1) ──

  describe("make + cancel", () => {
    const seed = new BN(1);
    let escrowPda: PublicKey;
    let vaultPda: PublicKey;

    before(() => {
      [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), maker.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), escrowPda.toBuffer()],
        program.programId
      );
    });

    it("make_escrow: deposits Token A into vault", async () => {
      const authority = (provider.wallet as anchor.Wallet).payer;
      await mintTo(connection, authority, mintA, makerAtaA, authority, amountA.toNumber());

      await program.methods
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

      // Verify escrow state
      const escrowAccount = await program.account.escrow.fetch(escrowPda);
      expect(escrowAccount.maker.toBase58()).to.equal(maker.publicKey.toBase58());
      expect(escrowAccount.mintA.toBase58()).to.equal(mintA.toBase58());
      expect(escrowAccount.mintB.toBase58()).to.equal(mintB.toBase58());
      expect(escrowAccount.amountA.toNumber()).to.equal(amountA.toNumber());
      expect(escrowAccount.amountB.toNumber()).to.equal(amountB.toNumber());

      // Verify vault balance
      const vaultAccount = await getAccount(connection, vaultPda);
      expect(Number(vaultAccount.amount)).to.equal(amountA.toNumber());

      // Verify maker debited
      const makerAccount = await getAccount(connection, makerAtaA);
      expect(Number(makerAccount.amount)).to.equal(0);
    });

    it("cancel_escrow: refunds Token A to maker", async () => {
      await program.methods
        .cancelEscrow()
        .accountsStrict({
          maker: maker.publicKey,
          mintA,
          makerAtaA,
          escrow: escrowPda,
          vault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc();

      // Maker got Token A back
      const makerAccount = await getAccount(connection, makerAtaA);
      expect(Number(makerAccount.amount)).to.equal(amountA.toNumber());

      // Escrow closed
      try {
        await program.account.escrow.fetch(escrowPda);
        expect.fail("escrow should be closed");
      } catch (e) {
        expect(e.message).to.include("Account does not exist");
      }
    });
  });

  // ── Make + Take flow (seed=2) ──

  describe("make + take", () => {
    const seed = new BN(2);
    let escrowPda: PublicKey;
    let vaultPda: PublicKey;

    before(() => {
      [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), maker.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
        program.programId
      );
      [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), escrowPda.toBuffer()],
        program.programId
      );
    });

    it("make_escrow: deposits Token A into vault", async () => {
      const authority = (provider.wallet as anchor.Wallet).payer;
      // makerAtaA should have tokens from cancel refund
      // but let's ensure it has enough
      const makerAccount = await getAccount(connection, makerAtaA);
      if (Number(makerAccount.amount) < amountA.toNumber()) {
        await mintTo(connection, authority, mintA, makerAtaA, authority, amountA.toNumber() - Number(makerAccount.amount));
      }

      await mintTo(connection, authority, mintB, takerAtaB, authority, amountB.toNumber());

      await program.methods
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

      const vaultAccount = await getAccount(connection, vaultPda);
      expect(Number(vaultAccount.amount)).to.equal(amountA.toNumber());
    });

    it("take_escrow: swaps tokens and closes escrow", async () => {
      const takerAtaA = getAssociatedTokenAddressSync(mintA, taker.publicKey);
      const makerAtaB = getAssociatedTokenAddressSync(mintB, maker.publicKey);

      await program.methods
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

      // Taker received Token A
      const takerAAccount = await getAccount(connection, takerAtaA);
      expect(Number(takerAAccount.amount)).to.equal(amountA.toNumber());

      // Maker received Token B
      const makerBAccount = await getAccount(connection, makerAtaB);
      expect(Number(makerBAccount.amount)).to.equal(amountB.toNumber());

      // Taker's Token B debited
      const takerBAccount = await getAccount(connection, takerAtaB);
      expect(Number(takerBAccount.amount)).to.equal(0);

      // Escrow closed
      try {
        await program.account.escrow.fetch(escrowPda);
        expect.fail("escrow should be closed");
      } catch (e) {
        expect(e.message).to.include("Account does not exist");
      }
    });
  });
});
