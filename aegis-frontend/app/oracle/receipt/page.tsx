'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

// ── Types ───────────────────────────────────────────────────────────
interface AuditResult {
    protocol: string;
    payment: string;
    token: string;
    timestamp: string;
    pipeline: string;
    goplus: {
        honeypot: boolean;
        sellRestriction: boolean;
        proxy: boolean;
        verified: boolean;
    };
    basescan: {
        hasSource: boolean;
        sourceLength: number;
        contractName: string;
    };
    ai: Record<string, any>;
    riskCode: number;
    is_malicious: boolean;
    verdict: string;
}

// ── Receipt Component ───────────────────────────────────────────────
function ReceiptContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const [result, setResult] = useState<AuditResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Check sessionStorage for pre-loaded result
        const stored = sessionStorage.getItem('x402_audit_result');
        if (stored) {
            try {
                setResult(JSON.parse(stored));
                setLoading(false);
                sessionStorage.removeItem('x402_audit_result');
                return;
            } catch { }
        }

        // If no stored result, show demo data
        if (!token) {
            setResult({
                protocol: 'x402',
                payment: '$0.05 USDC',
                token: '0x46d40e0abda0814bb0cb323b2bb85a129d00b0ac',
                timestamp: new Date().toISOString(),
                pipeline: 'Aegis CRE v5',
                goplus: { honeypot: false, sellRestriction: false, proxy: false, verified: false },
                basescan: { hasSource: false, sourceLength: 0, contractName: 'Unknown' },
                ai: { skipped: 'no source code' },
                riskCode: 1,
                is_malicious: true,
                verdict: 'BLOCKED',
            });
            setLoading(false);
            return;
        }

        // Try fetching (will 402 without payment — just for demo)
        fetch(`/api/oracle/audit?token=${token}`)
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    setResult(data);
                } else {
                    setError(`HTTP ${res.status}: Payment required`);
                }
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.receipt}>
                    <div style={styles.loading}>Scanning contract...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.container}>
                <div style={styles.receipt}>
                    <div style={{ ...styles.loading, color: '#ef4444' }}>{error}</div>
                </div>
            </div>
        );
    }

    if (!result) return null;

    const isBlocked = result.verdict === 'BLOCKED';
    const riskBinary = result.riskCode.toString(2).padStart(8, '0');
    const truncAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

    const riskBits = [
        { bit: 0, label: 'Unverified Source', flag: !!(result.riskCode & 1) },
        { bit: 1, label: 'Sell Restriction', flag: !!(result.riskCode & 2) },
        { bit: 2, label: 'Honeypot', flag: !!(result.riskCode & 4) },
        { bit: 3, label: 'Upgradeable Proxy', flag: !!(result.riskCode & 8) },
        { bit: 4, label: 'Obfuscated Tax', flag: !!(result.riskCode & 16) },
        { bit: 5, label: 'Privilege Escalation', flag: !!(result.riskCode & 32) },
        { bit: 6, label: 'External Call Risk', flag: !!(result.riskCode & 64) },
        { bit: 7, label: 'Logic Bomb', flag: !!(result.riskCode & 128) },
    ];

    return (
        <div style={styles.container}>
            <div style={styles.receipt}>
                {/* ── Header ──────────────────────────── */}
                <div style={styles.header}>
                    <div style={styles.logo}>⛨ AEGIS</div>
                    <div style={styles.subtitle}>CRE Oracle Audit Receipt</div>
                </div>

                <div style={styles.divider}>{'─'.repeat(48)}</div>

                {/* ── Verdict Banner ──────────────────── */}
                <div style={{
                    ...styles.verdictBanner,
                    background: isBlocked
                        ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
                        : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                }}>
                    <div style={styles.verdictIcon}>{isBlocked ? '⛔' : '✅'}</div>
                    <div style={styles.verdictText}>{result.verdict}</div>
                    <div style={styles.verdictRisk}>Risk Code: {result.riskCode} (0b{riskBinary})</div>
                </div>

                {/* ── Transaction Details ─────────────── */}
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>Transaction</div>
                    <div style={styles.row}>
                        <span style={styles.label}>Protocol</span>
                        <span style={styles.value}>{result.protocol.toUpperCase()}</span>
                    </div>
                    <div style={styles.row}>
                        <span style={styles.label}>Payment</span>
                        <span style={{ ...styles.value, color: '#22d3ee' }}>{result.payment}</span>
                    </div>
                    <div style={styles.row}>
                        <span style={styles.label}>Pipeline</span>
                        <span style={styles.value}>{result.pipeline}</span>
                    </div>
                    <div style={styles.row}>
                        <span style={styles.label}>Timestamp</span>
                        <span style={styles.value}>{new Date(result.timestamp).toLocaleString()}</span>
                    </div>
                </div>

                <div style={styles.dividerThin} />

                {/* ── Token Details ───────────────────── */}
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>Token</div>
                    <div style={styles.row}>
                        <span style={styles.label}>Address</span>
                        <span style={{ ...styles.value, fontFamily: 'monospace', fontSize: '12px' }}>
                            {truncAddr(result.token)}
                        </span>
                    </div>
                    <div style={styles.row}>
                        <span style={styles.label}>Contract</span>
                        <span style={styles.value}>{result.basescan?.contractName || 'Unknown'}</span>
                    </div>
                    <div style={styles.row}>
                        <span style={styles.label}>Source Verified</span>
                        <span style={{ ...styles.value, color: result.basescan?.hasSource ? '#4ade80' : '#f87171' }}>
                            {result.basescan?.hasSource ? 'Yes' : 'No'}
                        </span>
                    </div>
                </div>

                <div style={styles.dividerThin} />

                {/* ── Risk Matrix ────────────────────── */}
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>8-Bit Risk Matrix</div>
                    <div style={styles.riskGrid}>
                        {riskBits.map((r) => (
                            <div key={r.bit} style={{
                                ...styles.riskItem,
                                borderColor: r.flag ? '#ef4444' : '#334155',
                                background: r.flag ? 'rgba(239,68,68,0.1)' : 'transparent',
                            }}>
                                <span style={{
                                    ...styles.riskDot,
                                    background: r.flag ? '#ef4444' : '#475569',
                                }} />
                                <span style={{ color: r.flag ? '#fca5a5' : '#94a3b8', fontSize: '11px' }}>
                                    Bit {r.bit}: {r.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={styles.dividerThin} />

                {/* ── GoPlus Results ─────────────────── */}
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>GoPlus Security</div>
                    {Object.entries(result.goplus || {}).map(([k, v]) => (
                        <div key={k} style={styles.row}>
                            <span style={styles.label}>{k}</span>
                            <span style={{ ...styles.value, color: v ? '#f87171' : '#4ade80' }}>
                                {v ? '⚠ FLAGGED' : '✓ CLEAR'}
                            </span>
                        </div>
                    ))}
                </div>

                <div style={styles.dividerThin} />

                {/* ── AI Analysis ────────────────────── */}
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>AI Analysis</div>
                    {result.ai?.skipped ? (
                        <div style={styles.row}>
                            <span style={styles.label}>Status</span>
                            <span style={{ ...styles.value, color: '#94a3b8' }}>
                                Skipped: {result.ai.skipped}
                            </span>
                        </div>
                    ) : (
                        Object.entries(result.ai || {}).map(([k, v]) => (
                            <div key={k} style={styles.row}>
                                <span style={styles.label}>{k}</span>
                                <span style={{
                                    ...styles.value,
                                    color: typeof v === 'boolean' ? (v ? '#f87171' : '#4ade80') : '#e2e8f0'
                                }}>
                                    {typeof v === 'boolean' ? (v ? '⚠ YES' : '✓ NO') : String(v)}
                                </span>
                            </div>
                        ))
                    )}
                </div>

                {/* ── Footer ─────────────────────────── */}
                <div style={styles.divider}>{'─'.repeat(48)}</div>
                <div style={styles.footer}>
                    <div>Powered by Chainlink CRE · GoPlus · GPT-4o · Llama-3</div>
                    <div style={{ marginTop: '4px', color: '#64748b' }}>
                        ERC-7579 Module · Base Sepolia (84532)
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Styles ──────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', -apple-system, sans-serif",
    },
    receipt: {
        width: '100%',
        maxWidth: '480px',
        background: '#1e293b',
        borderRadius: '16px',
        border: '1px solid #334155',
        padding: '32px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
    },
    header: {
        textAlign: 'center',
        marginBottom: '16px',
    },
    logo: {
        fontSize: '28px',
        fontWeight: 800,
        color: '#22d3ee',
        letterSpacing: '3px',
    },
    subtitle: {
        fontSize: '13px',
        color: '#94a3b8',
        marginTop: '4px',
        letterSpacing: '1px',
        textTransform: 'uppercase' as const,
    },
    divider: {
        textAlign: 'center',
        color: '#334155',
        fontSize: '10px',
        letterSpacing: '-1px',
        margin: '12px 0',
        overflow: 'hidden',
    },
    dividerThin: {
        height: '1px',
        background: '#334155',
        margin: '16px 0',
    },
    verdictBanner: {
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
        margin: '16px 0',
    },
    verdictIcon: {
        fontSize: '36px',
        marginBottom: '8px',
    },
    verdictText: {
        fontSize: '24px',
        fontWeight: 800,
        color: '#fff',
        letterSpacing: '4px',
    },
    verdictRisk: {
        fontSize: '12px',
        color: 'rgba(255,255,255,0.7)',
        marginTop: '6px',
        fontFamily: 'monospace',
    },
    section: {
        marginBottom: '4px',
    },
    sectionTitle: {
        fontSize: '11px',
        fontWeight: 700,
        color: '#64748b',
        textTransform: 'uppercase' as const,
        letterSpacing: '2px',
        marginBottom: '10px',
    },
    row: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
    },
    label: {
        fontSize: '13px',
        color: '#94a3b8',
    },
    value: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#e2e8f0',
    },
    riskGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6px',
    },
    riskItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 8px',
        borderRadius: '6px',
        border: '1px solid',
    },
    riskDot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        flexShrink: 0,
    },
    loading: {
        textAlign: 'center',
        color: '#22d3ee',
        fontSize: '16px',
        padding: '40px 0',
    },
    footer: {
        textAlign: 'center',
        fontSize: '10px',
        color: '#94a3b8',
        lineHeight: 1.4,
    },
};

// ── Page Export ──────────────────────────────────────────────────────
export default function ReceiptPage() {
    return (
        <Suspense fallback={
            <div style={styles.container}>
                <div style={styles.receipt}>
                    <div style={styles.loading}>Loading receipt...</div>
                </div>
            </div>
        }>
            <ReceiptContent />
        </Suspense>
    );
}
