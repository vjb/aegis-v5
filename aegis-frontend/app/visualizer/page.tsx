'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { ConsensusVisualizerHandle, VisualizerEvent } from '../components/ConsensusVisualizer';

// Dynamic import to avoid SSR issues with React Flow
const ConsensusVisualizer = dynamic(
    () => import('../components/ConsensusVisualizer'),
    { ssr: false, loading: () => <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading visualizer...</div> }
);

const PRESETS = [
    { label: '🟢 MockBRETT (safe)', value: 'BRETT', border: '#22d3ee' },
    { label: '🔴 MockHoneypot', value: 'Honeypot', border: '#ef4444' },
    { label: '🟡 TaxToken', value: 'TAX', border: '#fbbf24' },
    { label: '🔮 UnverifiedDoge', value: 'UnverifiedDoge', border: '#818cf8' },
];

type LogEntry = { ts: number; raw: any };

export default function VisualizerPage() {
    const [token, setToken] = useState('BRETT');
    const [events, setEvents] = useState<LogEntry[]>([]);
    const [running, setRunning] = useState(false);
    const vizRef = useRef<ConsensusVisualizerHandle>(null);
    const abortRef = useRef<AbortController | null>(null);

    // ── Map /api/audit SSE events → ConsensusVisualizer VisualizerEvent ──
    const mapAndDispatch = useCallback((data: any) => {
        const viz = vizRef.current;
        if (!viz) return;

        switch (data.type) {
            case 'phase': {
                const p = data.phase as string;
                if (p.includes('Connecting')) {
                    viz.processEvent({ type: 'audit_requested', token });
                } else if (p.includes('Submitting requestAudit')) {
                    viz.processEvent({ type: 'bundler_relay' });
                } else if (p.includes('Spinning up Oracle Brain')) {
                    viz.processEvent({ type: 'don_started' });
                } else if (p.includes('GoPlus')) {
                    // GoPlus phase done
                } else if (p.includes('BaseScan')) {
                    // BaseScan phase done
                } else if (p.includes('AI Consensus')) {
                    // AI consensus phase
                } else if (p.includes('Committing')) {
                    // On-chain commit phase
                } else if (p.includes('Finalising')) {
                    // Final
                }
                break;
            }
            case 'tx': {
                // requestAudit() confirmed on-chain → bundler done, DON starts
                viz.processEvent({ type: 'bundler_relay' });
                break;
            }
            case 'static-analysis': {
                if (data.source?.includes('GoPlus') && data.status !== 'pending') {
                    const flags = data.flags?.join(', ') || (data.is_honeypot ? 'honeypot' : 'clean');
                    viz.processEvent({ type: 'goplus_complete', result: flags });
                }
                if (data.source?.includes('BaseScan') && data.status !== 'pending') {
                    viz.processEvent({ type: 'basescan_complete', result: 'source retrieved' });
                }
                break;
            }
            case 'llm-reasoning-start': {
                if (data.model?.includes('GPT-4o')) {
                    viz.processEvent({ type: 'gpt4o_started' });
                } else if (data.model?.includes('Llama')) {
                    viz.processEvent({ type: 'llama3_started' });
                }
                break;
            }
            case 'llm-reasoning-chunk': {
                // Streaming text — no viz event needed, logged below
                break;
            }
            case 'llm-score': {
                if (data.model?.includes('GPT-4o')) {
                    viz.processEvent({ type: 'gpt4o_complete', result: `bit ${data.bit}` });
                } else if (data.model?.includes('Llama')) {
                    viz.processEvent({ type: 'llama3_complete', result: `bit ${data.bit}` });
                }
                break;
            }
            case 'final_verdict': {
                const v = data.payload;
                viz.processEvent({
                    type: 'consensus_reached',
                    verdict: v.status === 'APPROVED' ? 'approved' : 'blocked',
                    riskCode: v.score,
                });
                break;
            }
            case 'tx-status': {
                viz.processEvent({ type: 'settlement', result: data.status || 'committed' });
                break;
            }
        }
    }, [token]);

    // ── Start audit SSE ──────────────────────────────────
    const handleStart = useCallback(async () => {
        if (running) return;
        setEvents([]);
        setRunning(true);
        vizRef.current?.reset();

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch(`/api/audit?token=${encodeURIComponent(token)}&amount=0.1&auditOnly=true`, {
                signal: controller.signal,
            });
            if (!res.body) throw new Error('No stream');

            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split('\n\n');
                buf = lines.pop() || '';
                for (const chunk of lines) {
                    if (!chunk.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(chunk.slice(6));
                        setEvents(prev => [...prev, { ts: Date.now(), raw: data }]);
                        mapAndDispatch(data);
                    } catch { /* ignore malformed */ }
                }
            }
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                setEvents(prev => [...prev, { ts: Date.now(), raw: { type: 'error', message: e.message } }]);
            }
        } finally {
            setRunning(false);
            abortRef.current = null;
        }
    }, [token, running, mapAndDispatch]);

    // Cleanup on unmount
    useEffect(() => () => abortRef.current?.abort(), []);

    return (
        <div style={styles.page}>
            {/* ── Header ─────────────────────────── */}
            <div style={styles.header}>
                <h1 style={styles.title}>⛨ Aegis CRE Pipeline Visualizer</h1>
                <p style={styles.subtitle}>
                    Watch the Chainlink Runtime Environment process a token audit in real-time
                </p>
            </div>

            {/* ── Controls ────────────────────────── */}
            <div style={styles.controls}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Token Name</label>
                    <input
                        style={styles.input}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="BRETT, Honeypot, TAX, etc."
                    />
                </div>
                <div style={styles.presets}>
                    {PRESETS.map(p => (
                        <button
                            key={p.value}
                            style={{ ...styles.preset, borderColor: token === p.value ? p.border : '#334155' }}
                            onClick={() => setToken(p.value)}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <button
                    style={{
                        ...styles.startBtn,
                        opacity: running ? 0.5 : 1,
                        cursor: running ? 'not-allowed' : 'pointer',
                    }}
                    onClick={handleStart}
                    disabled={running}
                >
                    {running ? '🔄 Running CRE Pipeline...' : '▶ Start Audit'}
                </button>
            </div>

            {/* ── Visualizer ─────────────────────── */}
            <div style={styles.vizContainer}>
                <ConsensusVisualizer ref={vizRef} />
            </div>

            {/* ── Event Log ──────────────────────── */}
            <div style={styles.eventLog}>
                <div style={styles.logTitle}>CRE Event Log ({events.length})</div>
                <div style={styles.logBody}>
                    {events.length === 0 ? (
                        <div style={{ color: '#64748b', fontStyle: 'italic' }}>
                            Click "Start Audit" to begin the CRE pipeline...
                        </div>
                    ) : (
                        events.map((e, i) => (
                            <div key={i} style={styles.logEntry}>
                                <span style={{ color: '#22d3ee', fontFamily: 'monospace', fontSize: '11px' }}>
                                    [{new Date(e.ts).toLocaleTimeString()}]
                                </span>{' '}
                                <span style={{
                                    color: e.raw.type === 'final_verdict'
                                        ? (e.raw.payload?.score === 0 ? '#4ade80' : '#f87171')
                                        : e.raw.type === 'error' ? '#f87171'
                                            : e.raw.type === 'llm-reasoning-chunk' ? '#a78bfa'
                                                : '#e2e8f0',
                                }}>
                                    <strong>{e.raw.type}</strong>
                                    {e.raw.phase && `: ${e.raw.phase}`}
                                    {e.raw.source && ` [${e.raw.source}]`}
                                    {e.raw.model && ` [${e.raw.model}]`}
                                    {e.raw.text && ` — ${e.raw.text.slice(0, 60)}`}
                                    {e.raw.message && `: ${e.raw.message.slice(0, 80)}`}
                                    {e.raw.hash && ` → ${e.raw.hash.slice(0, 16)}…`}
                                    {e.raw.payload?.status && ` → ${e.raw.payload.status} (rc=${e.raw.payload.score})`}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        padding: '24px',
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: '#e2e8f0',
    },
    header: { textAlign: 'center', marginBottom: '24px' },
    title: { fontSize: '28px', fontWeight: 800, color: '#22d3ee', margin: 0 },
    subtitle: { fontSize: '14px', color: '#94a3b8', marginTop: '6px' },
    controls: {
        maxWidth: '700px', margin: '0 auto 24px',
        display: 'flex', flexDirection: 'column', gap: '12px',
    },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: '1px' },
    input: {
        background: '#0f172a', border: '1px solid #334155', borderRadius: '8px',
        padding: '10px 14px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '14px', outline: 'none',
    },
    presets: { display: 'flex', gap: '8px', flexWrap: 'wrap' as const },
    preset: {
        flex: 1, minWidth: '120px', padding: '8px 12px', background: '#0f172a',
        border: '1px solid', borderRadius: '8px', color: '#e2e8f0', cursor: 'pointer', fontSize: '12px',
    },
    startBtn: {
        padding: '12px',
        background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
        border: 'none', borderRadius: '10px', color: '#fff',
        fontSize: '15px', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px',
    },
    vizContainer: {
        height: '500px', maxWidth: '1000px', margin: '0 auto 24px',
        borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden', background: '#0f172a',
    },
    eventLog: {
        maxWidth: '700px', margin: '0 auto', background: '#0f172a',
        borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden',
    },
    logTitle: {
        padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#94a3b8',
        background: '#1e293b', borderBottom: '1px solid #334155',
        textTransform: 'uppercase' as const, letterSpacing: '1px',
    },
    logBody: {
        padding: '12px 14px', maxHeight: '250px', overflowY: 'auto', fontSize: '13px', lineHeight: 1.6,
    },
    logEntry: { borderBottom: '1px solid #1e293b', padding: '4px 0' },
};
