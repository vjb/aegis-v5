'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flame, ToggleLeft, ToggleRight, Save, RefreshCw, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';

// The 8-bit risk matrix. Each bit maps to a risk vector.
const RISK_BITS = [
    { bit: 0, label: 'Unverified Source Code', source: 'GoPlus', desc: 'Block tokens with no verified code on BaseScan', configKey: 'allowUnverified', invertedKey: true },
    { bit: 1, label: 'Sell Tax Restriction', source: 'GoPlus', desc: 'Block tokens with buy/sell tax above maxTax threshold', configKey: null },
    { bit: 2, label: 'Honeypot Detection', source: 'GoPlus', desc: 'Block tokens that can be bought but not sold (GoPlus simulation)', configKey: 'blockHoneypots' },
    { bit: 3, label: 'Upgradeable Proxy', source: 'GoPlus', desc: 'Block tokens deployed behind proxy contracts (owner can change code)', configKey: 'blockProxies' },
    { bit: 4, label: 'Obfuscated Tax Logic', source: 'AI', desc: 'AI reads Solidity source and detects hidden fee logic in transfer()', configKey: null },
    { bit: 5, label: 'Transfer Allowlist Honeypot', source: 'AI', desc: 'AI detects allowlist that prevents non-whitelisted wallets from selling', configKey: null },
    { bit: 6, label: 'External Call Risk', source: 'AI', desc: 'AI detects reentrancy or arbitrary external delegatecall in source', configKey: null },
    { bit: 7, label: 'Logic Bomb', source: 'AI', desc: 'AI detects time-gated or condition-gated malicious code', configKey: null },
];

type FirewallConfig = {
    maxTax: number;
    blockProxies: boolean;
    blockHoneypots: boolean;
    strictLogic: boolean;
    allowUnverified: boolean;
};

const DEFAULT_CONFIG: FirewallConfig = {
    maxTax: 5,
    blockProxies: true,
    blockHoneypots: true,
    strictLogic: true,
    allowUnverified: false,
};

