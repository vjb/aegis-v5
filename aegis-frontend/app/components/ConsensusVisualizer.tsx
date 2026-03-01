'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    MarkerType,
    Handle,
    Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface PipelinePhase {
    id: string;
    label: string;
    status: 'idle' | 'active' | 'complete' | 'error';
    detail?: string;
}

export type VisualizerEvent =
    | { type: 'audit_requested'; token: string }
    | { type: 'bundler_relay' }
    | { type: 'don_started' }
    | { type: 'goplus_complete'; result: string }
    | { type: 'basescan_complete'; result: string }
    | { type: 'gpt4o_started' }
    | { type: 'llama3_started' }
    | { type: 'gpt4o_complete'; result: string }
    | { type: 'llama3_complete'; result: string }
    | { type: 'consensus_reached'; verdict: 'approved' | 'blocked'; riskCode: number }
    | { type: 'settlement'; result: string };

// ═══════════════════════════════════════════════════════════════════════
//  CUSTOM NODE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

interface CustomNodeData {
    label: string;
    subtitle?: string;
    icon: string;
    status: 'idle' | 'active' | 'complete' | 'error';
    detail?: string;
}

function PipelineNode({ data }: { data: CustomNodeData }) {
    const statusColor = {
        idle: '#334155',
        active: '#0ea5e9',
        complete: '#22c55e',
        error: '#ef4444',
    }[data.status];

    const glowColor = {
        idle: 'transparent',
        active: 'rgba(14, 165, 233, 0.4)',
        complete: 'rgba(34, 197, 94, 0.3)',
        error: 'rgba(239, 68, 68, 0.4)',
    }[data.status];

    return (
        <motion.div
            data-testid={`pipeline-node-${data.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                border: `2px solid ${statusColor}`,
                borderRadius: 12,
                padding: '12px 20px',
                minWidth: 180,
                textAlign: 'center',
                color: '#e2e8f0',
                boxShadow: `0 0 20px ${glowColor}, 0 4px 12px rgba(0,0,0,0.4)`,
                position: 'relative',
            }}
            animate={{
                borderColor: statusColor,
                boxShadow: data.status === 'active'
                    ? [`0 0 20px ${glowColor}`, `0 0 40px ${glowColor}`, `0 0 20px ${glowColor}`]
                    : `0 0 20px ${glowColor}`,
            }}
            transition={{ duration: 0.6, repeat: data.status === 'active' ? Infinity : 0, repeatType: 'reverse' }}
        >
            <Handle type="target" position={Position.Left} style={{ background: statusColor, border: 'none' }} />
            <div style={{ fontSize: 24, marginBottom: 4 }}>{data.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', color: '#f8fafc' }}>
                {data.label}
            </div>
            {data.subtitle && (
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{data.subtitle}</div>
            )}
            {data.detail && (
                <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ fontSize: 10, color: '#67e8f9', marginTop: 6, fontFamily: 'monospace' }}
                >
                    {data.detail}
                </motion.div>
            )}
            <Handle type="source" position={Position.Right} style={{ background: statusColor, border: 'none' }} />
        </motion.div>
    );
}

// ═══════════════════════════════════════════════════════════════════════
//  NODE + EDGE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

const NODE_IDS = {
    SAFE: 'safe',
    BUNDLER: 'bundler',
    DON: 'don',
    GOPLUS: 'goplus',
    BASESCAN: 'basescan',
    GPT4O: 'gpt4o',
    LLAMA3: 'llama3',
    MODULE: 'module',
} as const;

function buildInitialNodes(): Node[] {
    return [
        {
            id: NODE_IDS.SAFE,
            type: 'pipeline',
            position: { x: 0, y: 150 },
            data: { label: 'Safe Account', subtitle: 'ERC-4337', icon: '👤', status: 'idle' },
        },
        {
            id: NODE_IDS.BUNDLER,
            type: 'pipeline',
            position: { x: 210, y: 150 },
            data: { label: 'Pimlico Bundler', subtitle: 'UserOp Relay', icon: '📡', status: 'idle' },
        },
        {
            id: NODE_IDS.DON,
            type: 'pipeline',
            position: { x: 420, y: 150 },
            data: { label: 'Chainlink DON', subtitle: 'WASM Enclave', icon: '🔗', status: 'idle' },
        },
        {
            id: NODE_IDS.GOPLUS,
            type: 'pipeline',
            position: { x: 630, y: 60 },
            data: { label: 'GoPlus', subtitle: 'Static Analysis', icon: '🔍', status: 'idle' },
        },
        {
            id: NODE_IDS.BASESCAN,
            type: 'pipeline',
            position: { x: 630, y: 240 },
            data: { label: 'BaseScan', subtitle: 'Source Retrieval', icon: '📄', status: 'idle' },
        },
        {
            id: NODE_IDS.GPT4O,
            type: 'pipeline',
            position: { x: 840, y: 60 },
            data: { label: 'GPT-4o', subtitle: 'OpenAI', icon: '🧠', status: 'idle' },
        },
        {
            id: NODE_IDS.LLAMA3,
            type: 'pipeline',
            position: { x: 840, y: 240 },
            data: { label: 'Llama-3', subtitle: 'Groq', icon: '🦙', status: 'idle' },
        },
        {
            id: NODE_IDS.MODULE,
            type: 'pipeline',
            position: { x: 1050, y: 150 },
            data: { label: 'AegisModule', subtitle: 'ERC-7579 Firewall', icon: '🛡️', status: 'idle' },
        },
    ];
}

const EDGE_STYLE = { stroke: '#334155', strokeWidth: 2 };
const EDGE_MARKER = { type: MarkerType.ArrowClosed as const, color: '#334155' };

function buildInitialEdges(): Edge[] {
    return [
        { id: 'e-safe-bundler', source: NODE_IDS.SAFE, target: NODE_IDS.BUNDLER, animated: false, style: EDGE_STYLE, markerEnd: EDGE_MARKER },
        { id: 'e-bundler-don', source: NODE_IDS.BUNDLER, target: NODE_IDS.DON, animated: false, style: EDGE_STYLE, markerEnd: EDGE_MARKER },
        { id: 'e-don-goplus', source: NODE_IDS.DON, target: NODE_IDS.GOPLUS, animated: false, style: EDGE_STYLE, markerEnd: EDGE_MARKER },
        { id: 'e-don-basescan', source: NODE_IDS.DON, target: NODE_IDS.BASESCAN, animated: false, style: EDGE_STYLE, markerEnd: EDGE_MARKER },
        { id: 'e-goplus-gpt4o', source: NODE_IDS.GOPLUS, target: NODE_IDS.GPT4O, animated: false, style: EDGE_STYLE, markerEnd: EDGE_MARKER },
        { id: 'e-basescan-llama3', source: NODE_IDS.BASESCAN, target: NODE_IDS.LLAMA3, animated: false, style: EDGE_STYLE, markerEnd: EDGE_MARKER },
        { id: 'e-gpt4o-module', source: NODE_IDS.GPT4O, target: NODE_IDS.MODULE, animated: false, style: EDGE_STYLE, markerEnd: EDGE_MARKER },
        { id: 'e-llama3-module', source: NODE_IDS.LLAMA3, target: NODE_IDS.MODULE, animated: false, style: EDGE_STYLE, markerEnd: EDGE_MARKER },
    ];
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

interface ConsensusVisualizerProps {
    sseUrl?: string;
    onEvent?: (event: VisualizerEvent) => void;
}

export interface ConsensusVisualizerHandle {
    processEvent: (event: VisualizerEvent) => void;
    reset: () => void;
}

const ConsensusVisualizer = forwardRef<ConsensusVisualizerHandle, ConsensusVisualizerProps>(function ConsensusVisualizer({ sseUrl, onEvent }, ref) {
    const nodeTypes = useMemo(() => ({ pipeline: PipelineNode }), []);
    const [nodes, setNodes, onNodesChange] = useNodesState(buildInitialNodes());
    const [edges, setEdges, onEdgesChange] = useEdgesState(buildInitialEdges());
    const [verdict, setVerdict] = useState<{ type: 'approved' | 'blocked'; riskCode: number } | null>(null);

    // ── Update a node's status + optional detail ──────────────────────
    const updateNode = useCallback((nodeId: string, status: CustomNodeData['status'], detail?: string) => {
        setNodes(nds => nds.map(n =>
            n.id === nodeId
                ? { ...n, data: { ...n.data, status, detail: detail || n.data.detail } }
                : n
        ));
    }, [setNodes]);

    // ── Activate an edge (animated + colored) ────────────────────────
    const activateEdge = useCallback((edgeId: string, color: string = '#0ea5e9') => {
        setEdges(eds => eds.map(e =>
            e.id === edgeId
                ? { ...e, animated: true, style: { ...e.style, stroke: color, strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color } }
                : e
        ));
    }, [setEdges]);

    // ── Process a pipeline event ─────────────────────────────────────
    const processEvent = useCallback((event: VisualizerEvent) => {
        onEvent?.(event);

        switch (event.type) {
            case 'audit_requested':
                updateNode(NODE_IDS.SAFE, 'active', `requestAudit(${event.token})`);
                activateEdge('e-safe-bundler');
                break;

            case 'bundler_relay':
                updateNode(NODE_IDS.SAFE, 'complete');
                updateNode(NODE_IDS.BUNDLER, 'active', 'Relaying UserOp…');
                activateEdge('e-bundler-don');
                break;

            case 'don_started':
                updateNode(NODE_IDS.BUNDLER, 'complete');
                updateNode(NODE_IDS.DON, 'active', 'Spinning up Oracle Brain…');
                activateEdge('e-don-goplus');
                activateEdge('e-don-basescan');
                updateNode(NODE_IDS.GOPLUS, 'active', 'Scanning…');
                updateNode(NODE_IDS.BASESCAN, 'active', 'Fetching source…');
                break;

            case 'goplus_complete':
                updateNode(NODE_IDS.DON, 'complete');
                updateNode(NODE_IDS.GOPLUS, 'complete', event.result);
                activateEdge('e-goplus-gpt4o', '#22c55e');
                break;

            case 'basescan_complete':
                updateNode(NODE_IDS.BASESCAN, 'complete', event.result);
                activateEdge('e-basescan-llama3', '#22c55e');
                break;

            case 'gpt4o_started':
                updateNode(NODE_IDS.GPT4O, 'active', 'Analyzing…');
                break;

            case 'llama3_started':
                updateNode(NODE_IDS.LLAMA3, 'active', 'Analyzing…');
                break;

            case 'gpt4o_complete':
                updateNode(NODE_IDS.GPT4O, 'complete', event.result);
                activateEdge('e-gpt4o-module', '#22c55e');
                break;

            case 'llama3_complete':
                updateNode(NODE_IDS.LLAMA3, 'complete', event.result);
                activateEdge('e-llama3-module', '#22c55e');
                break;

            case 'consensus_reached': {
                const color = event.verdict === 'approved' ? '#22c55e' : '#ef4444';
                const status = event.verdict === 'approved' ? 'complete' : 'error';
                updateNode(NODE_IDS.DON, 'complete');
                updateNode(NODE_IDS.MODULE, status as CustomNodeData['status'], `riskCode: ${event.riskCode}`);
                setVerdict({ type: event.verdict, riskCode: event.riskCode });
                // Color all edges with final verdict
                setEdges(eds => eds.map(e => ({
                    ...e, style: { ...e.style, stroke: color }, markerEnd: { type: MarkerType.ArrowClosed, color }
                })));
                break;
            }

            case 'settlement':
                updateNode(NODE_IDS.MODULE, 'complete', event.result);
                break;
        }
    }, [updateNode, activateEdge, onEvent, setEdges]);

    // ── SSE Listener ─────────────────────────────────────────────────
    useEffect(() => {
        if (!sseUrl) return;
        const es = new EventSource(sseUrl);
        es.onmessage = (msg) => {
            try {
                const event: VisualizerEvent = JSON.parse(msg.data);
                processEvent(event);
            } catch { /* ignore malformed */ }
        };
        es.onerror = () => es.close();
        return () => es.close();
    }, [sseUrl, processEvent]);

    // Expose processEvent for imperative use via ref
    useImperativeHandle(ref, () => ({
        processEvent,
        reset: () => {
            setNodes(buildInitialNodes());
            setEdges(buildInitialEdges());
            setVerdict(null);
        },
    }), [processEvent, setNodes, setEdges]);

    return (
        <div data-testid="consensus-visualizer" style={{ width: '100%', height: 400, background: '#0a0e1a', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                proOptions={{ hideAttribution: true }}
                style={{ background: 'transparent' }}
            >
                <Background color="#1e293b" gap={20} />
                <Controls showInteractive={false} style={{ background: '#1e293b', border: '1px solid #334155' }} />
            </ReactFlow>

            {/* Verdict overlay */}
            <AnimatePresence>
                {verdict && (
                    <motion.div
                        data-testid="verdict-overlay"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            padding: '8px 16px',
                            borderRadius: 8,
                            background: verdict.type === 'approved'
                                ? 'rgba(34, 197, 94, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                            border: `1px solid ${verdict.type === 'approved' ? '#22c55e' : '#ef4444'}`,
                            color: verdict.type === 'approved' ? '#22c55e' : '#ef4444',
                            fontWeight: 700,
                            fontSize: 14,
                            fontFamily: 'monospace',
                        }}
                    >
                        {verdict.type === 'approved' ? '✅ APPROVED' : '⛔ BLOCKED'} — riskCode: {verdict.riskCode}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

export default ConsensusVisualizer;
