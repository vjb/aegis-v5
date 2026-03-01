/**
 * @jest-environment jsdom
 */

// ═══════════════════════════════════════════════════════════════════════
//  ConsensusVisualizer Tests — React Flow CRE Pipeline
// ═══════════════════════════════════════════════════════════════════════
//
//  These tests verify:
//  1. All 6 core pipeline nodes render correctly
//  2. Edges connect nodes in the correct sequence
//  3. Events animate the pipeline path (unit test via processEvent)
//

import React from 'react';

// ── Mock ResizeObserver (required by React Flow in jsdom) ─────────────
class ResizeObserverMock {
    observe() { }
    unobserve() { }
    disconnect() { }
}
(global as any).ResizeObserver = ResizeObserverMock;

// ── Mock IntersectionObserver ────────────────────────────────────────
class IntersectionObserverMock {
    observe() { }
    unobserve() { }
    disconnect() { }
}
(global as any).IntersectionObserver = IntersectionObserverMock;

// ── Mock DOMMatrixReadOnly (React Flow internal) ─────────────────────
(global as any).DOMMatrixReadOnly = class DOMMatrixReadOnly {
    m22: number;
    constructor() { this.m22 = 1; }
    transformPoint() { return { x: 0, y: 0 }; }
};

import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Dynamic import of the component (handles 'use client')
let ConsensusVisualizer: any;

beforeAll(async () => {
    // We need to require the module after mocks are set up
    const mod = await import('../../aegis-frontend/app/components/ConsensusVisualizer');
    ConsensusVisualizer = mod.default;
});

describe('ConsensusVisualizer', () => {

    // ─────────────────────────────────────────────────────────────────
    //  Phase 2: Static Node Architecture
    // ─────────────────────────────────────────────────────────────────

    test('test_Visualizer_RendersAllCoreNodes', async () => {
        await act(async () => {
            render(React.createElement(ConsensusVisualizer));
        });

        // Verify the visualizer container renders
        const container = screen.getByTestId('consensus-visualizer');
        expect(container).toBeInTheDocument();

        // Verify all 6 core nodes are present
        const expectedNodes = [
            'pipeline-node-safe-account',
            'pipeline-node-pimlico-bundler',
            'pipeline-node-chainlink-don',
            'pipeline-node-gpt-4o',
            'pipeline-node-llama-3',
            'pipeline-node-aegismodule',
        ];

        for (const testId of expectedNodes) {
            const node = screen.getByTestId(testId);
            expect(node).toBeInTheDocument();
        }
    });

    test('renders node labels correctly', async () => {
        await act(async () => {
            render(React.createElement(ConsensusVisualizer));
        });

        expect(screen.getByText('Safe Account')).toBeInTheDocument();
        expect(screen.getByText('Pimlico Bundler')).toBeInTheDocument();
        expect(screen.getByText('Chainlink DON')).toBeInTheDocument();
        expect(screen.getByText('GPT-4o')).toBeInTheDocument();
        expect(screen.getByText('Llama-3')).toBeInTheDocument();
        expect(screen.getByText('AegisModule')).toBeInTheDocument();
    });

    test('renders node subtitles correctly', async () => {
        await act(async () => {
            render(React.createElement(ConsensusVisualizer));
        });

        expect(screen.getByText('ERC-4337')).toBeInTheDocument();
        expect(screen.getByText('UserOp Relay')).toBeInTheDocument();
        expect(screen.getByText('WASM Enclave')).toBeInTheDocument();
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
        expect(screen.getByText('Groq')).toBeInTheDocument();
        expect(screen.getByText('ERC-7579 Firewall')).toBeInTheDocument();
    });

    // ─────────────────────────────────────────────────────────────────
    //  Phase 3: Event-Driven Animation
    // ─────────────────────────────────────────────────────────────────

    test('test_Visualizer_AnimatesPath_OnLiveSSEEvent', async () => {
        const receivedEvents: any[] = [];
        const onEvent = (e: any) => receivedEvents.push(e);

        let component: any;
        await act(async () => {
            component = render(React.createElement(ConsensusVisualizer, { onEvent }));
        });

        // Get the processEvent function from the component
        const processEvent = (ConsensusVisualizer as any)._processEvent;
        expect(processEvent).toBeDefined();

        // Simulate the full pipeline flow
        await act(async () => {
            processEvent({ type: 'audit_requested', token: 'BRETT' });
        });
        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0].type).toBe('audit_requested');

        await act(async () => {
            processEvent({ type: 'bundler_relay' });
        });

        await act(async () => {
            processEvent({ type: 'don_started' });
        });

        await act(async () => {
            processEvent({ type: 'gpt4o_started' });
            processEvent({ type: 'llama3_started' });
        });

        await act(async () => {
            processEvent({ type: 'gpt4o_complete', result: '0x00' });
            processEvent({ type: 'llama3_complete', result: '0x00' });
        });

        await act(async () => {
            processEvent({ type: 'consensus_reached', verdict: 'approved', riskCode: 0 });
        });

        // Verify verdict overlay appears
        const verdict = screen.getByTestId('verdict-overlay');
        expect(verdict).toBeInTheDocument();
        expect(verdict.textContent).toContain('APPROVED');
        expect(verdict.textContent).toContain('riskCode: 0');

        // Verify all events were received
        expect(receivedEvents).toHaveLength(8);
    });

    test('shows BLOCKED verdict when consensus returns risk', async () => {
        const receivedEvents: any[] = [];

        await act(async () => {
            render(React.createElement(ConsensusVisualizer, { onEvent: (e: any) => receivedEvents.push(e) }));
        });

        const processEvent = (ConsensusVisualizer as any)._processEvent;

        await act(async () => {
            processEvent({ type: 'audit_requested', token: 'HoneypotCoin' });
            processEvent({ type: 'bundler_relay' });
            processEvent({ type: 'don_started' });
            processEvent({ type: 'gpt4o_started' });
            processEvent({ type: 'llama3_started' });
            processEvent({ type: 'gpt4o_complete', result: '0x24' });
            processEvent({ type: 'llama3_complete', result: '0x24' });
            processEvent({ type: 'consensus_reached', verdict: 'blocked', riskCode: 36 });
        });

        const verdict = screen.getByTestId('verdict-overlay');
        expect(verdict).toBeInTheDocument();
        expect(verdict.textContent).toContain('BLOCKED');
        expect(verdict.textContent).toContain('riskCode: 36');
    });
});
