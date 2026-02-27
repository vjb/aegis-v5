# Aegis Protocol V4 — System Architecture

> 12 Mermaid diagrams covering all layers of the Aegis V4 system: from the EVM smart contract through the Chainlink CRE DON, AI oracle pipeline, ERC-4337 account abstraction, agent lifecycle, and frontend.

---

## 1. System Context (C4 Level 1)

The highest-level view: who uses Aegis, what it connects to, and what it protects.

```mermaid
C4Context
    title Aegis Protocol V4 — System Context

    Person(owner, "Treasury Owner", "Connects wallet, installs module, sets rules")
    Person(agent, "AI Trading Agent", "Proposes trades via ERC-4337 UserOps")

    System(aegis, "Aegis Protocol", "ERC-7579 Executor Module + Chainlink CRE Oracle")

    System_Ext(smartAccount, "ERC-4337 Smart Account", "Safe — holds all capital")
    System_Ext(cre, "Chainlink CRE DON", "Decentralized oracle network running WASM audit")
    System_Ext(uniswap, "Uniswap V3", "DEX — executes the actual swap")
    System_Ext(tenderly, "Tenderly Virtual Testnet", "Forked Base mainnet for demo")

    Rel(owner, aegis, "Installs, sets budget, kill switch")
    Rel(agent, aegis, "Submits requestAudit() via UserOp")
    Rel(aegis, cre, "Emits AuditRequested event → triggers WASM oracle")
    Rel(cre, aegis, "onReport(tradeId, riskScore) via KeystoneForwarder")
    Rel(aegis, smartAccount, "executeFromExecutor() on clearance")
    Rel(smartAccount, uniswap, "exactInputSingle(WETH → token)")
    Rel(aegis, tenderly, "All on-chain calls during demo")
```

---

## 2. Module Architecture (C4 Level 2)

The internal structure of the AegisModule ERC-7579 executor.

```mermaid
graph TB
    subgraph SmartAccount["ERC-4337 Smart Account (Safe)"]
        EA[EntryPoint v0.7]
        SA[Safe Account]
        EX[executeFromExecutor]
    end

    subgraph AegisModule["AegisModule.sol — ERC-7579 Executor"]
        direction TB
        RA["requestAudit(address token)"]
        TS["tradeRequests[tradeId]"]
        OR["onReport / onReportDirect"]
        PR["_processReport(tradeId, riskScore)"]
        IA["isApproved[token]"]
        SW["triggerSwap(token, amount, minOut)"]
        KS["killSwitch()"]
        SA2["subscribeAgent(addr, budget)"]
        AG["agentAllowances[addr]"]
    end

    subgraph CRE["Chainlink CRE DON"]
        KF["KeystoneForwarder"]
        WK["WASM Oracle Workflow"]
    end

    subgraph Uniswap["Uniswap V3"]
        SR["SwapRouter02"]
    end

    EA --> SA --> EX --> AegisModule
    RA --> TS
    TS --> WK
    WK --> KF --> OR --> PR --> IA
    IA -->|"riskScore == 0"| SW
    SW --> SR
    KS -->|"zeroes all"| AG

    style AegisModule fill:#0f172a,stroke:#06b6d4,color:#e2e8f0
    style SmartAccount fill:#0f1f0f,stroke:#22c55e,color:#e2e8f0
    style CRE fill:#1e1b4b,stroke:#818cf8,color:#e2e8f0
    style Uniswap fill:#ff6b6b22,stroke:#ff6b6b,color:#e2e8f0
```

---

## 3. Chainlink CRE Oracle Pipeline (Phase-by-Phase)

The 3-phase AI audit pipeline running inside the WASM sandbox.

