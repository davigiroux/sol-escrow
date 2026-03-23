import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { clusterApiUrl } from "@solana/web3.js";
import { Toaster } from "sonner";

import { MakeEscrow } from "@/components/MakeEscrow";
import { EscrowList } from "@/components/EscrowList";
import { useEscrows } from "@/hooks/useEscrows";
import { shortenAddress } from "@/lib/utils";

function StatusBar() {
  const { publicKey } = useWallet();
  return (
    <div className="border-t border-border bg-card/50 px-4 py-2">
      <div className="mx-auto flex max-w-6xl items-center justify-between text-xs font-mono text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--sol-teal)] animate-pulse-soft" />
            devnet
          </span>
          {publicKey && (
            <span className="text-foreground/60">
              {shortenAddress(publicKey.toBase58(), 6)}
            </span>
          )}
        </div>
        <span>sol-escrow v0.1.0</span>
      </div>
    </div>
  );
}

function AppContent() {
  const { publicKey } = useWallet();
  const { escrows, loading, refetch } = useEscrows();

  return (
    <div className="min-h-screen bg-background dot-grid">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg sol-gradient flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 11.5L6 7.5L10 11.5L14 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-background"/>
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold font-mono tracking-tight leading-none">
                  SOL ESCROW
                </h1>
                <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">
                  Trustless Token Swap
                </p>
              </div>
            </div>
          </div>
          <WalletMultiButton />
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Hero section when not connected */}
        {!publicKey && (
          <div className="animate-fade-up flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 h-16 w-16 rounded-2xl sol-gradient flex items-center justify-center sol-glow">
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
                <path d="M2 11.5L6 7.5L10 11.5L14 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-background"/>
              </svg>
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Swap tokens <span className="sol-gradient-text">trustlessly</span>
            </h2>
            <p className="text-muted-foreground max-w-md mb-8 text-base leading-relaxed">
              Create atomic token swaps on Solana. Lock your tokens in a PDA vault,
              and let anyone fill your order. No middleman.
            </p>
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
              <span className="h-2 w-2 rounded-full sol-gradient" />
              Connect your wallet to get started
            </div>
          </div>
        )}

        {/* Connected state */}
        {publicKey && (
          <div className="space-y-8">
            <div className="animate-fade-up" style={{ animationDelay: '0.05s' }}>
              <MakeEscrow onSuccess={refetch} />
            </div>

            <div className="animate-fade-up" style={{ animationDelay: '0.15s' }}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold font-mono tracking-tight">
                    OPEN ORDERS
                  </h2>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    ({escrows.length})
                  </span>
                </div>
                <button
                  onClick={refetch}
                  className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-500">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  refresh
                </button>
              </div>
              <EscrowList escrows={escrows} loading={loading} onAction={refetch} />
            </div>
          </div>
        )}
      </main>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}

export default function App() {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <AppContent />
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
              },
            }}
          />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
