'use client';

import { useState } from 'react';
import { Flame, ToggleLeft, ToggleRight } from 'lucide-react';

const RISK_BITS = [
    { bit: 0, label: 'Unverified Code', source: 'GoPlus', desc: 'Blocks tokens with unverified source code' },
    { bit: 1, label: 'Sell Restriction', source: 'GoPlus', desc: 'Blocks tokens with sell tax above threshold' },
    { bit: 2, label: 'Honeypot', source: 'GoPlus', desc: 'Blocks known honeypot architectures' },
    { bit: 3, label: 'Upgradeable Proxy', source: 'GoPlus', desc: 'Blocks tokens behind proxy contracts' },
    { bit: 4, label: 'Obfuscated Tax', source: 'AI', desc: 'LLM reads source code and detects hidden fee logic' },
    { bit: 5, label: 'Privilege Escalation', source: 'AI', desc: 'Detects non-standard Ownable backdoors' },
    { bit: 6, label: 'External Call Risk', source: 'AI', desc: 'Detects reentrancy or arbitrary external calls' },
    { bit: 7, label: 'Logic Bomb', source: 'AI', desc: 'Detects time-gated or conditional malicious logic' },
];

export default function FirewallTab() {
    const [enabledBits, setEnabledBits] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
    const [maxTax, setMaxTax] = useState(5);
    const [maxOwnerHolding, setMaxOwnerHolding] = useState(20);
    const [minLiquidity, setMinLiquidity] = useState(1);

    const toggleBit = (bit: number) => setEnabledBits(prev => {
        const n = new Set(prev); n.has(bit) ? n.delete(bit) : n.add(bit); return n;
    });

    const riskCode = Array.from(enabledBits).reduce((acc, b) => acc | (1 << b), 0);

    return (
        <div className="space-y-7">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Rules of Engagement</h2>
                    <p className="mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Active risk bits: <span style={{ color: 'var(--cyan)' }}>{enabledBits.size}/8</span>
                        <span className="ml-4">Mask: <span style={{ color: 'var(--cyan)' }}>0x{riskCode.toString(16).padStart(2, '0').toUpperCase()}</span></span>
                    </p>
                </div>
                <div className="badge badge-cyan"><Flame className="w-3.5 h-3.5" /> Chainlink CRE enforced</div>
            </div>

            {/* Risk bit matrix */}
            <div>
                <p className="section-title">Risk Bit Matrix</p>
                <div className="space-y-2.5">
                    {RISK_BITS.map(({ bit, label, source, desc }) => {
                        const on = enabledBits.has(bit);
                        return (
                            <button key={bit} onClick={() => toggleBit(bit)}
                                className="card w-full text-left flex items-center gap-4 transition-all"
                                style={{
                                    padding: '14px 18px',
                                    borderColor: on ? 'var(--border-bright)' : 'var(--border)',
                                    background: on ? 'var(--bg-card)' : 'var(--bg-surface)',
                                }}
                            >
                                {/* Bit index */}
                                <span className="mono text-xs w-5 text-center flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>{bit}</span>

                                {/* Toggle icon */}
                                {on
                                    ? <ToggleRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--cyan)' }} />
                                    : <ToggleLeft className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />}

                                {/* Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2.5 mb-0.5">
                                        <span className="mono text-sm font-semibold"
                                            style={{ color: on ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
                                        <span className={`badge ${source === 'AI' ? 'badge-indigo' : 'badge-green'}`}>{source}</span>
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

            {/* Threshold sliders */}
            <div>
                <p className="section-title">Threshold Tuning</p>
                <div className="card space-y-6">
                    {[
                        { label: 'Max Allowed Tax', val: maxTax, set: setMaxTax, unit: '%', min: 0, max: 50, step: 1 },
                        { label: 'Max Owner Holding', val: maxOwnerHolding, set: setMaxOwnerHolding, unit: '%', min: 0, max: 100, step: 5 },
                        { label: 'Min Pool Liquidity', val: minLiquidity, set: setMinLiquidity, unit: 'K USD', min: 0, max: 100, step: 1 },
                    ].map(({ label, val, set, unit, min, max, step }) => (
                        <div key={label}>
                            <div className="flex justify-between mono text-xs mb-2.5">
                                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                                <span style={{ color: 'var(--cyan)' }}>{val}{unit}</span>
                            </div>
                            <input type="range" min={min} max={max} step={step} value={val}
                                onChange={e => set(parseFloat(e.target.value))} style={{ width: '100%' }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
