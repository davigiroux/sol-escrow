import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { toast } from "sonner";
import { useEscrowProgram, getVaultPda } from "@/lib/anchor";
import { shortenAddress, formatTokenAmount } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { EscrowAccount } from "@/hooks/useEscrows";

interface Props {
  escrow: EscrowAccount;
  onAction: () => void;
}

export function EscrowCard({ escrow, onAction }: Props) {
  const { publicKey } = useWallet();
  const program = useEscrowProgram();
  const [loading, setLoading] = useState(false);

  const isMaker = publicKey?.equals(escrow.maker);
  const [vaultPda] = getVaultPda(escrow.publicKey);

  const handleTake = async () => {
    if (!program || !publicKey) return;
    setLoading(true);
    try {
      const takerAtaA = getAssociatedTokenAddressSync(escrow.mintA, publicKey);
      const takerAtaB = getAssociatedTokenAddressSync(escrow.mintB, publicKey);
      const makerAtaB = getAssociatedTokenAddressSync(escrow.mintB, escrow.maker);

      const sig = await program.methods
        .takeEscrow()
        .accountsStrict({
          taker: publicKey,
          maker: escrow.maker,
          mintA: escrow.mintA,
          mintB: escrow.mintB,
          takerAtaA,
          takerAtaB,
          makerAtaB,
          escrow: escrow.publicKey,
          vault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      toast.success("Order filled", { description: `tx: ${sig.slice(0, 20)}...` });
      onAction();
    } catch (err: any) {
      toast.error("Transaction failed", { description: err?.message?.slice(0, 100) });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!program || !publicKey) return;
    setLoading(true);
    try {
      const makerAtaA = getAssociatedTokenAddressSync(escrow.mintA, escrow.maker);

      const sig = await program.methods
        .cancelEscrow()
        .accountsStrict({
          maker: publicKey,
          mintA: escrow.mintA,
          makerAtaA,
          escrow: escrow.publicKey,
          vault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      toast.success("Order cancelled", { description: `tx: ${sig.slice(0, 20)}...` });
      onAction();
    } catch (err: any) {
      toast.error("Transaction failed", { description: err?.message?.slice(0, 100) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`group rounded-xl border bg-card p-4 transition-all duration-200 hover:border-border/80 ${isMaker ? 'border-[var(--sol-teal)]/20' : 'border-border'}`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[11px] text-muted-foreground">
          {shortenAddress(escrow.publicKey.toBase58(), 4)}
        </span>
        {isMaker ? (
          <span className="font-mono text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-[var(--sol-teal)]/10 text-[var(--sol-teal)]">
            yours
          </span>
        ) : (
          <span className="font-mono text-[10px] font-medium tracking-wider uppercase px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            open
          </span>
        )}
      </div>

      {/* Swap visualization */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 rounded-lg bg-secondary/60 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--sol-teal)]" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Send</span>
          </div>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {formatTokenAmount(escrow.amountA, 6)}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
            {shortenAddress(escrow.mintA.toBase58(), 4)}
          </p>
        </div>

        <div className="flex-shrink-0 text-muted-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>

        <div className="flex-1 rounded-lg bg-secondary/60 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--sol-purple)]" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Recv</span>
          </div>
          <p className="font-mono text-sm font-semibold tabular-nums">
            {formatTokenAmount(escrow.amountB, 6)}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
            {shortenAddress(escrow.mintB.toBase58(), 4)}
          </p>
        </div>
      </div>

      {/* Maker address */}
      <div className="flex items-center gap-1.5 mb-3 text-[11px] font-mono text-muted-foreground">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
        </svg>
        {shortenAddress(escrow.maker.toBase58(), 6)}
      </div>

      {/* Action */}
      {publicKey && (
        isMaker ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full font-mono text-xs tracking-wide border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleCancel}
            disabled={loading}
          >
            {loading ? "Cancelling..." : "Cancel Order"}
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full font-mono text-xs tracking-wide sol-gradient border-0 text-background hover:opacity-90"
            onClick={handleTake}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                Filling...
              </span>
            ) : (
              "Fill Order"
            )}
          </Button>
        )
      )}
    </div>
  );
}
