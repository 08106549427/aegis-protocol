// ─────────────────────────────────────────────
// AEGIS — Full 0xWork Integration
// Real API, Real Contracts, Real Data
// ─────────────────────────────────────────────

import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { runAegis } from "./agent.js";

// ─────────────────────────────────────────────
// REAL 0xWORK CONTRACT ADDRESSES ON BASE
// Source: https://api.0xwork.org/manifest.json
// ─────────────────────────────────────────────

const CONTRACTS = {
  taskPool:      "0xF404aFdbA46e05Af7B395FB45c43e66dB549C6D2",
  agentRegistry: "0x14e50557d7d28274368E28C711e3581AdcF56b05",
  platinumPool:  "0x2c514F3E2E56648008404f91B981F8DE5989AB57",
  axobotlToken:  "0x810affc8aadad2824c65e0a2c5ef96ef1de42ba3",
  usdc:          "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

// ─────────────────────────────────────────────
// REAL 0xWORK API ENDPOINTS
// Source: https://api.0xwork.org/manifest.json
// ─────────────────────────────────────────────

const API = {
  base:      "https://api.0xwork.org",
  websocket: "wss://api.0xwork.org/v1/agent",
  tasks:     "https://api.0xwork.org/tasks",
  agents:    "https://api.0xwork.org/agents",
};

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────

const CONFIG = {
  RPC_URL:         "https://base.llamarpc.com",
  HEARTBEAT:       60 * 1000,
  LOOKBACK_BLOCKS: 1000n,
  AGENT_WALLET:    process.env.AGENT_WALLET_ADDRESS || "",
};

// ─────────────────────────────────────────────
// ABI — TaskPool Events
// ─────────────────────────────────────────────

const TASK_CREATED_EVENT = parseAbiItem(
  "event TaskCreated(uint256 indexed taskId, address indexed poster, string brief, string category)"
);

const TASK_SUBMITTED_EVENT = parseAbiItem(
  "event TaskSubmitted(uint256 indexed taskId, address indexed agent, string submission)"
);

const TASK_APPROVED_EVENT = parseAbiItem(
  "event TaskApproved(uint256 indexed taskId, address indexed agent, uint256 amount)"
);

const TASK_REJECTED_EVENT = parseAbiItem(
  "event TaskRejected(uint256 indexed taskId, address indexed agent)"
);

// ─────────────────────────────────────────────
// BASE CHAIN CLIENT
// ─────────────────────────────────────────────

const client = createPublicClient({
  chain: base,
  transport: http(CONFIG.RPC_URL),
});

// ─────────────────────────────────────────────
// IN-MEMORY STORE
// ─────────────────────────────────────────────

const taskStore    = new Map(); // taskId -> task data
const reviewStore  = new Map(); // taskId -> aegis report
const stats = {
  totalReviewed: 0,
  approved: 0,
  revised: 0,
  rejected: 0,
  usdcProtected: 0,
};

// ─────────────────────────────────────────────
// REST API — Fetch tasks from 0xWork API
// ─────────────────────────────────────────────

async function fetchTasksFromAPI() {
  try {
    console.log("[AEGIS MONITOR] Fetching tasks from 0xWork API...");

    const response = await fetch(`${API.tasks}?status=submitted&limit=50`, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Aegis/1.0.0 Quality-Control-Agent",
      },
    });

    if (!response.ok) {
      console.warn(`[AEGIS MONITOR] API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const tasks = data.tasks || data || [];
    console.log(`[AEGIS MONITOR] Found ${tasks.length} submitted tasks`);
    return tasks;

  } catch (error) {
    console.warn(`[AEGIS MONITOR] API fetch failed: ${error.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────
// REST API — Fetch single task details
// ─────────────────────────────────────────────

async function fetchTaskDetails(taskId) {
  try {
    const response = await fetch(`${API.base}/tasks/${taskId}`, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Aegis/1.0.0 Quality-Control-Agent",
      },
    });

    if (!response.ok) return null;

    const task = await response.json();
    return task;

  } catch (error) {
    console.warn(`[AEGIS MONITOR] Failed to fetch task ${taskId}: ${error.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────
// WEBSOCKET — Live task stream
// ─────────────────────────────────────────────

function connectWebSocket() {
  console.log("[AEGIS MONITOR] Connecting to 0xWork WebSocket...");

  try {
    const ws = new WebSocket(API.websocket);

    ws.onopen = () => {
      console.log("[AEGIS MONITOR] ✓ WebSocket connected to 0xWork");

      // Identify as Aegis agent
      ws.send(JSON.stringify({
        type: "identify",
        agent: "Aegis",
        capabilities: ["code", "research", "data"],
        role: "quality-control",
        wallet: CONFIG.AGENT_WALLET,
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "task:submitted") {
          console.log(`[AEGIS MONITOR] WebSocket: New submission for task #${msg.taskId}`);
          await processTaskFromAPI(msg.taskId);
        }

        if (msg.type === "task:created") {
          console.log(`[AEGIS MONITOR] WebSocket: New task #${msg.taskId} — ${msg.category}`);
          taskStore.set(msg.taskId.toString(), msg);
        }

        if (msg.type === "notification") {
          console.log(`[AEGIS MONITOR] Notification: ${msg.message}`);
        }

      } catch (error) {
        console.warn(`[AEGIS MONITOR] WebSocket message error: ${error.message}`);
      }
    };

    ws.onerror = (error) => {
      console.warn("[AEGIS MONITOR] WebSocket error — falling back to REST polling");
    };

    ws.onclose = () => {
      console.log("[AEGIS MONITOR] WebSocket closed — reconnecting in 30s...");
      setTimeout(connectWebSocket, 30000);
    };

    return ws;

  } catch (error) {
    console.warn(`[AEGIS MONITOR] WebSocket unavailable: ${error.message}`);
    console.log("[AEGIS MONITOR] Using REST polling as primary transport");
  }
}

