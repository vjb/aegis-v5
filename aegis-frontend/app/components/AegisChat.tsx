'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, Send, Loader2, BrainCircuit, ChevronRight, X } from 'lucide-react';

type Message = {
    id: string;
    role: 'user' | 'aegis';
    text: string;
    isAuditUpdate?: boolean;
};

type AuditResult = {
    token: string;
    status: string;
    score: number;
};

const AUDIT_TOKENS = ['BRETT', 'TOSHI', 'DEGEN', 'WETH', 'HoneypotCoin', 'TaxToken', 'TimeBomb', 'UnverifiedDoge', 'Honeypot', 'cbBTC'];

const SUGGESTIONS = [
    'What agents are connected?',
    'What is the firewall configured to block?',
    'What happened to REX?',
    'Explain Defense in Depth',
    'Audit BRETT',
    'Audit HoneypotCoin',
];

function detectAuditIntent(text: string): string | null {
    const lower = text.toLowerCase().trim();
    for (const t of AUDIT_TOKENS) {
        if (lower === `audit ${t.toLowerCase()}` ||
            lower === `audit ${t.toLowerCase()} please` ||
            lower.startsWith(`audit ${t.toLowerCase()} `) ||
            lower === `check ${t.toLowerCase()}` ||
            lower === `scan ${t.toLowerCase()}`) {
            return t;
        }
    }
    // Generic: "audit X" where X is anything
    const m = lower.match(/^(?:audit|check|scan)\s+([a-z0-9]+)/i);
    if (m) return m[1];
    return null;
}

