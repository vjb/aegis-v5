'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flame, ToggleLeft, ToggleRight, Save, RefreshCw, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';

type FirewallConfig = {
    maxTax: number;
    blockProxies: boolean;
    blockHoneypots: boolean;
    strictLogic: boolean;
    allowUnverified: boolean;
    // Per-bit enable flags (all default true)
    blockSellRestriction: boolean;
    blockObfuscatedTax: boolean;
    blockPrivilegeEscalation: boolean;
    blockExternalCallRisk: boolean;
    blockLogicBomb: boolean;
};

const DEFAULTS: FirewallConfig = {
    maxTax: 5,
    blockProxies: true,
    blockHoneypots: true,
    strictLogic: true,
    allowUnverified: false,
    blockSellRestriction: true,
    blockObfuscatedTax: true,
    blockPrivilegeEscalation: true,
    blockExternalCallRisk: true,
    blockLogicBomb: true,
};

const BITS = [
    { bit: 0, label: 'Unverified Source Code', source: 'GoPlus', desc: 'Block tokens with no verified code on BaseScan', key: 'allowUnverified', inverted: true },
    { bit: 1, label: 'Sell Tax Restriction', source: 'GoPlus', desc: 'Block tokens with buy/sell tax above the maxTax threshold', key: 'blockSellRestriction', inverted: false },
    { bit: 2, label: 'Honeypot Detection', source: 'GoPlus', desc: 'Block tokens that can be bought but never sold', key: 'blockHoneypots', inverted: false },
    { bit: 3, label: 'Upgradeable Proxy', source: 'GoPlus', desc: 'Block tokens behind proxy contracts where owner can swap logic', key: 'blockProxies', inverted: false },
    { bit: 4, label: 'Obfuscated Tax Logic', source: 'AI', desc: 'AI reads Solidity source and detects hidden fee in transfer()', key: 'blockObfuscatedTax', inverted: false },
    { bit: 5, label: 'Transfer Allowlist Honeypot', source: 'AI', desc: 'AI detects allowlist that locks non-approved wallets from selling', key: 'blockPrivilegeEscalation', inverted: false },
    { bit: 6, label: 'External Call Risk', source: 'AI', desc: 'AI detects reentrancy or arbitrary delegatecall in source', key: 'blockExternalCallRisk', inverted: false },
    { bit: 7, label: 'Logic Bomb', source: 'AI', desc: 'AI detects time-gated or condition-gated malicious code', key: 'blockLogicBomb', inverted: false },
] as const;

