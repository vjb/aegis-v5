'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, Send, Loader2, BrainCircuit, ChevronRight } from 'lucide-react';

type Message = {
    id: string;
    role: 'user' | 'aegis';
    text: string;
};

const SUGGESTIONS = [
    'What agents are connected?',
    'What is the firewall configured to block?',
    'What happened to REX?',
    'What is the swiss cheese model?',
    'Explain Aegis in one paragraph',
    'What is the risk code for HoneypotCoin?',
];

export default function AegisChat() {
    const [messages, setMessages] = useState<Message[]>([{
        id: 'welcome',
        role: 'aegis',
        text: 'AEGIS security firewall online. I\'m synced with the Chainlink CRE DON and your Tenderly Virtual TestNet. Ask me about connected agents, their budgets, recent audit verdicts, or the firewall configuration.',
    }]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = async (text?: string) => {
        const userText = (text ?? input).trim();
        if (!userText || streaming) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userText };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
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
    };

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border)', background: 'rgba(13,20,36,0.6)' }}>
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', boxShadow: '0 0 12px rgba(56,189,248,0.3)' }}>
                        <Shield className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                        <span className="mono text-sm font-semibold" style={{ color: 'var(--cyan)' }}>AEGIS</span>
                        <span className="mono text-xs ml-2" style={{ color: 'var(--text-subtle)' }}>AI Security Oracle</span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full pulse-slow" style={{ background: 'var(--green)', boxShadow: '0 0 4px var(--green)' }} />
                    <span className="mono text-xs" style={{ color: 'var(--green)' }}>Online</span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '16px 16px 8px' }}>
                <div className="space-y-4">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            {msg.role === 'aegis' && (
                                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                                    style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)' }}>
                                    <BrainCircuit className="w-3 h-3 text-white" />
                                </div>
                            )}
                            <div className={`rounded-xl mono text-xs leading-relaxed max-w-[85%] ${msg.text === '' ? 'min-w-[40px]' : ''}`}
                                style={{
                                    padding: '10px 14px',
                                    background: msg.role === 'user'
                                        ? 'rgba(56,189,248,0.12)'
                                        : 'var(--bg-card)',
                                    border: `1px solid ${msg.role === 'user' ? 'rgba(56,189,248,0.2)' : 'var(--border)'}`,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'pre-wrap',
                                }}>
                                {msg.text || (streaming && msg.role === 'aegis' ? (
                                    <span style={{ color: 'var(--cyan)' }}>
                                        <Loader2 className="w-3 h-3 animate-spin inline mr-1" />thinking…
                                    </span>
                                ) : '')}
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Suggestion chips — only show when just the welcome message */}
            {messages.length === 1 && (
                <div className="px-4 pb-2 flex-shrink-0">
                    <p className="mono text-xs mb-2" style={{ color: 'var(--text-subtle)' }}>Try asking:</p>
                    <div className="flex flex-col gap-1.5">
                        {SUGGESTIONS.map(s => (
                            <button key={s} onClick={() => send(s)}
                                className="flex items-center gap-1.5 text-left mono text-xs px-3 py-2 rounded-lg transition-all"
                                style={{
                                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                                    color: 'var(--text-muted)',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                            >
                                <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--cyan)' }} />
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input */}
            <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                        placeholder="Ask AEGIS anything…"
                        disabled={streaming}
                        className="inp mono text-xs"
                        style={{ flex: 1, height: 38 }}
                    />
                    <button onClick={() => send()} disabled={streaming || !input.trim()} className="btn btn-cyan"
                        style={{ padding: '0 14px', height: 38, flexShrink: 0 }}>
                        {streaming
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Send className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
