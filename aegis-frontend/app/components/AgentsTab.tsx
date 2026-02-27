'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, Plus, Trash2, TrendingUp, AlertTriangle, RefreshCw, Loader2, ChevronDown } from 'lucide-react';

type Agent = {
    address: string;
    allowance: string;
    allowanceEth: string;
    active: boolean;
    name?: string;
};

// Real wallet addresses from the demo scripts
const KNOWN_NAMES: Record<string, string> = {
    // demo_2_multi_agent agents
    '0xba5359fac9736e687c39d9613de3e8fa6c7af1ce': 'NOVA',
    '0x6e9972213bf459853fa33e28ab7219e9157c8d02': 'CIPHER',
    '0x7b1afe2745533d852d6fd5a677f14c074210d896': 'REX',
    // demo_3_erc7579_architecture agent
    '0xf5a5e415061470a8b9137959180901aea72450a4': 'PHANTOM',
};

const TRADE_TOKENS = ['BRETT', 'TOSHI', 'DEGEN', 'WETH', 'HoneypotCoin', 'TaxToken'];

export default function AgentsTab({ isKilled, onAudit }: { isKilled: boolean; onAudit: (token: string) => void }) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [treasury, setTreasury] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [newAddr, setNewAddr] = useState('');
    const [newBudget, setNewBudget] = useState(0.05);
    const [submitting, setSubmitting] = useState(false);
    const [submitMsg, setSubmitMsg] = useState<string | null>(null);

    // Per-agent token selection for Simulate Trade
    const [selectedToken, setSelectedToken] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch('/api/agents');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setAgents(data.agents || []);
            setTreasury(data.treasury || null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const subscribe = async () => {
        if (!newAddr || !newBudget) return;
        setSubmitting(true); setSubmitMsg(null);
        try {
            const res = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'subscribe', agentAddress: newAddr, budgetEth: newBudget.toString() }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSubmitMsg(`✅ subscribeAgent() confirmed — tx: ${data.hash?.slice(0, 12)}…`);
            setNewAddr(''); setNewBudget(0.05); setShowForm(false);
            await load();
        } catch (e: any) {
            setSubmitMsg(`❌ ${e.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const revoke = async (addr: string) => {
        if (!confirm(`Revoke agent ${addr.slice(0, 10)}…?`)) return;
        try {
            const res = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'revoke', agentAddress: addr }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            await load();
        } catch (e: any) {
            alert(`Revoke failed: ${e.message}`);
        }
    };

    const agentName = (addr: string) => KNOWN_NAMES[addr.toLowerCase()] || addr.slice(2, 8).toUpperCase();

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Managed Agents</h2>
                    <p className="mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {loading ? 'Loading…' : `${agents.filter(a => a.active).length} active · ${agents.length} total`}
                        {treasury && <span className="ml-3">Treasury: <span style={{ color: 'var(--cyan)' }}>{treasury} ETH</span></span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="btn btn-ghost" style={{ padding: '8px 10px' }} title="Refresh from chain">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button onClick={() => setShowForm(s => !s)} disabled={isKilled} className="btn btn-cyan">
                        <Plus className="w-4 h-4" /> Subscribe Agent
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="card" style={{ borderColor: 'rgba(248,113,113,0.25)', background: 'var(--red-dim)', padding: '14px 18px' }}>
                    <p className="mono text-xs" style={{ color: 'var(--red)' }}>⚠ Chain read failed: {error}</p>
                    <p className="mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ensure TENDERLY_RPC_URL and AEGIS_MODULE_ADDRESS are set in .env</p>
                </div>
            )}

            {/* TX feedback */}
            {submitMsg && (
                <div className="card slide-in" style={{ padding: '12px 16px', borderColor: submitMsg.startsWith('✅') ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)' }}>
                    <p className="mono text-xs" style={{ color: submitMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)' }}>{submitMsg}</p>
                </div>
            )}

            {/* Subscribe form */}
            {showForm && (
                <div className="card slide-in space-y-5">
                    <p className="mono text-xs font-semibold" style={{ color: 'var(--cyan)' }}>New Agent — subscribeAgent(addr, budget)</p>
                    <div className="space-y-2">
                        <label className="mono text-xs" style={{ color: 'var(--text-muted)' }}>Wallet Address *</label>
                        <input value={newAddr} onChange={e => setNewAddr(e.target.value)} placeholder="0x…" className="inp" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between mono text-xs">
                            <span style={{ color: 'var(--text-muted)' }}>Budget Cap</span>
                            <span style={{ color: 'var(--cyan)' }}>{newBudget.toFixed(3)} ETH</span>
                        </div>
                        <input type="range" min="0.001" max="1" step="0.001" value={newBudget}
                            onChange={e => setNewBudget(parseFloat(e.target.value))} style={{ width: '100%' }} />
                        <div className="flex justify-between mono text-xs" style={{ color: 'var(--text-subtle)' }}>
                            <span>0.001 ETH</span><span>1 ETH</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={subscribe} disabled={submitting || !newAddr} className="btn btn-cyan" style={{ flex: 1 }}>
                            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending tx…</> : 'Confirm — subscribeAgent()'}
                        </button>
                        <button onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
                    </div>
                </div>
            )}

            {/* Loading state */}
            {loading && agents.length === 0 && (
                <div className="flex items-center justify-center py-16 gap-3 mono text-sm" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--cyan)' }} />
                    Reading agentAllowances from chain…
                </div>
            )}

            {/* Empty state */}
            {!loading && agents.length === 0 && !error && (
                <div className="text-center py-16 mono text-sm" style={{ color: 'var(--text-muted)' }}>
                    No subscribed agents found on this VNet.<br />
                    <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>Run a demo script first, or subscribe an agent above →</span>
                </div>
            )}

            {/* Agent cards */}
            <div className="space-y-4">
                {agents.map(agent => {
                    const budgetEth = parseFloat(agent.allowanceEth);
                    const name = agentName(agent.address);
                    const tok = selectedToken[agent.address] || 'BRETT';

                    return (
                        <div key={agent.address} className="card slide-in"
                            style={{ borderColor: agent.active ? undefined : 'rgba(248,113,113,0.18)' }}>

                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{ background: agent.active ? 'rgba(56,189,248,0.1)' : 'var(--red-dim)' }}>
                                        <Bot className="w-5 h-5" style={{ color: agent.active ? 'var(--cyan)' : 'var(--red)' }} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2.5">
                                            <span className="mono font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{name}</span>
                                            <span className={`badge ${agent.active ? 'badge-green' : 'badge-red'}`}>
                                                {agent.active ? 'Active' : 'Revoked'}
                                            </span>
                                        </div>
                                        <p className="mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                            {agent.address.slice(0, 12)}…{agent.address.slice(-6)}
                                        </p>
                                    </div>
                                </div>
                                {agent.active && (
                                    <button onClick={() => revoke(agent.address)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }}>
                                        <Trash2 className="w-3.5 h-3.5" /> Revoke
                                    </button>
                                )}
                            </div>

                            {/* Budget */}
                            <div className="mb-4">
                                <div className="flex justify-between mono text-xs" style={{ color: 'var(--text-muted)' }}>
                                    <span>Remaining allowance</span>
                                    <span style={{ color: budgetEth < 0.001 ? 'var(--red)' : 'var(--cyan)' }}>
                                        {agent.allowanceEth} ETH
                                        {agent.allowance === '0' && <span className="ml-2" style={{ color: 'var(--red)' }}>(exhausted)</span>}
                                    </span>
                                </div>
                                {budgetEth < 0.001 && agent.active && (
                                    <p className="mono text-xs flex items-center gap-1.5 mt-1" style={{ color: 'var(--amber)' }}>
                                        <AlertTriangle className="w-3.5 h-3.5" /> Budget exhausted — re-subscribe to top up
                                    </p>
                                )}
                            </div>

                            {/* Simulate Trade — inline token picker. Always visible; disabled for revoked agents */}
                            <div className="flex gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                                <div className="relative flex-shrink-0">
                                    <select
                                        value={tok}
                                        onChange={e => setSelectedToken(p => ({ ...p, [agent.address]: e.target.value }))}
                                        disabled={!agent.active || isKilled}
                                        className="inp mono text-xs"
                                        style={{
                                            paddingRight: 28, appearance: 'none', height: 36,
                                            cursor: agent.active ? 'pointer' : 'not-allowed',
                                            opacity: agent.active ? 1 : 0.4, minWidth: 110,
                                        }}
                                    >
                                        {TRADE_TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{ color: 'var(--text-subtle)' }} />
                                </div>
                                <button
                                    onClick={() => agent.active && !isKilled && onAudit(tok)}
                                    disabled={!agent.active || isKilled}
                                    className="btn btn-ghost"
                                    style={{
                                        flex: 1, justifyContent: 'center', fontSize: 12,
                                        opacity: (!agent.active || isKilled) ? 0.4 : 1,
                                        cursor: (!agent.active || isKilled) ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    {agent.active ? `Simulate Trade → Oracle Feed` : 'Agent Revoked'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
