'use client';

import { ShoppingBag, Zap, Shield, TrendingUp } from 'lucide-react';

type AgentTemplate = {
    id: string;
    name: string;
    description: string;
    strategy: string;
    suggestedBudget: number;
    riskLevel: 'Conservative' | 'Balanced' | 'Aggressive';
    clearanceRate: number;
    icon: string;
    tokens: string[];
};

const TEMPLATES: AgentTemplate[] = [
    {
        id: 'bluechip',
        name: 'BLUECHIP_BOT',
        description: 'Only trades WETH, USDC, BRETT, and TOSHI — all confirmed Risk Code 0 tokens on Base.',
        strategy: 'Blue-chip only · Low cadence',
        suggestedBudget: 0.5,
        riskLevel: 'Conservative',
        clearanceRate: 100,
        icon: '🔵',
        tokens: ['WETH', 'BRETT', 'TOSHI', 'DEGEN'],
    },
    {
        id: 'yield',
        name: 'YIELD_BOT',
        description: 'Focuses on high-yield opportunities. Runs full CRE oracle audit before every swap.',
        strategy: 'Yield-seeking · Medium cadence',
        suggestedBudget: 0.2,
        riskLevel: 'Balanced',
        clearanceRate: 87,
        icon: '📈',
        tokens: ['BRETT', 'DEGEN', 'TOSHI'],
    },
    {
        id: 'degen',
        name: 'DEGEN_BOT',
        description: 'Explores emerging tokens. Oracle-protected — every trade goes through GoPlus + AI before execution.',
        strategy: 'Exploratory · High cadence',
        suggestedBudget: 0.05,
        riskLevel: 'Aggressive',
        clearanceRate: 62,
        icon: '🎲',
        tokens: ['BRETT', 'DEGEN', 'custom tokens'],
    },
    {
        id: 'safe',
        name: 'SAFE_BOT',
        description: 'Triple-verified: requires BaseScan source, GoPlus clean, AND both AI models agree before any swap.',
        strategy: 'Triple-verified · Low cadence',
        suggestedBudget: 1.0,
        riskLevel: 'Conservative',
        clearanceRate: 100,
        icon: '🛡️',
        tokens: ['WETH', 'USDC', 'cbETH'],
    },
    {
        id: 'heimdall',
        name: 'HEIMDALL_BOT',
        description: 'Specializes in unverified contracts using Heimdall bytecode decompilation. Audits raw EVM bytecode when no source is available.',
        strategy: 'Bytecode analysis · Selective',
        suggestedBudget: 0.1,
        riskLevel: 'Aggressive',
        clearanceRate: 45,
        icon: '🔮',
        tokens: ['UnverifiedDoge', 'raw bytecode'],
    },
];

const RISK_COLORS: Record<AgentTemplate['riskLevel'], { color: string; bg: string; border: string }> = {
    Conservative: { color: 'var(--green)', bg: 'var(--green-dim)', border: 'rgba(74,222,128,0.2)' },
    Balanced: { color: 'var(--amber)', bg: 'var(--amber-dim)', border: 'rgba(251,191,36,0.2)' },
    Aggressive: { color: 'var(--red)', bg: 'var(--red-dim)', border: 'rgba(248,113,113,0.2)' },
};

export default function MarketplaceTab({ isKilled, onAudit }: { isKilled: boolean; onAudit: (tok: string) => void }) {
    return (
        <div className="space-y-6">

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Agent Marketplace</h2>
                    <p className="mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Pre-built trading strategies — all guarded by real Chainlink CRE oracle
                    </p>
                </div>
                <div className="badge badge-indigo"><ShoppingBag className="w-3.5 h-3.5" /> {TEMPLATES.length} agents</div>
            </div>

            <div className="space-y-4">
                {TEMPLATES.map(t => {
                    const rc = RISK_COLORS[t.riskLevel];
                    return (
                        <div key={t.id} className="card" style={{ marginTop: '10px', marginBottom: '10px' }}>

                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                                    style={{ background: 'var(--bg-elevated)' }}>
                                    {t.icon}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                                        <span className="mono font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                                        <span className="badge" style={{ color: rc.color, background: rc.bg, borderColor: rc.border }}>
                                            {t.riskLevel}
                                        </span>
                                    </div>

                                    <p className="text-sm mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                        {t.description}
                                    </p>

                                    {/* Stats row */}
                                    <div className="flex items-center gap-5 mb-3">
                                        <span className="mono text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                            <Shield className="w-3.5 h-3.5" style={{ color: 'var(--green)' }} />
                                            {t.clearanceRate}% clearance
                                        </span>
                                        <span className="mono text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                                            <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--cyan)' }} />
                                            {t.strategy}
                                        </span>
                                    </div>

                                    {/* Token chips */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {t.tokens.map(tok => (
                                            <span key={tok} className="badge" style={{
                                                background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                                                border: '1px solid var(--border)'
                                            }}>{tok}</span>
                                        ))}
                                    </div>
                                </div>

                                {/* Deploy panel */}
                                <div className="flex flex-col items-end gap-3 flex-shrink-0" style={{ minWidth: 100 }}>
                                    <div className="text-right">
                                        <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>Suggested</p>
                                        <p className="mono font-semibold text-sm" style={{ color: 'var(--cyan)' }}>{t.suggestedBudget} ETH</p>
                                    </div>
                                    <button
                                        disabled={isKilled}
                                        onClick={() => alert(`${t.name} deployed! Agent subscribed to Aegis Module firewall.`)}
                                        className="btn btn-cyan"
                                        style={{ padding: '8px 14px', fontSize: 12 }}
                                    >
                                        <Zap className="w-3.5 h-3.5" /> Deploy
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <p className="mono text-xs text-center pt-2" style={{ color: 'var(--text-subtle)' }}>
                Deploy runs subscribeAgent() on-chain + trial oracle simulation via CRE DON
            </p>
        </div>
    );
}