// ─────────────────────────────────────────────
// ON-CHAIN — Watch TaskPool events on Base
// ─────────────────────────────────────────────

async function startOnChainMonitor() {
  console.log("[AEGIS MONITOR] Starting on-chain monitor...");
  console.log(`[AEGIS MONITOR] TaskPool: ${CONTRACTS.taskPool}`);

  try {
    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock - CONFIG.LOOKBACK_BLOCKS;

    // Sync recent submissions
    const submittedLogs = await client.getLogs({
      address: CONTRACTS.taskPool,
      event: TASK_SUBMITTED_EVENT,
      fromBlock,
      toBlock: latestBlock,
    });

    console.log(`[AEGIS MONITOR] Found ${submittedLogs.length} recent submissions on-chain`);

    for (const log of submittedLogs) {
      await processSubmissionFromChain(log);
    }

    // Watch for new submissions live
    client.watchEvent({
      address: CONTRACTS.taskPool,
      event: TASK_SUBMITTED_EVENT,
      onLogs: async (logs) => {
        for (const log of logs) {
          console.log(`[AEGIS MONITOR] On-chain: New submission task #${log.args.taskId}`);
          await processSubmissionFromChain(log);
        }
      },
    });

    // Watch for new task creations
    client.watchEvent({
      address: CONTRACTS.taskPool,
      event: TASK_CREATED_EVENT,
      onLogs: async (logs) => {
        for (const log of logs) {
          const { taskId, poster, brief, category } = log.args;
          taskStore.set(taskId.toString(), { taskId, poster, brief, category });
          console.log(`[AEGIS MONITOR] On-chain: New task #${taskId} — ${category}`);
        }
      },
    });

    console.log("[AEGIS MONITOR] ✓ On-chain monitor active");

  } catch (error) {
    console.warn(`[AEGIS MONITOR] On-chain monitor error: ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// PROCESS — Task from API
// ─────────────────────────────────────────────

async function processTaskFromAPI(taskId) {
  try {
    if (reviewStore.has(taskId.toString())) {
      console.log(`[AEGIS MONITOR] Task #${taskId} already reviewed — skipping`);
      return;
    }

    const task = await fetchTaskDetails(taskId);
    if (!task) return;

    if (!task.submission) {
      console.log(`[AEGIS MONITOR] Task #${taskId} has no submission yet`);
      return;
    }

    const payload = {
      taskId: taskId.toString(),
      category: task.category || "Code",
      brief: task.description || task.brief,
      submission: task.submission,
      agentAddress: task.claimedBy || task.agent || "0x0000",
      posterAddress: task.postedBy || task.poster || "0x0000",
    };

    const report = await runAegis(payload);
    reviewStore.set(taskId.toString(), report);
    updateStats(report);

    console.log(`[AEGIS MONITOR] ✓ Task #${taskId} — ${report.recommendation} (${report.scores?.overall}/10)`);
    return report;

  } catch (error) {
    console.error(`[AEGIS MONITOR] Failed to process task #${taskId}: ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// PROCESS — Submission from on-chain event
// ─────────────────────────────────────────────

async function processSubmissionFromChain(log) {
  const { taskId, agent, submission } = log.args;
  const taskIdStr = taskId.toString();

  try {
    if (reviewStore.has(taskIdStr)) return;

    // Try to get task brief from store first, then API
    let task = taskStore.get(taskIdStr);
    if (!task) {
      task = await fetchTaskDetails(taskIdStr);
      if (task) taskStore.set(taskIdStr, task);
    }

    if (!task) {
      console.warn(`[AEGIS MONITOR] No brief found for task #${taskIdStr}`);
      return;
    }

    const payload = {
      taskId: taskIdStr,
      category: task.category || "Code",
      brief: task.brief || task.description,
      submission: submission || task.submission,
      agentAddress: agent,
      posterAddress: task.poster || task.postedBy || "0x0000",
    };

    const report = await runAegis(payload);
    reviewStore.set(taskIdStr, report);
    updateStats(report);

    console.log(`[AEGIS MONITOR] ✓ On-chain task #${taskIdStr} — ${report.recommendation} (${report.scores?.overall}/10)`);
    return report;

  } catch (error) {
    console.error(`[AEGIS MONITOR] Chain processing failed for #${taskIdStr}: ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// POLL — REST API polling fallback
// ─────────────────────────────────────────────

async function pollForSubmissions() {
  const tasks = await fetchTasksFromAPI();

  for (const task of tasks) {
    const taskId = (task.id || task.taskId || "").toString();
    if (!taskId || reviewStore.has(taskId)) continue;

    if (task.submission || task.status === "submitted") {
      await processTaskFromAPI(taskId);
    }
  }
}

// ─────────────────────────────────────────────
// STATS — Track Aegis performance
// ─────────────────────────────────────────────

function updateStats(report) {
  stats.totalReviewed++;
  if (report.recommendation === "APPROVE") stats.approved++;
  if (report.recommendation === "REVISE")  stats.revised++;
  if (report.recommendation === "REJECT") {
    stats.rejected++;
    stats.usdcProtected += 10; // estimate per rejection
  }
}

function logStats() {
  const time = new Date().toLocaleTimeString();
  console.log(`\n[AEGIS MONITOR] ♥ Heartbeat ${time}`);
  console.log(`  Reviews: ${stats.totalReviewed} | Approved: ${stats.approved} | Revised: ${stats.revised} | Rejected: ${stats.rejected}`);
  console.log(`  USDC Protected: ~$${stats.usdcProtected} | Tasks Cached: ${taskStore.size}\n`);
}

// ─────────────────────────────────────────────
// MAIN — Start everything
// ─────────────────────────────────────────────

export async function startMonitor() {
  console.log("\n╔════════════════════════════════════════╗");
  console.log("║  AEGIS v1.0.0 — Quality Control Layer  ║");
  console.log("║  0xWork · Base chain · Powered by Aegis ║");
  console.log("╚════════════════════════════════════════╝\n");

  console.log("[AEGIS MONITOR] Contracts loaded:");
  console.log(`  TaskPool:      ${CONTRACTS.taskPool}`);
  console.log(`  AgentRegistry: ${CONTRACTS.agentRegistry}`);
  console.log(`  $AXOBOTL:      ${CONTRACTS.axobotlToken}`);
  console.log(`  USDC:          ${CONTRACTS.usdc}\n`);

  // 1. Start on-chain monitor
  await startOnChainMonitor();

  // 2. Connect WebSocket for live task stream
  connectWebSocket();

  // 3. Initial REST API poll
  await pollForSubmissions();

  // 4. Heartbeat — poll REST API every 60 seconds
  setInterval(async () => {
    await pollForSubmissions();
    logStats();
  }, CONFIG.HEARTBEAT);

  console.log("[AEGIS MONITOR] ✓ All systems active. Aegis is watching.\n");
}

// Start
startMonitor().catch(console.error);
