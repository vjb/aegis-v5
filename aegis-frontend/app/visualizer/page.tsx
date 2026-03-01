'use client';

import { useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with React Flow
const ConsensusVisualizer = dynamic(
    () => import('../components/ConsensusVisualizer'),
    { ssr: false, loading: () => <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading visualizer...</div> }
);

const BRETT = 'BRETT';
const HONEYPOT = 'Honeypot';

export default function VisualizerPage() {
    const [token, setToken] = useState(BRETT);
    const [sseUrl, setSseUrl] = useState('');
    const [events, setEvents] = useState<any[]>([]);
    const [running, setRunning] = useState(false);

    const handleStart = useCallback(() => {
        setEvents([]);
        setRunning(true);
        setSseUrl(`/api/audit?token=${token}`);
    }, [token]);

    const handleEvent = useCallback((event: any) => {
        setEvents((prev) => [...prev, event]);
        if (event.type === 'verdict' || event.type === 'error') {
            setRunning(false);
        }
    }, []);

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
                    <label style={styles.label}>Token Address</label>
                    <input
                        style={styles.input}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="0x..."
                    />
                </div>
                <div style={styles.presets}>
                    <button
                        style={{ ...styles.preset, borderColor: token === BRETT ? '#22d3ee' : '#334155' }}
                        onClick={() => setToken(BRETT)}
                    >
                        🟢 MockBRETT (safe)
                    </button>
                    <button
                        style={{ ...styles.preset, borderColor: token === HONEYPOT ? '#ef4444' : '#334155' }}
                        onClick={() => setToken(HONEYPOT)}
                    >
                        🔴 MockHoneypot (malicious)
                    </button>
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
                <ConsensusVisualizer
                    sseUrl={sseUrl || undefined}
                    onEvent={handleEvent}
                />
            </div>

            {/* ── Event Log ──────────────────────── */}
            <div style={styles.eventLog}>
                <div style={styles.logTitle}>Event Log ({events.length})</div>
                <div style={styles.logBody}>
                    {events.length === 0 ? (
                        <div style={{ color: '#64748b', fontStyle: 'italic' }}>
                            Click "Start Audit" to see live events...
                        </div>
                    ) : (
                        events.map((e, i) => (
                            <div key={i} style={styles.logEntry}>
                                <span style={{ color: '#22d3ee', fontFamily: 'monospace', fontSize: '11px' }}>
                                    [{new Date(e.timestamp || Date.now()).toLocaleTimeString()}]
                                </span>{' '}
                                <span style={{
                                    color: e.type === 'verdict'
                                        ? (e.data?.riskCode === 0 ? '#4ade80' : '#f87171')
                                        : '#e2e8f0',
                                }}>
                                    {e.type}: {(JSON.stringify(e.data || e.stage || e.message || e.phase || '') || '').slice(0, 80)}
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
    header: {
        textAlign: 'center',
        marginBottom: '24px',
    },
    title: {
        fontSize: '28px',
        fontWeight: 800,
        color: '#22d3ee',
        margin: 0,
    },
    subtitle: {
        fontSize: '14px',
        color: '#94a3b8',
        marginTop: '6px',
    },
    controls: {
        maxWidth: '700px',
        margin: '0 auto 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    label: {
        fontSize: '12px',
        color: '#94a3b8',
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
    },
    input: {
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '10px 14px',
        color: '#e2e8f0',
        fontFamily: 'monospace',
        fontSize: '14px',
        outline: 'none',
    },
    presets: {
        display: 'flex',
        gap: '8px',
    },
    preset: {
        flex: 1,
        padding: '8px 12px',
        background: '#0f172a',
        border: '1px solid',
        borderRadius: '8px',
        color: '#e2e8f0',
        cursor: 'pointer',
        fontSize: '13px',
    },
    startBtn: {
        padding: '12px',
        background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
        border: 'none',
        borderRadius: '10px',
        color: '#fff',
        fontSize: '15px',
        fontWeight: 700,
        cursor: 'pointer',
        letterSpacing: '1px',
    },
    vizContainer: {
        height: '500px',
        maxWidth: '1000px',
        margin: '0 auto 24px',
        borderRadius: '12px',
        border: '1px solid #334155',
        overflow: 'hidden',
        background: '#0f172a',
    },
    eventLog: {
        maxWidth: '700px',
        margin: '0 auto',
        background: '#0f172a',
        borderRadius: '10px',
        border: '1px solid #334155',
        overflow: 'hidden',
    },
    logTitle: {
        padding: '10px 14px',
        fontSize: '12px',
        fontWeight: 700,
        color: '#94a3b8',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
    },
    logBody: {
        padding: '12px 14px',
        maxHeight: '200px',
        overflowY: 'auto',
        fontSize: '13px',
        lineHeight: 1.6,
    },
    logEntry: {
        borderBottom: '1px solid #1e293b',
        padding: '4px 0',
    },
};