```mermaid
flowchart TD
    START(["AuditRequested event on-chain\n tradeId · agent · token · config"])

    subgraph Phase1["Phase 1 — GoPlus Static Analysis"]
        GP["GoPlus Security API\n(live, real-time)"]
        GPS["honeypot · sell restriction\nunverified code · proxy"]
    end

    subgraph Phase2["Phase 2 — Source Code Fetch"]
        BS["BaseScan via ConfidentialHTTPClient\nAPI key NEVER leaves DON"]
        SRC["Full Solidity source code\n(e.g. 52,963 chars for BrettToken.sol)"]
    end

    subgraph Phase3["Phase 3 — Dual AI Consensus"]
        GPT["GPT-4o reads full source"]
        LLM["Llama-3 reads full source"]
        GPTR["tax · priv · extCall · bomb\n(all independent)"]
        LLMR["tax · priv · extCall · bomb\n(all independent)"]
        UNION["Union of Fears\nif EITHER model flags → bit is set"]
    end

    subgraph Output["Risk Code Assembly"]
        BITS["8-bit risk code\nBit 0=unverified Bit 1=sellRestriction\nBit 2=honeypot Bit 4=tax Bit 5=priv\nBit 6=extCall Bit 7=bomb"]
        KF["onReport via KeystoneForwarder\nor onReportDirect for demo"]
    end

    START --> Phase1 --> GP --> GPS
    GPS --> Phase2 --> BS --> SRC
    SRC --> Phase3
    Phase3 --> GPT --> GPTR
    Phase3 --> LLM --> LLMR
    GPTR & LLMR --> UNION --> BITS --> KF

    style Phase1 fill:#0f2a0f,stroke:#22c55e,color:#e2e8f0
    style Phase2 fill:#0f1f2a,stroke:#06b6d4,color:#e2e8f0
    style Phase3 fill:#1e1b4b,stroke:#818cf8,color:#e2e8f0
    style Output fill:#2a0f0f,stroke:#ef4444,color:#e2e8f0
```

---

## 4. Trade Lifecycle State Machine

Every trade request goes through a strict CEI (Checks-Effects-Interactions) state machine.

```mermaid
stateDiagram-v2
    [*] --> Pending : agent calls requestAudit(token)
    note right of Pending
        tradeRequests[tradeId] = { token, agent, exists: true }
        AuditRequested event emitted
        CRE DON picks up the event
    end note

    Pending --> CRE_Running : CRE WASM sandbox activated

    CRE_Running --> Cleared : riskScore == 0\nonReport(tradeId, 0)
    CRE_Running --> Blocked : riskScore > 0\nonReport(tradeId, N)

    Cleared --> Approved : isApproved[token] = true\nClearanceUpdated(token, true)
    Blocked --> Denied : ClearanceDenied(token, riskScore)

    Approved --> SwapExecuted : agent calls triggerSwap()\nCEI: clearance consumed BEFORE external call
    note right of SwapExecuted
        isApproved[token] = false (anti-replay)
        THEN Uniswap V3 exactInputSingle()
        SwapExecuted event emitted
    end note

    SwapExecuted --> [*]
    Denied --> [*]

    Approved --> Blocked2 : second triggerSwap() attempt
    Blocked2 --> [*] : revert TokenNotCleared\n(anti-replay proven)
```

---

## 5. ERC-4337 Account Abstraction Flow

How the AI agent's trade intent reaches the smart account without holding capital.

