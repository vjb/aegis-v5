'use client';

import { useState, useEffect, useRef } from 'react';
import { BrainCircuit, CheckCircle, XCircle, Loader2, Send, ChevronRight, Activity, Trash2 } from 'lucide-react';

type Phase = { label: string; status: 'pending' | 'running' | 'done' | 'error' };
type LLMBlock = { model: string; text: string; score?: number };
type Verdict = {
    status: 'APPROVED' | 'BLOCKED' | 'ERROR';
    score: number;
    targetToken: string;
    reasoning: string;
    checks: { name: string; triggered: boolean }[];
    hash?: string;
    explorerUrl?: string;
    callbackExplorerUrl?: string;
};

type RunRecord = {
    id: string;
    token: string;
    phases: Phase[];
    llmBlocks: LLMBlock[];
    verdict: Verdict | null;
    error: string | null;
    running: boolean;
};

export default function OracleFeed({ isKilled, externalTrigger, onTriggerConsumed, onComplete }: {
    isKilled: boolean;
    externalTrigger: string | null;
    onTriggerConsumed: () => void;
    onComplete?: (result: { token: string; status: string; score: number }) => void;
}) {
    const [runs, setRuns] = useState<RunRecord[]>([]);
    const [token, setToken] = useState('');
    const [globalRunning, setGlobalRunning] = useState(false);
    const feedRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (externalTrigger && !globalRunning) {
            setToken(externalTrigger);
            onTriggerConsumed();
            setTimeout(() => runAudit(externalTrigger), 150);
        }
    }, [externalTrigger]);

    useEffect(() => {
        feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
    }, [runs]);

    const upsertPhase = (runId: string, label: string, status: Phase['status']) => {
        setRuns(prev => prev.map(r => {
            if (r.id !== runId) return r;
            const idx = r.phases.findIndex(p => p.label === label);
            const phases = [...r.phases];
            if (idx >= 0) phases[idx] = { ...phases[idx], status };
            else phases.push({ label, status });
            return { ...r, phases };
        }));
    };

    const runAudit = async (tok?: string) => {
        const target = tok || token;
        if (!target || globalRunning || isKilled) return;

        const runId = `run-${Date.now()}`;
        const newRun: RunRecord = {
            id: runId,
            token: target,
            phases: [{ label: 'Connecting to Chainlink CRE DON', status: 'running' }],
            llmBlocks: [],
            verdict: null,
            error: null,
            running: true,
        };
        setRuns(prev => [...prev, newRun]);
        setGlobalRunning(true);

        try {
            const res = await fetch(`/api/audit?token=${encodeURIComponent(target)}&amount=0.1&auditOnly=true`);
            if (!res.body) throw new Error('No stream returned');

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
                    try { handleEvent(runId, JSON.parse(chunk.slice(6))); } catch { /* ignore */ }
                }
            }
        } catch (e: any) {
            setRuns(prev => prev.map(r => r.id === runId
                ? { ...r, error: e.message || 'Stream failed', running: false, phases: r.phases.map(p => p.status === 'running' ? { ...p, status: 'error' } : p) }
                : r));
            setGlobalRunning(false);
        }
    };

    const handleEvent = (runId: string, data: any) => {
        switch (data.type) {
            case 'phase': {
                upsertPhase(runId, data.phase, 'done');
                const NEXT: Record<string, string> = {
                    'Connecting to Chainlink CRE DON': 'Submitting requestAudit() on-chain',
                    'Spinning up Oracle Brain': 'GoPlus — Static Analysis',
                    'GoPlus — Static Analysis': 'BaseScan — Contract Source',
                    'BaseScan — Contract Source': 'AI Consensus (GPT-4o + Llama-3)',
                    'AI Consensus (GPT-4o + Llama-3)': 'Computing Risk Code',
                    'Computing Risk Code': 'Committing via onReportDirect()',
                };
                const nxt = Object.entries(NEXT).find(([k]) => data.phase.includes(k.slice(0, 20)))?.[1];
                if (nxt) upsertPhase(runId, nxt, 'running');
                break;
            }
            case 'static-analysis': {
                const isGoPlus = data.source?.includes('GoPlus');
                const isBaseScan = data.source?.includes('BaseScan');
                if (isGoPlus) {
                    data.status === 'pending'
                        ? upsertPhase(runId, 'GoPlus — Static Analysis', 'running')
                        : (upsertPhase(runId, 'GoPlus — Static Analysis', 'done'), upsertPhase(runId, 'BaseScan — Contract Source', 'running'));
                } else if (isBaseScan) {
                    data.status === 'pending'
                        ? upsertPhase(runId, 'BaseScan — Contract Source', 'running')
                        : (upsertPhase(runId, 'BaseScan — Contract Source', 'done'), upsertPhase(runId, 'AI Consensus (GPT-4o + Llama-3)', 'running'));
                }
                break;
            }
            case 'llm-reasoning-start': {
                setRuns(prev => prev.map(r => r.id === runId ? { ...r, llmBlocks: [...r.llmBlocks, { model: data.model, text: '' }] } : r));
                upsertPhase(runId, 'AI Consensus (GPT-4o + Llama-3)', 'running');
                break;
            }
            case 'llm-reasoning-chunk': {
                setRuns(prev => prev.map(r => r.id === runId
                    ? { ...r, llmBlocks: r.llmBlocks.map(b => b.model === data.model ? { ...b, text: b.text + data.text } : b) }
                    : r));
                break;
            }
            case 'llm-score': {
                setRuns(prev => prev.map(r => r.id === runId
                    ? { ...r, llmBlocks: r.llmBlocks.map(b => b.model === data.model ? { ...b, score: ((b.score ?? 0) | data.bit) } : b) }
                    : r));
                break;
            }
            case 'tx': {
                upsertPhase(runId, 'Submitting requestAudit() on-chain', 'done');
                upsertPhase(runId, 'Spinning up Oracle Brain', 'running');
                break;
            }
            case 'tx-status': {
                upsertPhase(runId, 'Committing via onReportDirect()', data.status === 'Confirmed' ? 'done' : 'error');
                break;
            }
            case 'final_verdict': {
                const v: Verdict = data.payload;
                setRuns(prev => prev.map(r => r.id === runId
                    ? { ...r, verdict: v, running: false, phases: r.phases.map(p => p.status === 'running' ? { ...p, status: 'done' } : p) }
                    : r));
                setGlobalRunning(false);
                onComplete?.({ token: v.targetToken, status: v.status, score: v.score });
                break;
            }
            case 'error': {
                setRuns(prev => prev.map(r => r.id === runId
                    ? { ...r, error: data.message, running: false, phases: r.phases.map(p => p.status === 'running' ? { ...p, status: 'error' } : p) }
                    : r));
                setGlobalRunning(false);
                break;
            }
        }
    };

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border)', background: 'rgba(13,20,36,0.5)' }}>
                <div className="flex items-center gap-3">
                    <span className="mono text-sm font-semibold" style={{ color: 'var(--cyan)' }}>ORACLE FEED</span>
                    {globalRunning && (
                        <span className="flex items-center gap-1.5 mono text-xs" style={{ color: 'var(--amber)' }}>
                            <Loader2 className="w-3 h-3 animate-spin" /> auditing…
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className="mono text-xs" style={{ color: 'var(--text-subtle)' }}>GoPlus · AI</span>
                    {runs.length > 0 && (
                        <button onClick={() => setRuns([])} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} title="Clear feed">
                            <Trash2 className="w-3.5 h-3.5" /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Live feed — scrollable, accumulates runs */}
            <div ref={feedRef} className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
                {runs.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 180, paddingTop: 40 }}>
                        <BrainCircuit className="w-10 h-10" style={{ color: 'var(--text-subtle)' }} />
                        <div className="text-center">
                            <p className="mono text-sm" style={{ color: 'var(--text-muted)' }}>Oracle feed empty</p>
                            <p className="mono text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
                                Click "Simulate Trade" on an agent card,<br />
                                or type "audit BRETT" in the chat
                            </p>
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    {runs.map((run) => (
                        <div key={run.id}>
                            {/* Run header */}
                            <div className="flex items-center gap-2 mb-3">
                                <span className="mono text-xs font-semibold" style={{ color: 'var(--cyan)' }}>▸ {run.token}</span>
                                {run.running && <span className="mono text-xs" style={{ color: 'var(--amber)' }}>auditing…</span>}
                                {run.verdict && (
                                    <span className={`badge ${run.verdict.status === 'APPROVED' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                                        {run.verdict.status}
                                    </span>
                                )}
                            </div>

                            {/* Phases */}
                            <div className="space-y-2 mb-3">
                                {run.phases.map((p, i) => (
                                    <div key={i} className="flex items-center gap-2.5 mono text-xs">
                                        {p.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" style={{ color: 'var(--cyan)' }} />}
                                        {p.status === 'done' && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--green)' }} />}
                                        {p.status === 'error' && <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--red)' }} />}
                                        {p.status === 'pending' && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />}
                                        <span style={{
                                            color: p.status === 'running' ? 'var(--cyan)'
                                                : p.status === 'done' ? 'var(--text-muted)'
                                                    : p.status === 'error' ? 'var(--red)'
                                                        : 'var(--text-subtle)',
                                        }}>{p.label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* LLM reasoning blocks */}
                            {run.llmBlocks.map((block, i) => (
                                <div key={i} className="card slide-in" style={{ marginTop: 10, padding: '14px 16px' }}>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <span className="mono text-xs font-semibold" style={{ color: 'var(--indigo)' }}>↪ [{block.model}]</span>
                                        {block.score !== undefined && (
                                            <span className={`badge ${block.score === 0 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                                                {block.score === 0 ? '0x00 clean ✅' : `0x${block.score.toString(16).toUpperCase()}`}
                                            </span>
                                        )}
                                    </div>
                                    {block.text && (
                                        <p className="mono text-xs leading-relaxed"
                                            style={{ color: 'var(--text-muted)', maxHeight: 100, overflowY: 'auto', lineHeight: 1.75 }}>
                                            {block.text}
                                        </p>
                                    )}
                                </div>
                            ))}

                            {/* Error */}
                            {run.error && (
                                <div className="card slide-in" style={{ borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.05)', padding: '12px 16px', marginTop: 10 }}>
                                    <p className="mono text-xs font-semibold mb-1" style={{ color: 'var(--red)' }}>Oracle Error</p>
                                    <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{run.error}</p>
                                </div>
                            )}

                            {/* Verdict */}
                            {run.verdict && (
                                <div className="card slide-in" style={{
                                    marginTop: 10, padding: '16px',
                                    background: run.verdict.status === 'APPROVED' ? 'rgba(74,222,128,0.04)' : 'rgba(248,113,113,0.04)',
                                    borderColor: run.verdict.status === 'APPROVED' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)',
                                }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            {run.verdict.status === 'APPROVED'
                                                ? <CheckCircle className="w-5 h-5" style={{ color: 'var(--green)' }} />
                                                : <XCircle className="w-5 h-5" style={{ color: 'var(--red)' }} />}
                                            <p className="mono font-bold text-xs"
                                                style={{ color: run.verdict.status === 'APPROVED' ? 'var(--green)' : 'var(--red)' }}>
                                                {run.verdict.status === 'APPROVED' ? 'APPROVED' : 'BLOCKED'}
                                            </p>
                                        </div>
                                        <span className={`badge ${run.verdict.status === 'APPROVED' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10 }}>
                                            riskCode: {run.verdict.score}
                                        </span>
                                    </div>

                                    {run.verdict.status === 'APPROVED' ? (
                                        <p className="mono text-xs mb-3" style={{ color: 'var(--green)' }}>✓ All 8 risk vectors clean</p>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-1.5 mb-3">
                                            {run.verdict.checks.filter(c => c.triggered).map((c, i) => (
                                                <div key={i} className="flex items-center gap-1.5 mono text-xs">
                                                    <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--red)' }} />
                                                    <span style={{ color: 'var(--red)' }}>{c.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <p className="mono text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 10 }}>
                                        {run.verdict.reasoning}
                                    </p>

                                    <div className="flex flex-col gap-1 mt-3">
                                        {run.verdict.explorerUrl && (
                                            <a href={run.verdict.explorerUrl} target="_blank" rel="noreferrer"
                                                className="mono text-xs" style={{ color: 'var(--cyan)', fontSize: 10 }}>
                                                requestAudit() → Tenderly ↗
                                            </a>
                                        )}
                                        {run.verdict.callbackExplorerUrl && (
                                            <a href={run.verdict.callbackExplorerUrl} target="_blank" rel="noreferrer"
                                                className="mono text-xs" style={{ color: 'var(--cyan)', fontSize: 10 }}>
                                                onReportDirect() → Tenderly ↗
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Divider between runs */}
                            <div style={{ borderBottom: '1px solid var(--border)', marginTop: 16 }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
