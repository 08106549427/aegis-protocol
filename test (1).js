// ─────────────────────────────────────────────
// AEGIS — Test Suite
// Tests Aegis reviews with real 0xWork
// task structures and sample submissions
// ─────────────────────────────────────────────

import { runAegis } from "./src/agent.js";

// ─────────────────────────────────────────────
// REAL 0xWORK TASK STRUCTURES
// Based on actual 0xWork task categories
// and formats from the platform
// ─────────────────────────────────────────────

const TEST_TASKS = [

  // ── TEST 1: Code — Good submission ──
  {
    taskId: "TEST-001",
    category: "Code",
    brief: `Write a Solidity ERC-20 token contract on Base with the following requirements:
- Token name: TestToken, symbol: TST
- Total supply: 1,000,000 tokens
- Owner can mint and burn tokens
- Transfer events must be emitted
- Must include SafeMath or use Solidity 0.8+
- Deploy-ready on Base mainnet`,
    submission: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestToken is ERC20, Ownable {
    constructor() ERC20("TestToken", "TST") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public onlyOwner {
        _burn(from, amount);
    }
}`,
    agentAddress: "0xAgent001",
    posterAddress: "0xPoster001",
    expectedResult: "APPROVE",
  },

  // ── TEST 2: Code — Bad submission ──
  {
    taskId: "TEST-002",
    category: "Code",
    brief: `Write a Solidity multisig wallet contract on Base that:
- Requires 2 of 3 owner signatures to execute transactions
- Has deposit and withdrawal functions
- Emits events for all state changes
- Must be production-ready`,
    submission: `pragma solidity ^0.6.0;

contract Wallet {
    address owner;
    
    function withdraw(uint amount) public {
        require(msg.sender == owner);
        msg.sender.transfer(amount);
    }
    
    function deposit() public payable {}
}`,
    agentAddress: "0xAgent002",
    posterAddress: "0xPoster002",
    expectedResult: "REJECT",
  },

  // ── TEST 3: Research — Good submission ──
  {
    taskId: "TEST-003",
    category: "Research",
    brief: `Research and analyze the top 5 DeFi protocols currently live on Base chain by TVL. For each protocol provide:
- Protocol name and description
- Current TVL in USD
- Main products offered
- Key risks
- Links to official sources`,
    submission: `# Top 5 DeFi Protocols on Base Chain by TVL

## 1. Aerodrome Finance
Aerodrome is Base's leading DEX and liquidity hub, forked from Velodrome V2. It uses a ve(3,3) tokenomics model where AERO token holders direct liquidity emissions. Current TVL: ~$800M. Products: AMM swaps, liquidity pools, bribes marketplace. Key risks: Smart contract risk, token emission dilution.

## 2. Moonwell
Moonwell is a lending and borrowing protocol on Base. Users supply assets to earn yield or borrow against collateral. Current TVL: ~$400M. Products: Lending markets for ETH, USDC, cbBTC. Key risks: Liquidation risk, oracle manipulation.

## 3. Extra Finance
Leveraged yield farming protocol on Base. Allows users to take leveraged positions on Aerodrome and other Base DEXes. Current TVL: ~$180M. Products: Leveraged farming vaults. Key risks: Liquidation risk, smart contract vulnerabilities.

## 4. Morpho
Peer-to-peer lending optimizer built on top of Compound and Aave. On Base, Morpho Blue allows permissionless market creation. Current TVL: ~$150M. Products: Optimized lending, Morpho Blue markets. Key risks: Dependency on underlying protocols.

## 5. Uniswap V3
Concentrated liquidity DEX. The leading decentralized exchange globally, deployed on Base. Current TVL: ~$120M on Base. Products: Spot swaps, concentrated LP positions. Key risks: Impermanent loss, MEV.

Sources: DeFiLlama.com, official protocol documentation, Basescan.`,
    agentAddress: "0xAgent003",
    posterAddress: "0xPoster003",
    expectedResult: "APPROVE",
  },

  // ── TEST 4: Research — Needs revision ──
  {
    taskId: "TEST-004",
    category: "Research",
    brief: `Analyze the current state of AI agent economies on Base chain. Include:
- Key platforms and their market size
- Revenue models
- Key players and agents
- Growth metrics
- Future outlook`,
    submission: `AI agents are becoming popular on Base. There are several platforms where agents can earn money. The market is growing fast. Some agents make hundreds of dollars per week. The future looks bright for AI agents on blockchain.

Key platforms include 0xWork and others. Revenue comes from task completion. Growth has been strong recently.`,
    agentAddress: "0xAgent004",
    posterAddress: "0xPoster004",
    expectedResult: "REVISE",
  },

  // ── TEST 5: Data — Good submission ──
  {
    taskId: "TEST-005",
    category: "Data",
    brief: `Analyze on-chain transaction data for Base chain over the last 30 days. Provide:
- Daily transaction count trend
- Average gas fees
- Top contract interactions
- Peak usage times
- Summary statistics with methodology`,
    submission: `# Base Chain 30-Day Transaction Analysis

## Methodology
Data sourced from Basescan API and Dune Analytics (query #3847291). Time period: April 23 - May 23, 2026. All figures in USD unless stated.

## Daily Transaction Count
- Average: 2.1M transactions/day
- Peak: 3.4M (May 8, driven by token launch)
- Low: 1.6M (May 2, weekend dip)
- Trend: +12% month-over-month growth

## Average Gas Fees
- Average: $0.0008 per transaction
- Peak: $0.003 during congestion events
- Base benefits from L2 compression — ~100x cheaper than Ethereum mainnet

## Top Contract Interactions
1. Aerodrome Router — 18% of transactions
2. Uniswap V3 — 14%
3. USDC Transfer — 11%
4. Coinbase Smart Wallet — 9%
5. 0xWork TaskPool — 2%

## Peak Usage Times (UTC)
- Highest: 14:00-18:00 UTC (US market hours)
- Weekend: 30% lower than weekdays

## Summary
Base processed ~63M transactions in the 30-day period with strong growth momentum. Gas costs remain negligible, supporting high-frequency agent activity.`,
    agentAddress: "0xAgent005",
    posterAddress: "0xPoster005",
    expectedResult: "APPROVE",
  },
];

// ─────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────

async function runTests() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  AEGIS TEST SUITE — 0xWork Task Reviews  ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const task of TEST_TASKS) {
    console.log(`\n─── Running Test ${task.taskId} ───`);
    console.log(`Category: ${task.category}`);
    console.log(`Expected: ${task.expectedResult}`);

    try {
      const report = await runAegis(task);

      const success = report.recommendation === task.expectedResult;
      if (success) passed++;
      else failed++;

      results.push({
        taskId: task.taskId,
        category: task.category,
        expected: task.expectedResult,
        got: report.recommendation,
        score: report.scores?.overall,
        passed: success,
        summary: report.summary,
      });

      console.log(`Result:   ${report.recommendation} (Score: ${report.scores?.overall}/10)`);
      console.log(`Status:   ${success ? "✅ PASSED" : "❌ FAILED"}`);
      console.log(`Summary:  ${report.summary}`);

    } catch (error) {
      console.error(`Error: ${error.message}`);
      failed++;
      results.push({
        taskId: task.taskId,
        category: task.category,
        expected: task.expectedResult,
        got: "ERROR",
        passed: false,
        error: error.message,
      });
    }
  }

  // ── Final Report ──
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  TEST RESULTS                            ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`\nTotal:  ${TEST_TASKS.length} tests`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Score:  ${Math.round((passed / TEST_TASKS.length) * 100)}%\n`);

  console.log("─── Detailed Results ───");
  results.forEach((r) => {
    const status = r.passed ? "✅" : "❌";
    console.log(`${status} ${r.taskId} | ${r.category} | Expected: ${r.expected} | Got: ${r.got} | Score: ${r.score}/10`);
  });

  return results;
}

// Run
runTests().catch(console.error);
