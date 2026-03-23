import { useState, useEffect, useCallback } from "react";
import { useEscrowProgram } from "@/lib/anchor";
import { PublicKey } from "@solana/web3.js";

export interface EscrowAccount {
  publicKey: PublicKey;
  maker: PublicKey;
  mintA: PublicKey;
  mintB: PublicKey;
  amountA: number;
  amountB: number;
  seed: number;
  escrowBump: number;
  vaultBump: number;
}

export function useEscrows() {
  const program = useEscrowProgram();
  const [escrows, setEscrows] = useState<EscrowAccount[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEscrows = useCallback(async () => {
    if (!program) {
      setEscrows([]);
      return;
    }
    setLoading(true);
    try {
      const accounts = await program.account.escrow.all();
      setEscrows(
        accounts.map((a) => ({
          publicKey: a.publicKey,
          maker: a.account.maker,
          mintA: a.account.mintA,
          mintB: a.account.mintB,
          amountA: (a.account.amountA as any).toNumber(),
          amountB: (a.account.amountB as any).toNumber(),
          seed: (a.account.seed as any).toNumber(),
          escrowBump: a.account.escrowBump,
          vaultBump: a.account.vaultBump,
        }))
      );
    } catch (err) {
      console.error("Failed to fetch escrows:", err);
    } finally {
      setLoading(false);
    }
  }, [program]);

  useEffect(() => {
    fetchEscrows();
  }, [fetchEscrows]);

  return { escrows, loading, refetch: fetchEscrows };
}