```mermaid
sequenceDiagram
    participant Agent as AI Agent<br/>(gas ETH only)
    participant Bundler as Pimlico Bundler<br/>(ERC-4337)
    participant EP as EntryPoint v0.7
    participant SA as Safe Smart Account<br/>(holds all capital)
    participant AM as AegisModule<br/>(ERC-7579 Executor)
    participant CRE as Chainlink CRE DON

    Agent->>Bundler: signedUserOp { callData: requestAudit(BRETT) }
    Bundler->>EP: handleOps([userOp])
    EP->>SA: validateUserOp()
    SA-->>EP: validationData = 0 (valid)
    EP->>SA: execute(callData)
    SA->>AM: requestAudit(BRETT) via executeFromExecutor
    AM->>AM: tradeRequests[id] = { BRETT, agent }
    AM-->>CRE: emit AuditRequested(id, agent, BRETT, config)

    Note over CRE: WASM oracle runs GoPlus + AI audit

    CRE->>AM: onReport(id, riskScore=0) via KeystoneForwarder
    AM->>AM: isApproved[BRETT] = true

    Agent->>Bundler: signedUserOp { callData: triggerSwap(BRETT, 0.01 ETH) }
    Bundler->>EP: handleOps([userOp])
    EP->>SA: execute(callData)
    SA->>AM: triggerSwap(BRETT, 0.01 ETH)
    AM->>AM: check isApproved[BRETT] ✅
    AM->>AM: check agentAllowances[agent] ✅
    AM->>AM: isApproved[BRETT] = false (CEI anti-replay)
    AM->>SA: executeFromExecutor(UniswapCall)
    SA->>Uniswap: exactInputSingle(WETH→BRETT)
    Uniswap-->>SA: BRETT tokens
```

---

## 6. Multi-Agent Firewall (Demo 2 — 3 Agents)

Three agents, three simultaneous trade intents, one oracle.

```mermaid
graph LR
    subgraph Agents
        NOVA["🤖 NOVA\n0.05 ETH budget"]
        CIPHER["🤖 CIPHER\n0.01 ETH budget"]
        REX["🤖 REX\n0.01 ETH budget"]
    end

    subgraph AegisModule
        Q0["tradeId=N\nBRETT"]
        Q1["tradeId=N+1\nTaxToken"]
        Q2["tradeId=N+2\nHoneypotCoin"]
    end

    subgraph CRE_Oracle["Chainlink CRE Oracle (runs for each)"]
        O0["BRETT audit\nGoPlus✅ BaseScan✅ AI✅\nRisk Code: 0"]
        O1["TaxToken audit\nMOCK source → AI reads sell restriction\nRisk Code: 18"]
        O2["HoneypotCoin audit\nMOCK source → AI reads honeypot\nRisk Code: 4"]
    end

    subgraph Verdicts
        V0["✅ ClearanceUpdated\nBRETT approved\nNOVA executes swap"]
        V1["🔴 ClearanceDenied\nTaxToken blocked\nCIPHER stands down"]
        V2["🔴 ClearanceDenied\nHoneypotCoin blocked\nREX denied + bypass reverts"]
    end

    NOVA -->|requestAudit| Q0 --> O0 --> V0
    CIPHER -->|requestAudit| Q1 --> O1 --> V1
    REX -->|requestAudit| Q2 --> O2 --> V2

    style V0 fill:#0f2a0f,stroke:#22c55e,color:#e2e8f0
    style V1 fill:#2a0f0f,stroke:#ef4444,color:#e2e8f0
    style V2 fill:#2a0f0f,stroke:#ef4444,color:#e2e8f0
```

---

## 7. Security Zone Architecture

Trust boundaries and the principle of zero custody.

```mermaid
graph TB
    subgraph PublicZone["☁️ Public Zone (Internet)"]
        GOV["GoPlus API\n(public safety data)"]
        BSCAN["BaseScan API\n(contract source)"]
        GPTs["OpenAI GPT-4o\n(AI analysis)"]
        GROQ["Groq Llama-3\n(AI analysis)"]
    end

    subgraph DON["🔐 Chainlink DON (Trusted Execution)"]
        CONF["ConfidentialHTTPClient\nAPI keys sealed inside DON"]
        WASM["WASM Sandbox\n(deterministic execution)"]
        KEYS["DON Secrets\n(BASESCAN_KEY, OPENAI_KEY, GROQ_KEY)"]
    end

    subgraph Chain["⛓️ On-Chain (Public, Immutable)"]
        AM["AegisModule.sol"]
        KF["KeystoneForwarder\n(only caller of onReport)"]
        SA["Smart Account\n(holds ALL capital)"]
    end

    subgraph AgentZone["🤖 Agent Zone (Untrusted)"]
        BOT["AI Agent Wallet\ngas ETH only — zero capital"]
    end

    CONF --> BSCAN & GPTs & GROQ
    KEYS -->|"never transmitted"| CONF
    GOV --> WASM
    CONF --> WASM
    WASM --> KF --> AM
    AM --> SA
    BOT -->|"requestAudit() only"| AM

    style DON fill:#1e1b4b,stroke:#818cf8,color:#e2e8f0
    style Chain fill:#0f2a1f,stroke:#22c55e,color:#e2e8f0
    style AgentZone fill:#2a1a0f,stroke:#f59e0b,color:#e2e8f0
    style PublicZone fill:#1a1a2a,stroke:#64748b,color:#e2e8f0
```

