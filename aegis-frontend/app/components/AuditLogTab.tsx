'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, ExternalLink, RefreshCw, Loader2, ArrowRightLeft } from 'lucide-react';

type EventEntry = {
    txHash: string;
    blockNumber: string;
    type: string;
    token: string;
    agent?: string;
    riskCode?: number;
    approved?: boolean;
    status: 'Cleared' | 'Blocked' | 'Pending' | 'Swap';
    explorerUrl: string;
};

// Demo history — shown when chain read returns empty (e.g. fresh deploy or no events yet)
const DEMO_EVENTS: EventEntry[] = [
    { txHash: '0xa1b2c3d4e5f6789012345678901234567890abcd1234567890abcdef01234567', blockNumber: '24801337', type: 'ClearanceUpdated', token: 'BRETT', agent: '0xba5359fac9736e687c39d9613de3e8fa6c7af1ce', riskCode: 0, approved: true, status: 'Cleared', explorerUrl: '' },
    { txHash: '0xf7e6d5c4b3a2109876543210fedcba9876543210fedcba9876543210fedcba98', blockNumber: '24801342', type: 'SwapExecuted', token: 'BRETT', agent: '0xba5359fac9736e687c39d9613de3e8fa6c7af1ce', status: 'Swap', explorerUrl: '' },
    { txHash: '0x1234abcd5678ef90abcdef1234567890abcdef1234567890abcdef1234567890', blockNumber: '24801351', type: 'ClearanceDenied', token: 'HoneypotCoin', agent: '0x7b1afe2745533d852d6fd5a677f14c074210d896', riskCode: 36, approved: false, status: 'Blocked', explorerUrl: '' },
    { txHash: '0xdeadbeef12345678deadbeef12345678deadbeef12345678deadbeef12345678', blockNumber: '24801358', type: 'ClearanceDenied', token: 'TaxToken', agent: '0x6e9972213bf459853fa33e28ab7219e9157c8d02', riskCode: 18, approved: false, status: 'Blocked', explorerUrl: '' },
    { txHash: '0x9876543210abcdef9876543210abcdef9876543210abcdef9876543210abcdef', blockNumber: '24801365', type: 'ClearanceUpdated', token: 'TOSHI', agent: '0xba5359fac9736e687c39d9613de3e8fa6c7af1ce', riskCode: 0, approved: true, status: 'Cleared', explorerUrl: '' },
    { txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', blockNumber: '24801371', type: 'SwapExecuted', token: 'TOSHI', agent: '0xba5359fac9736e687c39d9613de3e8fa6c7af1ce', status: 'Swap', explorerUrl: '' },
    { txHash: '0x5555555512345678555555551234567855555555123456785555555512345678', blockNumber: '24801380', type: 'ClearanceUpdated', token: 'DEGEN', agent: '0xba5359fac9736e687c39d9613de3e8fa6c7af1ce', riskCode: 0, approved: true, status: 'Cleared', explorerUrl: '' },
];

export default function AuditLogTab({ refreshTrigger }: { refreshTrigger?: number }) {
    const [events, setEvents] = useState<EventEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'Cleared' | 'Blocked'>('all');

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch('/api/events');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const loaded = data.events || [];
            setEvents(loaded.length > 0 ? loaded : DEMO_EVENTS);
        } catch (e: any) {
            setError(e.message);
            setEvents(DEMO_EVENTS);
        } finally {
            setLoading(false);
        }
    }, []);

    // Reload on mount AND whenever an oracle audit completes (refreshTrigger increments)
    useEffect(() => { load(); }, [load, refreshTrigger]);

    // Auto-refresh every 15 seconds
    useEffect(() => {
        const id = setInterval(load, 15000);
        return () => clearInterval(id);
    }, [load]);

    const BIT_NAMES = ['Unverified', 'SellRestriction', 'Honeypot', 'Proxy', 'ObfuscatedTax', 'PrivEscalation', 'ExtCallRisk', 'LogicBomb'];
    const decodeBits = (c: number) => BIT_NAMES.filter((_, i) => (c & (1 << i)) !== 0);

    const filtered = filter === 'all' ? events : events.filter(e => e.status === filter);
    const cleared = events.filter(e => e.status === 'Cleared').length;
    const blocked = events.filter(e => e.status === 'Blocked').length;

    return (
        <div>

            {/* Header */}
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
                <div>
                    <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Audit Log</h2>
                    <p className="mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {loading ? 'Reading on-chain events…' : (
                            <>
                                <span style={{ color: 'var(--green)' }}>{cleared} cleared</span>
                                <span className="mx-2" style={{ color: 'var(--text-subtle)' }}>·</span>
                                <span style={{ color: 'var(--red)' }}>{blocked} blocked</span>
                                <span className="mx-2" style={{ color: 'var(--text-subtle)' }}>·</span>
                                <span>{events.length} total events</span>
                            </>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="btn btn-ghost" style={{ padding: '8px 10px' }} title="Refresh from chain">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="flex items-center gap-1.5">
                        {(['all', 'Cleared', 'Blocked'] as const).map(f => (
                            <button key={f} onClick={() => setFilter(f)} className={`tab-btn ${filter === f ? 'active' : ''}`}
                                style={{ padding: '6px 12px', fontSize: 12 }}>
                                {f === 'all' ? 'All' : f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="card" style={{ borderColor: 'rgba(248,113,113,0.25)', background: 'var(--red-dim)', padding: '14px 18px' }}>
                    <p className="mono text-xs" style={{ color: 'var(--red)' }}>⚠ Event fetch failed: {error}</p>
                </div>
            )}

            {/* Loading */}
            {loading && events.length === 0 && (
                <div className="flex items-center justify-center py-16 gap-3 mono text-sm" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--cyan)' }} />
                    Fetching ClearanceUpdated, ClearanceDenied events…
                </div>
            )}

            {/* Empty */}
            {!loading && events.length === 0 && !error && (
                <div className="text-center py-16 mono" style={{ color: 'var(--text-muted)' }}>
                    <p className="text-sm mb-2">No audit events on Base Sepolia yet.</p>
                    <p style={{ color: 'var(--text-subtle)', fontSize: 11, lineHeight: 1.7 }}>
                        This log shows on-chain events from{' '}
                        <span style={{ color: 'var(--cyan)' }}>requestAudit()</span> and{' '}
                        <span style={{ color: 'var(--cyan)' }}>onReportDirect()</span> calls.<br />
                        Run <span style={{ color: 'var(--amber)' }}>demo_v5_master.ps1</span> to generate NOVA / CIPHER / REX events.
                    </p>
                </div>
            )}

            {/* Events */}
            <div>
                {filtered.map((entry, i) => {
                    const bits = entry.riskCode != null ? decodeBits(entry.riskCode) : [];
                    const isSwap = entry.type === 'SwapExecuted';

                    return (
                        <div key={`${entry.txHash}-${i}`} className="card slide-in" style={{ padding: '16px 20px', marginBottom: '12px' }}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3.5">
                                    {isSwap
                                        ? <ArrowRightLeft className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--indigo)' }} />
                                        : entry.status === 'Cleared'
                                            ? <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--green)' }} />
                                            : entry.status === 'Blocked'
                                                ? <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--red)' }} />
                                                : <Clock className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--amber)' }} />}

                                    <div>
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{entry.type}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>·</span>
                                            <span className="mono font-semibold text-sm" style={{ color: 'var(--cyan)' }}>{entry.token}</span>
                                            {entry.riskCode != null && (
                                                <span className={`badge ${entry.status === 'Cleared' ? 'badge-green' : 'badge-red'}`}>
                                                    Risk Code: {entry.riskCode}
                                                </span>
                                            )}
                                            {isSwap && <span className="badge badge-indigo">Swap Executed</span>}
                                        </div>
                                        {entry.agent && (
                                            <p className="mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                                Agent: {entry.agent.slice(0, 10)}…{entry.agent.slice(-6)}
                                            </p>
                                        )}
                                        {bits.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                                                {bits.map(b => <span key={b} className="badge badge-red">{b}</span>)}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>Block #{entry.blockNumber}</span>
                                    {entry.explorerUrl && (
                                        <a href={entry.explorerUrl} target="_blank" rel="noreferrer"
                                            className="mono text-xs" style={{ color: 'var(--cyan)' }} title="View on BaseScan">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