export default function AegisChat({
    onAuditRequest,
    lastAuditResult,
}: {
    onAuditRequest?: (token: string) => void;
    lastAuditResult?: AuditResult | null;
}) {
    const [messages, setMessages] = useState<Message[]>([{
        id: 'welcome',
        role: 'aegis',
        text: 'AEGIS security firewall online. I\'m synced with the Chainlink CRE DON and your Tenderly Virtual TestNet. Ask me about agents, verdicts, or the firewall — or type "audit BRETT" to kick off a live oracle run.',
    }]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [pendingAuditToken, setPendingAuditToken] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // When oracle completes, inject status update into chat
    useEffect(() => {
        if (!lastAuditResult || !pendingAuditToken) return;
        if (lastAuditResult.token.toLowerCase() !== pendingAuditToken.toLowerCase()) return;

        const isApproved = lastAuditResult.status === 'APPROVED';
        const updateMsg: Message = {
            id: `audit-result-${Date.now()}`,
            role: 'aegis',
            isAuditUpdate: true,
            text: isApproved
                ? `✅ **${lastAuditResult.token} CLEARED** — riskCode=${lastAuditResult.score}. All 8 risk vectors clean. Swap can proceed.`
                : `⛔ **${lastAuditResult.token} BLOCKED** — riskCode=${lastAuditResult.score} (0x${lastAuditResult.score.toString(16).toUpperCase()}). Token flagged by the Chainlink CRE oracle.`,
        };
        setMessages(prev => [...prev, updateMsg]);
        setPendingAuditToken(null);
    }, [lastAuditResult, pendingAuditToken]);

    const send = useCallback(async (text?: string) => {
        const userText = (text ?? input).trim();
        if (!userText || streaming) return;

        setInput('');

        // Check for audit intent first
        const auditToken = detectAuditIntent(userText);
        if (auditToken && onAuditRequest) {
            const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userText };
            const aegisMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'aegis',
                text: `🔍 Launching CRE oracle audit for **${auditToken}**… Check the Oracle Feed on the right. I'll update you here when the verdict is in.`,
            };
            setMessages(prev => [...prev, userMsg, aegisMsg]);
            setPendingAuditToken(auditToken);
            onAuditRequest(auditToken);
            return;
        }

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userText };
        setMessages(prev => [...prev, userMsg]);
        setStreaming(true);

        const aegisId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: aegisId, role: 'aegis', text: '' }]);

        try {
            const history = [...messages, userMsg].map(m => ({
                role: m.role === 'aegis' ? 'assistant' : 'user',
                content: m.text,
            }));

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history }),
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
                        const { text: delta } = JSON.parse(chunk.slice(6));
                        if (delta) setMessages(prev => prev.map(m =>
                            m.id === aegisId ? { ...m, text: m.text + delta } : m
                        ));
                    } catch { /* ignore */ }
                }
            }
        } catch (e: any) {
            setMessages(prev => prev.map(m =>
                m.id === aegisId ? { ...m, text: `⚠ Error: ${e.message}` } : m
            ));
        } finally {
            setStreaming(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [input, streaming, messages, onAuditRequest]);

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border)', background: 'rgba(13,20,36,0.6)' }}>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="mono text-sm font-semibold" style={{ color: 'var(--cyan)' }}>AEGIS</span>
                        <span className="mono text-xs" style={{ color: 'var(--text-subtle)' }}>AI Security Oracle</span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full pulse-slow" style={{ background: 'var(--green)', boxShadow: '0 0 4px var(--green)' }} />
                    <span className="mono text-xs" style={{ color: 'var(--green)' }}>Online</span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '20px 16px 8px' }}>
                <div className="space-y-5">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            {msg.role === 'aegis' && (
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                    style={{ background: msg.isAuditUpdate ? 'rgba(74,222,128,0.15)' : 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', border: msg.isAuditUpdate ? '1px solid rgba(74,222,128,0.3)' : 'none' }}>
                                    <BrainCircuit className="w-3.5 h-3.5" style={{ color: msg.isAuditUpdate ? 'var(--green)' : 'white' }} />
                                </div>
                            )}
                            <div
                                className={`rounded-xl mono text-xs leading-relaxed ${msg.text === '' ? 'min-w-[60px] min-h-[36px]' : ''}`}
                                style={{
                                    maxWidth: '85%',
                                    padding: '12px 16px',
                                    background: msg.role === 'user'
                                        ? 'rgba(56,189,248,0.1)'
                                        : msg.isAuditUpdate
                                            ? 'rgba(74,222,128,0.05)'
                                            : 'var(--bg-card)',
                                    border: `1px solid ${msg.role === 'user'
                                        ? 'rgba(56,189,248,0.2)'
                                        : msg.isAuditUpdate
                                            ? 'rgba(74,222,128,0.2)'
                                            : 'var(--border)'}`,
                                    color: 'var(--text-primary)',
                                    lineHeight: 1.75,
                                    whiteSpace: 'pre-wrap',
                                }}>
                                {msg.text || (streaming && msg.role === 'aegis' ? (
                                    <span style={{ color: 'var(--cyan)' }}>
                                        <Loader2 className="w-3 h-3 animate-spin inline mr-1.5" />thinking…
                                    </span>
                                ) : '')}
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Suggestion chips — only in initial state */}
            {messages.length === 1 && (
                <div className="px-4 pb-3 flex-shrink-0">
                    <p className="mono text-xs mb-2.5" style={{ color: 'var(--text-subtle)' }}>Try asking:</p>
                    <div className="flex flex-col gap-2">
                        {SUGGESTIONS.map(s => (
                            <button key={s} onClick={() => send(s)}
                                className="flex items-center gap-2 text-left mono text-xs px-3 py-2.5 rounded-lg transition-all"
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                            >
                                <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--cyan)' }} />
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                        placeholder='Ask AEGIS or type "audit BRETT"…'
                        disabled={streaming}
                        className="inp mono text-xs"
                        style={{ flex: 1, height: 40 }}
                    />
                    <button onClick={() => send()} disabled={streaming || !input.trim()} className="btn btn-cyan"
                        style={{ padding: '0 16px', height: 40, flexShrink: 0 }}>
                        {streaming
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Send className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