---

## 8. 8-Bit Risk Matrix Encoding

How GoPlus and AI outputs are combined into a single risk code.

```mermaid
graph LR
    subgraph GoPlus["GoPlus Output"]
        G0["Bit 0: is_open_source=0\nunverified code"]
        G1["Bit 1: sell_tax > threshold\nor is_honeypot=1"]
        G2["Bit 2: is_honeypot=1"]
        G3["Bit 3: is_proxy=1"]
    end

    subgraph AI["AI Consensus (GPT-4o ∪ Llama-3)"]
        A4["Bit 4: obfuscated tax\nin source code"]
        A5["Bit 5: privilege escalation\n(NOT standard Ownable)"]
        A6["Bit 6: external call risk\n(reentrancy potential)"]
        A7["Bit 7: logic bomb\n(time-gated malicious logic)"]
    end

    subgraph Examples["Example Risk Codes"]
        E0["0x00 = 0\nAll clear → APPROVED"]
        E1["0x04 = 4\nBit 2 set → Honeypot → BLOCKED"]
        E2["0x12 = 18\nBit 1+4 set → Sell restriction + Tax → BLOCKED"]
        E3["0x05 = 5\nBit 0+2 set → Unverified + Honeypot → BLOCKED"]
    end

    G0 & G1 & G2 & G3 --> OR["Bitwise OR\n(any 1 = blocked)"]
    A4 & A5 & A6 & A7 --> OR
    OR --> Examples

    style OR fill:#0f172a,stroke:#06b6d4,color:#e2e8f0
    style E0 fill:#0f2a0f,stroke:#22c55e,color:#e2e8f0
    style E1 fill:#2a0f0f,stroke:#ef4444,color:#e2e8f0
    style E2 fill:#2a0f0f,stroke:#ef4444,color:#e2e8f0
    style E3 fill:#2a0f0f,stroke:#ef4444,color:#e2e8f0
```

---

## 9. Agent Subscription Lifecycle

How agents are onboarded, budgeted, and revoked.

```mermaid
sequenceDiagram
    participant Owner as Treasury Owner
    participant AM as AegisModule
    participant Agent as AI Agent Wallet
    participant V3 as Uniswap V3

    Owner->>AM: depositETH() — 0.1 ETH
    Note right of AM: treasury balance = 0.1 ETH

    Owner->>AM: subscribeAgent(agentAddr, 0.05 ETH budget)
    AM->>AM: agentAllowances[agentAddr] = 0.05 ETH
    AM-->>Owner: emit AgentSubscribed(agent, 50000000000000000)

    Agent->>AM: requestAudit(BRETT)
    Note right of AM: CRE oracle runs...

    AM->>AM: onReport(id, riskScore=0) → isApproved[BRETT]=true

    Agent->>AM: triggerSwap(BRETT, 0.01 ETH)
    AM->>AM: agentAllowances[agentAddr] -= 0.01 ETH
    AM->>V3: exactInputSingle(WETH→BRETT, 0.01 ETH)
    Note right of AM: Budget now: 0.04 ETH remaining

    Owner->>AM: killSwitch()
    AM->>AM: agentAllowances[agentAddr] = 0 (all agents zeroed)
    AM-->>Owner: emit AgentRevoked(agent)
```

