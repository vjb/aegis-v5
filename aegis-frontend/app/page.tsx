'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  contracts?: {
    module: { address: string; url: string; label: string };
    mockBrett: { address: string; url: string; label: string };
    mockHoneypot: { address: string; url: string; label: string };
  };
  error?: string;
};

// Drag handle between two panels
function DragHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onDrag(dx);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [onDrag]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 5,
        flexShrink: 0,
        cursor: 'col-resize',
        background: 'var(--border)',
        transition: 'background 0.15s',
        position: 'relative',
        zIndex: 10,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--cyan)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--border)')}
      title="Drag to resize"
    />
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('agents');
  const [isKilled, setIsKilled] = useState(false);
  const [triggerAudit, setTriggerAudit] = useState<string | null>(null);
  const [auditVersion, setAuditVersion] = useState(0);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [lastAuditResult, setLastAuditResult] = useState<{ token: string; status: string; score: number } | null>(null);
  const [dockerUp, setDockerUp] = useState<boolean | null>(null);
  const [dockerDetail, setDockerDetail] = useState<string>('');

  // Panel widths in px percentages (sum = 100)
  const [leftPct, setLeftPct] = useState(40);
  const [centerPct, setCenterPct] = useState(32);
  // rightPct = 100 - leftPct - centerPct (computed)

  const containerRef = useRef<HTMLDivElement>(null);

  const dragLeft = useCallback((dx: number) => {
    const totalW = containerRef.current?.offsetWidth ?? window.innerWidth;
    const dPct = (dx / totalW) * 100;
    setLeftPct(prev => Math.max(20, Math.min(60, prev + dPct)));
  }, []);

  const dragCenter = useCallback((dx: number) => {
    const totalW = containerRef.current?.offsetWidth ?? window.innerWidth;
    const dPct = (dx / totalW) * 100;
    setCenterPct(prev => Math.max(15, Math.min(45, prev + dPct)));
  }, []);

  const rightPct = Math.max(15, 100 - leftPct - centerPct);

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

  // Poll Docker status every 10s
  useEffect(() => {
    const checkDocker = async () => {
      try {
        const res = await fetch('/api/docker-status');
        const data = await res.json();
        setDockerUp(data.running);
        if (data.running) {
          setDockerDetail(`Container: ${data.container}\nUptime: ${data.uptime || 'just started'}\nImage: ${data.image || 'unknown'}`);
        } else {
          setDockerDetail('Docker container aegis-oracle-node is not running.\nRun: docker compose up --build -d');
        }
      } catch { setDockerUp(false); setDockerDetail('Cannot reach Docker daemon'); }
    };
    checkDocker();
    const id = setInterval(checkDocker, 10000);
    return () => clearInterval(id);
  }, []);

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
              <span className="badge badge-cyan">v5</span>
            </div>
            <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>ERC-7579 Executor · Chainlink CRE Oracle</p>
          </div>
        </div>

        {/* Center — network + oracle status */}
        <div className="flex items-center gap-5 mono text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-2" title={dockerDetail} style={{ cursor: 'help', marginRight: 5 }}>
            <span className="w-2 h-2 rounded-full pulse-slow" style={{ background: dockerUp ? 'var(--green)' : dockerUp === false ? 'var(--red)' : 'var(--amber)', boxShadow: `0 0 6px ${dockerUp ? 'var(--green)' : dockerUp === false ? 'var(--red)' : 'var(--amber)'}` }} />
            <span style={{ color: dockerUp ? 'var(--green)' : dockerUp === false ? 'var(--red)' : 'var(--amber)', marginRight: 3 }}>
              {dockerUp ? 'CRE Online' : dockerUp === false ? 'CRE Offline' : 'Checking…'}
            </span>
          </span>
          <span style={{ color: 'var(--border-bright)', margin: '0 2px' }}>·</span>
          <span className="flex items-center gap-1.5" style={{ marginRight: 3 }}>
            <Radio className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
            Chainlink CRE DON
          </span>
          <span style={{ color: 'var(--border-bright)', margin: '0 2px' }}>·</span>
          <span className="flex items-center gap-2" title="Heimdall EVM Decompiler (Docker)" style={{ cursor: 'help', marginRight: 3 }}>
            <span className="w-2 h-2 rounded-full" style={{ background: dockerUp ? 'var(--indigo, #818cf8)' : 'var(--red)', boxShadow: `0 0 6px ${dockerUp ? 'rgba(129,140,248,0.5)' : 'var(--red)'}` }} />
            <span style={{ color: dockerUp ? 'var(--indigo, #818cf8)' : 'var(--red)' }}>
              {dockerUp ? 'Heimdall' : 'Heimdall Off'}
            </span>
          </span>
          <span style={{ color: 'var(--border-bright)', margin: '0 2px' }}>·</span>
          <span style={{ marginLeft: 2 }}>{wallet?.network || 'Base VNet'}</span>
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
                    style={{ color: 'var(--text-subtle)' }}>
                    {shortAddr}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-subtle)' }}>{shortAddr}</span>
                )}
                <span style={{ color: 'var(--border-bright)' }}>·</span>
                <span style={{ color: 'white', fontWeight: 700 }}>{wallet?.ownerBalanceEth} ETH</span>
                <button onClick={loadWallet} title="Refresh balance" style={{ color: 'var(--text-muted)', lineHeight: 0 }}>
                  <RefreshCw className={`w-3 h-3 ${walletLoading ? 'animate-spin' : ''}`} />
                </button>
              </>
            )}
          </div>

          {/* Module contract link */}
          {wallet?.contracts?.module?.address && (
            <a href={wallet.contracts.module.url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-xl mono text-xs"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-subtle)', textDecoration: 'none' }}
              title={`AegisModule: ${wallet.contracts.module.address}`}>
              <Shield className="w-3 h-3" style={{ color: 'var(--cyan)' }} />
              <span>Module</span>
              <span style={{ color: 'var(--text-subtle)', fontSize: 10 }}>{wallet.contracts.module.address.slice(0, 6)}…{wallet.contracts.module.address.slice(-4)}</span>
              <span style={{ color: 'var(--cyan)', fontSize: 10 }}>↗</span>
            </a>
          )}

          {/* Kill switch — solid red when active, solid red border when inactive */}
          <button
            onClick={() => setIsKilled(k => !k)}
            className="btn"
            style={isKilled ? {
              background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)',
              color: 'var(--amber)', boxShadow: '0 0 20px rgba(251,191,36,0.2)',
            } : {
              background: 'var(--red-vivid)', border: '1px solid var(--red-vivid)',
              color: 'white', fontWeight: 700,
              boxShadow: '0 0 16px rgba(255,77,77,0.35)',
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

      {/* ── Body — 3-column layout with drag-to-resize ── */}
      <div ref={containerRef} className="flex flex-1 min-h-0">

        {/* Left panel — Tabs */}
        <div className="flex flex-col min-h-0" style={{ width: `${leftPct}%` }}>
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

        {/* Drag handle 1 */}
        <DragHandle onDrag={dragLeft} />

        {/* Center panel — Aegis Chat */}
        <div className="flex flex-col min-h-0" style={{ width: `${centerPct}%` }}>
          <AegisChat onAuditRequest={(tok: string) => setTriggerAudit(tok)} lastAuditResult={lastAuditResult} />
        </div>

        {/* Drag handle 2 */}
        <DragHandle onDrag={dragCenter} />

        {/* Right panel — Oracle Feed */}
        <div className="flex flex-col min-h-0" style={{ width: `${rightPct}%` }}>
          <OracleFeed isKilled={isKilled} externalTrigger={triggerAudit} onTriggerConsumed={() => setTriggerAudit(null)} onComplete={(result) => { setAuditVersion((v: number) => v + 1); setLastAuditResult(result); }} />
        </div>
      </div>
    </main>
  );
}
