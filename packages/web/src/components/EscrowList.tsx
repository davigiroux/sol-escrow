import { EscrowCard } from "./EscrowCard";
import type { EscrowAccount } from "@/hooks/useEscrows";

interface Props {
  escrows: EscrowAccount[];
  loading: boolean;
  onAction: () => void;
}

export function EscrowList({ escrows, loading, onAction }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="mb-3 h-5 w-5 border-2 border-muted-foreground/20 border-t-muted-foreground rounded-full animate-spin" />
        <span className="font-mono text-xs tracking-wider">Fetching orders...</span>
      </div>
    );
  }

  if (escrows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/30 py-16 text-center">
        <div className="mb-3 mx-auto h-10 w-10 rounded-xl bg-secondary flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <path d="M12 8v8M8 12h8"/>
          </svg>
        </div>
        <p className="font-mono text-sm text-muted-foreground">No open orders</p>
        <p className="font-mono text-xs text-muted-foreground/60 mt-1">Create one above to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {escrows.map((escrow, i) => (
        <div
          key={escrow.publicKey.toBase58()}
          className="animate-fade-up"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <EscrowCard escrow={escrow} onAction={onAction} />
        </div>
      ))}
    </div>
  );
}
