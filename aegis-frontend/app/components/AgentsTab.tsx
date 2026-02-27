'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bot, Plus, Trash2, TrendingUp, AlertTriangle, RefreshCw, Loader2, X, ChevronDown } from 'lucide-react';

type Agent = {
    address: string;
    allowance: string;
    allowanceEth: string;
    active: boolean;
    name?: string;
};

// Real wallet addresses from the demo scripts
const KNOWN_NAMES: Record<string, string> = {
    '0xba5359fac9736e687c39d9613de3e8fa6c7af1ce': 'NOVA',
    '0x6e9972213bf459853fa33e28ab7219e9157c8d02': 'CIPHER',
    '0x7b1afe2745533d852d6fd5a677f14c074210d896': 'REX',
    '0xf5a5e415061470a8b9137959180901aea72450a4': 'PHANTOM',
};

const CLEAN_TOKENS = ['BRETT', 'TOSHI', 'DEGEN', 'WETH'];
const RISKY_TOKENS = ['HoneypotCoin', 'TaxToken', 'TimeBomb', 'UnverifiedDoge'];

// Suggested addresses for onboarding demo — not already subscribed
const DEMO_SUGGESTIONS = [
    { name: 'ALPHA', address: '0x1111111111111111111111111111111111111111', budget: 0.02 },
    { name: 'SIGMA', address: '0x2222222222222222222222222222222222222222', budget: 0.05 },
    { name: 'OMEGA', address: '0x3333333333333333333333333333333333333333', budget: 0.1 },
];