---

## 10. Tenderly VNet Development Loop

The infrastructure loop for demos and development.

```mermaid
flowchart LR
    subgraph Dev["Developer Machine"]
        PS["new_tenderly_testnet.ps1"]
        ENV[".env file"]
        DOCKER["Docker: aegis-oracle-node"]
        DEMOS["demo_1/2/3.ps1"]
    end

    subgraph Tenderly["Tenderly Cloud"]
        VNET["Virtual Testnet\n(Base fork, cheatcodes enabled)"]
        VERIF["Contract Explorer\n(verified source, decoded calls)"]
    end

    subgraph Chain["On-Chain State"]
        AM["AegisModule deployed\n+ verified on explorer"]
    end

    PS -->|"1. POST /vnets"| VNET
    VNET -->|"2. RPC URL + UUID"| ENV
    PS -->|"3. forge deploy"| AM
    PS -->|"4. forge verify"| VERIF
    PS -->|"5. update config.json"| DOCKER
    ENV -->|"TENDERLY_RPC_URL"| DOCKER
    DOCKER -->|"cre workflow simulate\n--evm-tx-hash 0x..."| VNET
    DEMOS -->|"cast send requestAudit()"| VNET
    VNET -->|"AuditRequested log"| DOCKER
    DOCKER -->|"onReportDirect(tradeId, riskCode)"| VNET
    VNET -->|"isApproved[token]=true"| Chain

    style Dev fill:#0f172a,stroke:#334155,color:#e2e8f0
    style Tenderly fill:#1e1b4b,stroke:#818cf8,color:#e2e8f0
    style Chain fill:#0f2a1f,stroke:#22c55e,color:#e2e8f0
```

---

## 11. Frontend Architecture (V4 Command Center)

Option B: split-view dashboard with always-visible oracle feed.

```mermaid
graph TB
    subgraph NextJS["Next.js App (aegis-frontend/)"]
        subgraph Layout["layout.tsx — Providers"]
            WP["WagmiProvider"]
            QP["QueryClientProvider"]
        end

        subgraph Page["page.tsx — Split Pane"]
            HDR["Header\n(logo · vnet status · wallet · kill switch)"]
            subgraph Left["Left Panel (60%)"]
                TABS["Tab Bar\n[Agents] [Firewall] [Audit Log] [Marketplace]"]
                AT["AgentsTab\n(subscribe, revoke, budget bars)"]
                FT["FirewallTab\n(8-bit risk toggles)"]
                ALT["AuditLogTab\n(real on-chain events)"]
                MT["MarketplaceTab\n(preset agent templates)"]
            end
            subgraph Right["Right Panel (40%) — Always Visible"]
                OF["OracleFeed\n(SSE stream from /api/audit)"]
                AI["Audit Input\n(token address → trigger audit)"]
                VERDICT["Verdict Card\n(animated risk matrix)"]
            end
        end
    end

    subgraph APIs["API Routes"]
        AUDIT["/api/audit\n(SSE: CRE pipeline stream)"]
        CHAT["/api/chat\n(LLM assistant)"]
        RADAR["/api/radar\n(on-chain event poller)"]
    end

    subgraph Contract["AegisModule.sol"]
        RC["readContract\nagentAllowances, isApproved,\ngetTreasuryBalance"]
        WC["writeContract\nsubscribeAgent, requestAudit,\nonReportDirect, killSwitch"]
    end

    WP & QP --> Page
    AT & FT --> WC
    ALT --> RADAR
    OF --> AUDIT
    AUDIT -->|"spawn docker exec"| CRE["CRE Oracle (Docker)"]
    AUDIT --> WC
    RC --> AT & ALT

    style Left fill:#0f172a,stroke:#06b6d4,color:#e2e8f0
    style Right fill:#1e1b4b,stroke:#818cf8,color:#e2e8f0
    style APIs fill:#2a1a0f,stroke:#f59e0b,color:#e2e8f0
    style Contract fill:#0f2a1f,stroke:#22c55e,color:#e2e8f0
```

