'use client';

import { useState, useEffect } from 'react';
import { Shield, Bot, SlidersHorizontal, FileText, ShoppingBag, Lock, Unlock, Radio, Zap, Wallet, RefreshCw } from 'lucide-react';
import AgentsTab from './components/AgentsTab';
import FirewallTab from './components/FirewallTab';
import AuditLogTab from './components/AuditLogTab';
import MarketplaceTab from './components/MarketplaceTab';
import OracleFeed from './components/OracleFeed';
import AegisChat from './components/AegisChat';

type Tab = 'agents' | 'firewall' | 'log' | 'marketplace';

type WalletInfo = {
  ownerAddress: string;
  ownerBalanceEth: string;
  moduleAddress: string;
  moduleBalanceEth: string;
  network: string;
  explorerBase: string;
  error?: string;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('agents');
  const [isKilled, setIsKilled] = useState(false);
  const [triggerAudit, setTriggerAudit] = useState<string | null>(null);
  const [auditVersion, setAuditVersion] = useState(0);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [lastAuditResult, setLastAuditResult] = useState<{ token: string; status: string; score: number } | null>(null);

  const loadWallet = async () => {
    setWalletLoading(true);
    try {
      const res = await fetch('/api/wallet');
      const data = await res.json();
      setWallet(data);
    } catch {
      setWallet(null);
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => { loadWallet(); }, []);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'firewall', label: 'Firewall', icon: SlidersHorizontal },
    { id: 'log', label: 'Audit Log', icon: FileText },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  ];

  const shortAddr = wallet?.ownerAddress
    ? `${wallet.ownerAddress.slice(0, 6)}…${wallet.ownerAddress.slice(-4)}`
    : null;

  return (
    <main className="flex flex-col h-screen" style={{ background: 'var(--bg-base)' }}>

      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-8 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(13,20,36,0.9)', backdropFilter: 'blur(16px)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', boxShadow: '0 0 20px rgba(56,189,248,0.35)' }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold tracking-tight text-lg mono" style={{ color: 'var(--text-primary)' }}>AEGIS</span>
              <span className="badge badge-cyan">v4</span>
            </div>
            <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>ERC-7579 Executor · Chainlink CRE Oracle</p>
          </div>
        </div>

        {/* Center — network + oracle status */}
        <div className="flex items-center gap-5 mono text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full pulse-slow" style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
            <span style={{ color: 'var(--green)' }}>Oracle Online</span>
          </span>
          <span style={{ color: 'var(--border-bright)' }}>·</span>
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
            Chainlink CRE DON
          </span>
          <span style={{ color: 'var(--border-bright)' }}>·</span>
          <span>{wallet?.network || 'Base VNet'}</span>
        </div>

        {/* Right — wallet pill + kill switch */}
        <div className="flex items-center gap-3">

          {/* Wallet info pill — shows owner (human) wallet, not agent wallets */}
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl mono text-xs"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)' }}>
            <Wallet className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
            <span style={{ color: 'var(--text-subtle)' }}>Owner</span>
            <span style={{ color: 'var(--border-bright)' }}>·</span>
            {walletLoading ? (
              <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
            ) : wallet?.error ? (
              <span style={{ color: 'var(--red)' }}>Wallet error</span>
            ) : (
              <>
                {wallet?.explorerBase ? (
                  <a href={`${wallet.explorerBase}`} target="_blank" rel="noreferrer"
                    style={{ color: 'var(--text-primary)' }}>
                    {shortAddr}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-primary)' }}>{shortAddr}</span>
                )}
                <span style={{ color: 'var(--border-bright)' }}>·</span>
                <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{wallet?.ownerBalanceEth} ETH</span>
                <button onClick={loadWallet} title="Refresh balance" style={{ color: 'var(--text-muted)', lineHeight: 0 }}>
                  <RefreshCw className={`w-3 h-3 ${walletLoading ? 'animate-spin' : ''}`} />
                </button>
              </>
            )}
          </div>

          {/* Kill switch */}
          <button
            onClick={() => setIsKilled(k => !k)}
            className="btn"
            style={isKilled ? {
              background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)',
              color: 'var(--amber)', boxShadow: '0 0 20px rgba(251,191,36,0.15)',
            } : {
              background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.28)',
              color: 'var(--red)',
            }}
          >
            {isKilled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {isKilled ? 'UNLOCK PROTOCOL' : 'KILL SWITCH'}
          </button>
        </div>
      </header>

      {/* Kill switch banner */}
      {isKilled && (
        <div className="px-8 py-3 flex items-center gap-2.5 mono text-xs font-semibold flex-shrink-0 slide-in"
          style={{ background: 'rgba(251,191,36,0.07)', borderBottom: '1px solid rgba(251,191,36,0.18)', color: 'var(--amber)' }}>
          <Zap className="w-3.5 h-3.5" />
          PROTOCOL LOCKED — All agentic outflow halted. Smart Account connections severed.
        </div>
      )}

      {/* ── Body — 3-column layout ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel — Tabs (40%) */}
        <div className="flex flex-col min-h-0" style={{ width: '40%', borderRight: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)', background: 'rgba(13,20,36,0.5)' }}>
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto" style={{ padding: '20px' }}>
            {activeTab === 'agents' && <AgentsTab isKilled={isKilled} onAudit={(tok: string) => setTriggerAudit(tok)} />}
            {activeTab === 'firewall' && <FirewallTab />}
            {activeTab === 'log' && <AuditLogTab refreshTrigger={auditVersion} />}
            {activeTab === 'marketplace' && <MarketplaceTab isKilled={isKilled} onAudit={(tok: string) => { setActiveTab('agents'); setTriggerAudit(tok); }} />}
          </div>
        </div>

        {/* Center panel — Aegis Chat (32%) */}
        <div className="flex flex-col min-h-0" style={{ width: '32%', borderRight: '1px solid var(--border)' }}>
          <AegisChat onAuditRequest={(tok: string) => setTriggerAudit(tok)} lastAuditResult={lastAuditResult} />
        </div>

        {/* Right panel — Oracle Feed (28%) */}
        <div className="flex flex-col min-h-0" style={{ width: '28%' }}>
          <OracleFeed isKilled={isKilled} externalTrigger={triggerAudit} onTriggerConsumed={() => setTriggerAudit(null)} onComplete={(result) => { setAuditVersion((v: number) => v + 1); setLastAuditResult(result); }} />
        </div>
      </div>
    </main>
  );
}