type TradeModal = { agent: Agent; token: string; amount: number } | null;

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

    // Trade modal state
    const [tradeModal, setTradeModal] = useState<TradeModal>(null);

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

    const openTradeModal = (agent: Agent) => {
        setTradeModal({ agent, token: 'BRETT', amount: 0.01 });
    };

    const confirmTrade = () => {
        if (!tradeModal) return;
        onAudit(tradeModal.token);
        setTradeModal(null);
    };

    return (
        <div className="space-y-7">

            {/* Trade Modal */}
            {tradeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
                    onClick={e => e.target === e.currentTarget && setTradeModal(null)}>
                    <div className="card" style={{ width: 420, padding: 28, background: 'var(--bg-elevated)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="mono font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                    Simulate Trade
                                </p>
                                <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    Agent: <span style={{ color: 'var(--cyan)' }}>{agentName(tradeModal.agent.address)}</span>
                                </p>
                            </div>
                            <button onClick={() => setTradeModal(null)} className="btn btn-ghost" style={{ padding: '6px 8px' }}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Token picker — dropdown */}
                        <div className="mb-6">
                            <p className="mono text-xs mb-2.5" style={{ color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Select Token
                            </p>
                            <select
                                value={tradeModal.token}
                                onChange={e => setTradeModal(m => m ? { ...m, token: e.target.value } : m)}
                                className="inp mono text-sm"
                                style={{ width: '100%', height: 42 }}
                            >
                                <optgroup label="✅ Should PASS">
                                    {CLEAN_TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                                </optgroup>
                                <optgroup label="🚫 Should BLOCK">
                                    {RISKY_TOKENS.map(t => <option key={t} value={t}>{t}</option>)}
                                </optgroup>
                            </select>
                            <p className="mono text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>
                                {CLEAN_TOKENS.includes(tradeModal.token)
                                    ? '✅ This token should pass the CRE firewall'
                                    : '🚫 This token should be blocked by the CRE firewall'}
                            </p>
                        </div>

                        {/* Amount slider */}
                        <div className="mb-6">
                            <p className="mono text-xs mb-3" style={{ color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Amount
                            </p>
                            <div className="flex justify-between mono text-xs mb-2">
                                <span style={{ color: 'var(--text-muted)' }}>Buy amount</span>
                                <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{tradeModal.amount.toFixed(4)} ETH</span>
                            </div>
                            <input type="range"
                                min={0.001}
                                max={Math.max(parseFloat(tradeModal.agent.allowanceEth), 0.001)}
                                step={0.001}
                                value={tradeModal.amount}
                                onChange={e => setTradeModal(m => m ? { ...m, amount: parseFloat(e.target.value) } : m)}
                                style={{ width: '100%' }} />
                            <div className="flex justify-between mono text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
                                <span>0.001 ETH</span>
                                <span>{parseFloat(tradeModal.agent.allowanceEth).toFixed(4)} ETH max</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={confirmTrade} className="btn btn-cyan" style={{ flex: 1 }}>
                                <TrendingUp className="w-4 h-4" /> Run Oracle Audit → Feed
                            </button>
                            <button onClick={() => setTradeModal(null)} className="btn btn-ghost">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Managed Agents</h2>
                    <p className="mono text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
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
                    <div className="flex items-center justify-between">
                        <p className="mono text-xs font-semibold" style={{ color: 'var(--cyan)' }}>New Agent — subscribeAgent(addr, budget)</p>
                    </div>

                    {/* Demo suggestions */}
                    <div>
                        <p className="mono text-xs mb-2.5" style={{ color: 'var(--text-subtle)' }}>Quick-fill a demo address:</p>
                        <div className="flex gap-2 flex-wrap">
                            {DEMO_SUGGESTIONS.map(s => (
                                <button key={s.name} onClick={() => { setNewAddr(s.address); setNewBudget(s.budget); }}
                                    className="badge badge-cyan" style={{ cursor: 'pointer', padding: '5px 12px', fontSize: 12 }}>
                                    {s.name} ({s.budget} ETH)
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="mono text-xs" style={{ color: 'var(--text-muted)' }}>Wallet Address *</label>
                        <input value={newAddr} onChange={e => setNewAddr(e.target.value)} placeholder="0x… (or use quick-fill above)" className="inp" />
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
            <div className="space-y-5">
                {agents.map(agent => {
                    const budgetEth = parseFloat(agent.allowanceEth);
                    const name = agentName(agent.address);

                    return (
                        <div key={agent.address} className="card slide-in"
                            style={{ padding: '22px 24px', borderColor: agent.active ? undefined : 'rgba(248,113,113,0.18)' }}>

                            <div className="flex items-start justify-between mb-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center"
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
                                        <p className="mono text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                            {agent.address.slice(0, 14)}…{agent.address.slice(-6)}
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
                            <div className="mb-5">
                                <div className="flex justify-between mono text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                                    <span>Remaining allowance</span>
                                    <span style={{ color: budgetEth < 0.001 ? 'var(--red)' : 'var(--cyan)', fontWeight: 600 }}>
                                        {agent.allowanceEth} ETH
                                        {agent.allowance === '0' && <span className="ml-2" style={{ color: 'var(--red)' }}>(exhausted)</span>}
                                    </span>
                                </div>
                                {budgetEth < 0.001 && agent.active && (
                                    <p className="mono text-xs flex items-center gap-1.5" style={{ color: 'var(--amber)' }}>
                                        <AlertTriangle className="w-3.5 h-3.5" /> Budget exhausted — re-subscribe to top up
                                    </p>
                                )}
                            </div>

                            {/* Simulate Trade button — always present, disabled when revoked */}
                            <button
                                onClick={() => agent.active && !isKilled && openTradeModal(agent)}
                                disabled={!agent.active || isKilled}
                                className="btn btn-ghost"
                                style={{ width: '100%', justifyContent: 'center', fontSize: 12, borderTop: '1px solid var(--border)', marginTop: 0, borderRadius: '0 0 10px 10px', padding: '12px 16px' }}
                            >
                                <TrendingUp className="w-3.5 h-3.5" />
                                {agent.active ? 'Simulate Trade → Oracle Feed' : 'Agent Revoked'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