export default function FirewallTab() {
    const [chainConfig, setChainConfig] = useState<FirewallConfig | null>(null);
    const [localConfig, setLocalConfig] = useState<FirewallConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<{ hash: string; explorerUrl: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isDirty = chainConfig && JSON.stringify(localConfig) !== JSON.stringify(chainConfig);

    const loadConfig = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch('/api/firewall');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const cfg: FirewallConfig = {
                maxTax: data.config?.maxTax ?? 5,
                blockProxies: data.config?.blockProxies ?? true,
                blockHoneypots: data.config?.blockHoneypots ?? true,
                strictLogic: data.config?.strictLogic ?? true,
                allowUnverified: data.config?.allowUnverified ?? false,
            };
            setChainConfig(cfg);
            setLocalConfig(cfg);
        } catch (e: any) {
            setError(e.message);
            setChainConfig(DEFAULT_CONFIG);
            setLocalConfig(DEFAULT_CONFIG);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    const saveConfig = async () => {
        setSaving(true); setSaveResult(null); setError(null);
        try {
            const res = await fetch('/api/firewall', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: localConfig }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSaveResult({ hash: data.hash, explorerUrl: data.explorerUrl });
            setChainConfig({ ...localConfig }); // Now in sync
        } catch (e: any) {
            setError(`Save failed: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const setConfigKey = (key: keyof FirewallConfig, value: boolean | number) => {
        setSaveResult(null);
        setLocalConfig(prev => ({ ...prev, [key]: value }));
    };

    // Derive which bits are effectively active given the config
    const bitActive = (bit: number) => {
        switch (bit) {
            case 0: return !localConfig.allowUnverified;
            case 2: return localConfig.blockHoneypots;
            case 3: return localConfig.blockProxies;
            default: return true; // bits 1, 4-7 always active
        }
    };

    const activeCount = RISK_BITS.filter(rb => bitActive(rb.bit)).length;
    const riskMask = RISK_BITS.filter(rb => bitActive(rb.bit)).reduce((acc, rb) => acc | (1 << rb.bit), 0);

    return (
        <div className="space-y-7">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Firewall Rules</h2>
                    <p className="mono text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        Active risk vectors: <span style={{ color: 'var(--cyan)' }}>{activeCount}/8</span>
                        <span className="ml-4">Effective mask: <span style={{ color: 'var(--cyan)' }}>0x{riskMask.toString(16).padStart(2, '0').toUpperCase()}</span></span>
                        {loading && <span className="ml-3" style={{ color: 'var(--text-subtle)' }}>reading chain…</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadConfig} disabled={loading} className="btn btn-ghost" style={{ padding: '7px 10px' }} title="Re-read from chain">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="badge badge-cyan"><Flame className="w-3.5 h-3.5" /> CRE enforced</div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="card" style={{ borderColor: 'rgba(248,113,113,0.25)', background: 'var(--red-dim)', padding: '14px 18px' }}>
                    <p className="mono text-xs" style={{ color: 'var(--red)' }}>⚠ {error}</p>
                </div>
            )}

            {/* Unsaved changes banner */}
            {isDirty && (
                <div className="card slide-in flex items-center justify-between"
                    style={{ padding: '14px 18px', borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.05)' }}>
                    <div className="flex items-center gap-2.5 mono text-xs" style={{ color: 'var(--amber)' }}>
                        <AlertTriangle className="w-4 h-4" />
                        Unsaved changes — these have NOT been saved to the chain yet
                    </div>
                    <button onClick={saveConfig} disabled={saving} className="btn btn-cyan" style={{ padding: '8px 16px', fontSize: 12 }}>
                        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending tx…</> : <><Save className="w-3.5 h-3.5" /> Save → setFirewallConfig()</>}
                    </button>
                </div>
            )}

            {/* Save success */}
            {saveResult && (
                <div className="card slide-in" style={{ padding: '14px 18px', borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.04)' }}>
                    <p className="mono text-xs" style={{ color: 'var(--green)' }}>
                        ✅ setFirewallConfig() confirmed on-chain
                    </p>
                    <p className="mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        tx: {saveResult.hash.slice(0, 20)}…
                        {saveResult.explorerUrl && (
                            <a href={saveResult.explorerUrl} target="_blank" rel="noreferrer"
                                className="ml-2 inline-flex items-center gap-1" style={{ color: 'var(--cyan)' }}>
                                View in Tenderly <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                    </p>
                </div>
            )}

            {/* ── Risk Bit Matrix ── */}
            <div>
                <p className="section-title">Risk Bit Matrix</p>
                <p className="mono text-xs mb-4" style={{ color: 'var(--text-subtle)' }}>
                    Click to toggle. Changes are local until you hit Save.
                </p>
                <div className="space-y-3">
                    {RISK_BITS.map(({ bit, label, source, desc, configKey, invertedKey }) => {
                        const on = bitActive(bit);
                        const isToggleable = configKey !== null;
                        return (
                            <button key={bit}
                                onClick={() => {
                                    if (!isToggleable) return;
                                    if (invertedKey) {
                                        setConfigKey(configKey as keyof FirewallConfig, !localConfig[configKey as keyof FirewallConfig]);
                                    } else {
                                        setConfigKey(configKey as keyof FirewallConfig, !localConfig[configKey as keyof FirewallConfig]);
                                    }
                                }}
                                disabled={!isToggleable}
                                className="card w-full text-left flex items-center gap-4 transition-all"
                                style={{
                                    padding: '16px 18px',
                                    borderColor: on ? 'var(--border-bright)' : 'var(--border)',
                                    background: on ? 'var(--bg-card)' : 'var(--bg-surface)',
                                    cursor: isToggleable ? 'pointer' : 'default',
                                    opacity: loading ? 0.6 : 1,
                                }}
                            >
                                <span className="mono text-xs w-5 text-center flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>{bit}</span>

                                {on
                                    ? <ToggleRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--cyan)' }} />
                                    : <ToggleLeft className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />}

                                <div className="flex-1">
                                    <div className="flex items-center gap-2.5 mb-1">
                                        <span className="mono text-sm font-semibold"
                                            style={{ color: on ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
                                        <span className={`badge ${source === 'AI' ? 'badge-indigo' : 'badge-green'}`}>{source}</span>
                                        {!isToggleable && <span className="badge" style={{ fontSize: 10, color: 'var(--text-subtle)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>always on</span>}
                                    </div>
                                    <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
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

            {/* ── Threshold Sliders ── */}
            <div>
                <p className="section-title">Threshold Tuning</p>
                <div className="card space-y-7" style={{ padding: '24px' }}>

                    {/* Max Tax */}
                    <div>
                        <div className="flex justify-between mono text-xs mb-2.5">
                            <span style={{ color: 'var(--text-muted)' }}>
                                Max Allowed Tax
                                <span className="ml-2" style={{ color: 'var(--text-subtle)', fontSize: 10 }}>(bit 1 — GoPlus)</span>
                            </span>
                            <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{localConfig.maxTax}%</span>
                        </div>
                        <input type="range" min={0} max={50} step={1} value={localConfig.maxTax}
                            onChange={e => setConfigKey('maxTax', parseInt(e.target.value))} style={{ width: '100%' }} />
                        <p className="mono text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>
                            Tokens with buy or sell tax above {localConfig.maxTax}% will be blocked (bit 1)
                        </p>
                    </div>

                    {/* strictLogic */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="mono text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Strict Logic Mode</p>
                            <p className="mono text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                                Requires BOTH GPT-4o and Llama-3 to agree before flagging AI bits (4–7)
                            </p>
                        </div>
                        <button onClick={() => setConfigKey('strictLogic', !localConfig.strictLogic)}
                            className="flex items-center gap-2 mono text-xs px-3 py-2 rounded-lg"
                            style={{ background: localConfig.strictLogic ? 'var(--cyan-dim)' : 'var(--bg-elevated)', border: '1px solid', borderColor: localConfig.strictLogic ? 'rgba(56,189,248,0.3)' : 'var(--border)', color: localConfig.strictLogic ? 'var(--cyan)' : 'var(--text-muted)' }}>
                            {localConfig.strictLogic ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            {localConfig.strictLogic ? 'ON' : 'OFF'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom save button */}
            {isDirty && (
                <button onClick={saveConfig} disabled={saving} className="btn btn-cyan w-full" style={{ justifyContent: 'center', padding: '12px 0' }}>
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending setFirewallConfig() tx…</> : <><Save className="w-4 h-4" /> Save Changes → on-chain</>}
                </button>
            )}

            <p className="mono text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
                Settings are read from <code>firewallConfig()</code> on contract and saved via <code>setFirewallConfig()</code> — owner-only tx visible in Tenderly
            </p>
        </div>
    );
}