export default function FirewallTab() {
    const [chainConfig, setChainConfig] = useState<FirewallConfig | null>(null);
    const [cfg, setCfg] = useState<FirewallConfig>(DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<{ hash: string; explorerUrl: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isDirty = chainConfig && JSON.stringify(cfg) !== JSON.stringify(chainConfig);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch('/api/firewall');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const loaded: FirewallConfig = { ...DEFAULTS, ...data.config };
            setChainConfig(loaded);
            setCfg(loaded);
        } catch (e: any) {
            setError(e.message);
            setChainConfig({ ...DEFAULTS });
            setCfg({ ...DEFAULTS });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true); setSaveResult(null); setError(null);
        try {
            const res = await fetch('/api/firewall', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: cfg }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSaveResult({ hash: data.hash, explorerUrl: data.explorerUrl });
            setChainConfig({ ...cfg });
            // Auto-dismiss toast after 4s
            setTimeout(() => setSaveResult(null), 4000);
        } catch (e: any) {
            setError(`Save failed: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const toggle = (key: keyof FirewallConfig) => {
        setSaveResult(null);
        setCfg(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const isOn = (bit: typeof BITS[number]) => {
        const val = cfg[bit.key as keyof FirewallConfig] as boolean;
        return bit.inverted ? !val : val;
    };

    const activeCount = BITS.filter(b => isOn(b)).length;
    const riskMask = BITS.filter(b => isOn(b)).reduce((acc, b) => acc | (1 << b.bit), 0);

    return (
        <div>

            {/* Header */}
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
                <div>
                    <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Firewall Rules</h2>
                    <p className="mono text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        {loading ? 'Reading from chain…'
                            : error ? '⚠ Using defaults (chain read failed)'
                                : 'Synced with on-chain firewallConfig()'}
                        <span className="ml-4">Active: <span style={{ color: 'var(--cyan)' }}>{activeCount}/8</span></span>
                        <span className="ml-3">Mask: <span style={{ color: 'var(--cyan)' }}>0x{riskMask.toString(16).padStart(2, '0').toUpperCase()}</span></span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} disabled={loading} className="btn btn-ghost" style={{ padding: '7px 10px' }}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="badge badge-cyan"><Flame className="w-3.5 h-3.5" /> CRE enforced</div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="card" style={{ padding: '12px 16px', borderColor: 'rgba(255,107,107,0.25)', background: 'rgba(255,107,107,0.05)' }}>
                    <p className="mono text-xs" style={{ color: 'var(--red)' }}>⚠ {error}</p>
                </div>
            )}

            {/* Unsaved */}
            {isDirty && (
                <div className="card slide-in flex items-center justify-between" style={{ padding: '12px 16px', borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.04)' }}>
                    <span className="flex items-center gap-2 mono text-xs" style={{ color: 'var(--amber)' }}>
                        <AlertTriangle className="w-4 h-4" /> Unsaved — not yet on-chain
                    </span>
                    <button onClick={save} disabled={saving} className="btn btn-cyan" style={{ padding: '7px 14px', fontSize: 12 }}>
                        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <><Save className="w-3.5 h-3.5" /> Save</>}
                    </button>
                </div>
            )}

            {/* Save success */}
            {saveResult && (
                <div className="card slide-in" style={{ padding: '12px 16px', borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.04)' }}>
                    <p className="mono text-xs" style={{ color: 'var(--green)' }}>✅ Saved on-chain — {saveResult.hash.slice(0, 18)}…</p>
                    {saveResult.explorerUrl && (
                        <a href={saveResult.explorerUrl} target="_blank" rel="noreferrer"
                            className="mono text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--cyan)' }}>
                            View in Tenderly <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            )}

            {/* ── Risk Bit Matrix — ALL 8 toggleable ── */}
            <div style={{ marginBottom: '28px' }}>
                <p className="section-title" style={{ marginBottom: '14px' }}>Risk Bit Matrix</p>
                <div>
                    {BITS.map(b => {
                        const on = isOn(b);
                        return (
                            <button key={b.bit} onClick={() => toggle(b.key as keyof FirewallConfig)}
                                className="card w-full text-left flex items-center gap-4 transition-all"
                                style={{
                                    padding: '16px 18px',
                                    marginBottom: '10px',
                                    borderColor: on ? 'var(--border-bright)' : 'var(--border)',
                                    background: on ? 'var(--bg-card)' : 'var(--bg-surface)',
                                    opacity: loading ? 0.6 : 1,
                                    cursor: 'pointer',
                                }}>
                                <span className="mono text-xs w-5 text-center flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>{b.bit}</span>
                                {on
                                    ? <ToggleRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--cyan)' }} />
                                    : <ToggleLeft className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2.5 mb-1">
                                        <span className="mono text-sm font-semibold" style={{ color: on ? 'var(--text-primary)' : 'var(--text-muted)' }}>{b.label}</span>
                                        <span className={`badge ${b.source === 'AI' ? 'badge-indigo' : 'badge-green'}`}>{b.source}</span>
                                    </div>
                                    <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{b.desc}</p>
                                </div>
                                <span className="mono font-bold text-xs flex-shrink-0 w-8 text-center"
                                    style={{ color: on ? 'var(--cyan)' : 'var(--text-subtle)' }}>
                                    {on ? 'ON' : 'OFF'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Thresholds ── */}
            <div style={{ marginBottom: '28px' }}>
                <p className="section-title" style={{ marginBottom: '14px' }}>Threshold Tuning</p>
                <div className="card" style={{ padding: '22px' }}>

                    <div style={{ marginBottom: '24px' }}>
                        <div className="flex justify-between mono text-xs mb-2.5">
                            <span style={{ color: 'var(--text-muted)' }}>Max Allowed Tax <span style={{ color: 'var(--text-subtle)' }}>(Bit 1)</span></span>
                            <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{cfg.maxTax}%</span>
                        </div>
                        <input type="range" min={0} max={50} step={1} value={cfg.maxTax}
                            onChange={e => { setSaveResult(null); setCfg(p => ({ ...p, maxTax: parseInt(e.target.value) })); }}
                            style={{ width: '100%' }} />
                        <p className="mono text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>
                            Tokens with tax {">"} {cfg.maxTax}% trigger bit 1
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="mono text-sm font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Strict AI Consensus</p>
                            <p className="mono text-xs" style={{ color: 'var(--text-subtle)' }}>
                                ON: both GPT-4o AND Llama-3 must agree on AI bits 4–7<br />
                                OFF: either model alone can trigger a block
                            </p>
                        </div>
                        <button onClick={() => toggle('strictLogic')}
                            className="flex items-center gap-2 mono text-xs px-3 py-2 rounded-lg"
                            style={{
                                background: cfg.strictLogic ? 'var(--cyan-dim)' : 'var(--bg-elevated)',
                                border: '1px solid', borderColor: cfg.strictLogic ? 'rgba(56,189,248,0.3)' : 'var(--border)',
                                color: cfg.strictLogic ? 'var(--cyan)' : 'var(--text-muted)',
                                minWidth: 72, justifyContent: 'center',
                            }}>
                            {cfg.strictLogic ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            {cfg.strictLogic ? 'ON' : 'OFF'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom save */}
            {isDirty && (
                <button onClick={save} disabled={saving} className="btn btn-cyan w-full" style={{ justifyContent: 'center', padding: '12px 0' }}>
                    {saving
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending setFirewallConfig() tx…</>
                        : <><Save className="w-4 h-4" /> Save Changes → on-chain</>}
                </button>
            )}

            <p className="mono text-xs text-center" style={{ color: 'var(--text-subtle)', marginTop: '20px' }}>
                Read via <code>firewallConfig()</code> · Saved via <code>setFirewallConfig()</code> · Owner-only tx
            </p>
        </div>
    );
}
