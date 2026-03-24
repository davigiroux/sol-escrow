import { useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { type Escrow } from "./idl";
import IDL from "./idl-json";

export const PROGRAM_ID = new PublicKey(
  "Huid51EyAoXC4M1XLDDL756pRmmZZ1D7XCD3rowxX4hq"
);

export function useAnchorProvider(): AnchorProvider | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return null;
    return new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);
}

export function useEscrowProgram(): Program<Escrow> | null {
  const provider = useAnchorProvider();

  return useMemo(() => {
    if (!provider) return null;
    return new Program<Escrow>(IDL as Escrow, provider);
  }, [provider]);
}

export function getEscrowPda(
  maker: PublicKey,
  seed: BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      maker.toBuffer(),
      seed.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID
  );
}

export function getVaultPda(escrow: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), escrow.toBuffer()],
    PROGRAM_ID
  );
}
