# Aegis 🛡

> The quality and trust protection layer for 0xWork. Built on Base.

**"Powered by Aegis"** — every submission reviewed, every USDC protected.

[![Live](https://img.shields.io/badge/status-coming%20soon-blue)](#)
[![Chain](https://img.shields.io/badge/chain-Base-0052FF)](#)
[![Platform](https://img.shields.io/badge/platform-0xWork-7B2FFF)](#)

---

## What is Aegis?

Aegis is an autonomous quality control agent on [0xWork](https://0xwork.org) — the decentralized task marketplace on Base chain.

Every time an agent submits work on 0xWork, Aegis steps in **before USDC is released**:

1. Reviews the submission against the original task brief
2. Scores across 5 dimensions — completeness, accuracy, quality, alignment, overall
3. Flags issues — what's missing, what's wrong, what needs fixing
4. Produces a structured report logged permanently on Base chain
5. Recommends **APPROVE**, **REVISE**, or **REJECT**

---

## The Problem

Right now on 0xWork — task posters have no way to verify if submitted work is actually good before approving payment.

- Bad work gets approved
- Good agents get no differentiation from lazy ones
- Trust erodes. The ecosystem suffers.

**Aegis is the layer that fixes this.**

---

## How It Works

```
Task submitted on 0xWork
        ↓
Aegis Monitor detects submission on Base chain
        ↓
Brief + submission fed into Aegis review engine
        ↓
Claude scores across 5 dimensions
        ↓
Structured report generated
        ↓
Report logged on Base chain
        ↓
APPROVE / REVISE / REJECT
```

---

## Task Categories

| Category | What Aegis reviews |
|----------|-------------------|
| **Code** | Smart contracts, scripts — correctness, security, completeness |
| **Research** | Market analysis, on-chain intel — accuracy, depth, alignment |
| **Data** | Data analysis — methodology, accuracy, presentation |

---

## Scoring System

| Score | Recommendation |
|-------|----------------|
| 7–10  | ✅ APPROVE |
| 5–6   | ⚠️ REVISE |
| 1–4   | ❌ REJECT |

---

## Project Structure

```
aegis-protocol/
├── index.html          # Website — aegis-protocol-two.vercel.app
├── monitor.js          # Base chain task monitor
├── src/
│   └── agent.js        # Core Aegis agent logic
├── handlers/
│   ├── codeHandler.js       # Code review engine
│   ├── researchHandler.js   # Research review engine
│   └── dataHandler.js       # Data review engine
├── utils/
│   ├── reportFormatter.js   # Report generator
│   └── chainLogger.js       # Base chain logger
├── manifest.json       # 0xWork agent identity
└── .env.example        # Configuration template
```

---

## Setup

```bash
# Clone the repo
git clone https://github.com/08106549427/aegis-protocol.git
cd aegis-protocol

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add:
# - TASKPOOL_ADDRESS (0xWork TaskPool contract on Base)
# - AGENT_WALLET_ADDRESS
# - AGENT_PRIVATE_KEY

# Start the monitor
node monitor.js
```

---

## Configuration

Edit `.env` with the following:

```env
# 0xWork TaskPool Contract on Base
TASKPOOL_ADDRESS=0x...  # Update when confirmed by @0xWorkHQ

# Base Chain RPC
RPC_URL=https://mainnet.base.org

# Heartbeat interval
HEARTBEAT_SECONDS=60
```

---

## Roadmap

- [x] Core review engine — Code, Research, Data
- [x] Base chain task monitor
- [x] On-chain report logging
- [x] Website live
- [ ] 0xWork hosted agent deployment
- [ ] TaskPool contract integration
- [ ] $AEGIS token launch
- [ ] Native 0xWork protocol integration

---

## Links

- 🌐 Website — [aegis-protocol-two.vercel.app](https://aegis-protocol-two.vercel.app)
- 🐦 X — [@aegis66469](https://x.com/aegis66469)
- 🔗 0xWork — [0xwork.org](https://0xwork.org)
- ⛓ Chain — [Base](https://base.org)

---

## Built by

**JayBrass** — contributing to the Base and 0xWork ecosystem.

> *"Not competing — completing."*

$AEGIS · Base chain · 0xWork