---

## 12. End-to-End Sequence — Full Happy Path

The complete sequence from agent intent to on-chain swap with zero custody.

```mermaid
sequenceDiagram
    participant A as AI Agent
    participant UI as Aegis UI
    participant AM as AegisModule<br/>(ERC-7579)
    participant CRE as Chainlink CRE<br/>(WASM sandbox)
    participant GP as GoPlus API
    participant BS as BaseScan<br/>(via ConfidentialHTTP)
    participant LLM as GPT-4o + Llama-3
    participant KF as KeystoneForwarder
    participant SA as Smart Account
    participant UNI as Uniswap V3

    A->>AM: requestAudit(BRETT)
    AM->>AM: store tradeRequests[id] = {BRETT, agent}
    AM-->>CRE: emit AuditRequested(id, BRETT)
    UI->>UI: Oracle Feed activates (SSE stream)

    CRE->>GP: GET /token_security?address=BRETT
    GP-->>CRE: {honeypot:0, sell_tax:0, is_open_source:1}
    UI-->>UI: Phase 1 ✅ GoPlus

    CRE->>BS: GET /api?module=contract&action=getsourcecode<br/>(ConfidentialHTTPClient — key sealed in DON)
    BS-->>CRE: 52,963 chars of BrettToken.sol
    UI-->>UI: Phase 2 ✅ BaseScan

    CRE->>LLM: "Read this Solidity. Flag: tax, priv, extCall, bomb"
    LLM-->>CRE: {tax:false, priv:false, extCall:false, bomb:false} × 2 models
    UI-->>UI: Phase 3 ✅ AI Consensus

    CRE->>CRE: Risk Code = 0 (all bits clear)
    CRE->>KF: writeReport(tradeId, 0)
    KF->>AM: onReport(id, 0)
    AM->>AM: isApproved[BRETT] = true
    AM-->>UI: emit ClearanceUpdated(BRETT, true)
    UI-->>UI: ✅ Verdict: APPROVED — isApproved=TRUE

    A->>AM: triggerSwap(BRETT, 0.01 ETH)
    AM->>AM: check isApproved[BRETT] ✅
    AM->>AM: check agentAllowances[agent] ✅
    AM->>AM: isApproved[BRETT] = false (CEI anti-replay)
    AM->>SA: executeFromExecutor(UniswapCalldata)
    SA->>UNI: exactInputSingle({tokenIn:WETH, tokenOut:BRETT, amountIn:0.01 ETH})
    UNI-->>SA: BRETT tokens received
    AM-->>UI: emit SwapExecuted(BRETT, amountIn, amountOut)
    UI-->>UI: 🎉 Swap confirmed on Tenderly
```

---

## Summary Table

| Diagram | What It Shows |
|---|---|
| 1. System Context | Who uses Aegis, what it connects to |
| 2. Module Architecture | Internal AegisModule.sol structure |
| 3. CRE Oracle Pipeline | 3-phase AI audit (GoPlus → BaseScan → GPT-4o + Llama-3) |
| 4. Trade Lifecycle State Machine | requestAudit → CRE → approved/blocked → swap/revert |
| 5. ERC-4337 Account Abstraction | How agent UserOps reach the Smart Account |
| 6. Multi-Agent Firewall | 3 agents × 3 tokens × 1 oracle (Demo 2) |
| 7. Security Zone Architecture | Trust boundaries, ConfidentialHTTP, zero custody |
| 8. 8-Bit Risk Matrix | How GoPlus + AI bits combine into risk code |
| 9. Agent Subscription Lifecycle | subscribeAgent → budget → swap → killSwitch |
| 10. Tenderly Dev Loop | VNet provisioning, contract verification, CRE node |
| 11. Frontend Architecture | Next.js Command Center, split pane, API routes |
| 12. End-to-End Sequence | Complete happy path from agent intent to Uniswap swap |
