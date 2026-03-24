import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { toast } from "sonner";
import { useEscrowProgram, getEscrowPda, getVaultPda } from "@/lib/anchor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onSuccess: () => void;
}

export function MakeEscrow({ onSuccess }: Props) {
  const { publicKey } = useWallet();
  const program = useEscrowProgram();
  const [loading, setLoading] = useState(false);
  const [mintA, setMintA] = useState("");
  const [mintB, setMintB] = useState("");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!program || !publicKey) return;

    setLoading(true);
    try {
      const mintAPk = new PublicKey(mintA);
      const mintBPk = new PublicKey(mintB);
      const decimals = 6;
      const amountALamports = new BN(
        Math.floor(parseFloat(amountA) * 10 ** decimals)
      );
      const amountBLamports = new BN(
        Math.floor(parseFloat(amountB) * 10 ** decimals)
      );
      const seed = new BN(Date.now());

      const [escrowPda] = getEscrowPda(publicKey, seed);
      const [vaultPda] = getVaultPda(escrowPda);
      const makerAtaA = getAssociatedTokenAddressSync(mintAPk, publicKey);

      const sig = await program.methods
        .makeEscrow(seed, amountALamports, amountBLamports)
        .accountsStrict({
          maker: publicKey,
          mintA: mintAPk,
          mintB: mintBPk,
          makerAtaA,
          escrow: escrowPda,
          vault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      toast.success("Escrow created", {
        description: `tx: ${sig.slice(0, 20)}...`,
      });
      setMintA("");
      setMintB("");
      setAmountA("");
      setAmountB("");
      onSuccess();
    } catch (err: any) {
      toast.error("Transaction failed", {
        description: err?.message?.slice(0, 100),
      });
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) return null;

  return (
    <div className="gradient-border rounded-xl">
      <div className="rounded-xl bg-card p-6 sol-glow">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-mono text-sm font-semibold tracking-wider uppercase text-foreground">
              New Order
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lock tokens and define your swap terms
            </p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Offering side */}
          <div className="rounded-lg bg-secondary/50 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-[var(--sol-teal)]" />
              <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-muted-foreground">
                You Send
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <Label htmlFor="mintA" className="text-xs text-muted-foreground">Token Mint</Label>
                <Input
                  id="mintA"
                  placeholder="Token A mint address..."
                  value={mintA}
                  onChange={(e) => setMintA(e.target.value)}
                  required
                  className="font-mono text-xs h-10 bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amountA" className="text-xs text-muted-foreground">Amount</Label>
                <Input
                  id="amountA"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={amountA}
                  onChange={(e) => setAmountA(e.target.value)}
                  required
                  className="font-mono text-sm h-10 bg-background/50 tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Swap arrow */}
          <div className="flex justify-center -my-2 relative z-10">
            <div className="h-8 w-8 rounded-full border-2 border-border bg-card flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <path d="M7 10l5 5 5-5"/>
              </svg>
            </div>
          </div>

          {/* Wanting side */}
          <div className="rounded-lg bg-secondary/50 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full bg-[var(--sol-purple)]" />
              <span className="font-mono text-[11px] font-medium tracking-wider uppercase text-muted-foreground">
                You Receive
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <Label htmlFor="mintB" className="text-xs text-muted-foreground">Token Mint</Label>
                <Input
                  id="mintB"
                  placeholder="Token B mint address..."
                  value={mintB}
                  onChange={(e) => setMintB(e.target.value)}
                  required
                  className="font-mono text-xs h-10 bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amountB" className="text-xs text-muted-foreground">Amount</Label>
                <Input
                  id="amountB"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={amountB}
                  onChange={(e) => setAmountB(e.target.value)}
                  required
                  className="font-mono text-sm h-10 bg-background/50 tabular-nums"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 font-mono text-sm font-semibold tracking-wide sol-gradient border-0 text-background hover:opacity-90 transition-opacity"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                Confirming...
              </span>
            ) : (
              "Create Escrow"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
