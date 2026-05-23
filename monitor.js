// ─────────────────────────────────────────────
// AEGIS — Task Monitor
// Watches 0xWork TaskPool on Base chain
// Feeds completed tasks into Aegis for review
// ─────────────────────────────────────────────

import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { runAegis } from "./src/agent.js";

// ─────────────────────────────────────────────
// CONFIGURATION
// Replace TASKPOOL_CONTRACT_ADDRESS with the
// real address once 0xWork confirms it
// ─────────────────────────────────────────────

const CONFIG = {
  // 0xWork TaskPool contract on Base
  // Waiting for confirmation from @0xWorkHQ
  TASKPOOL_ADDRESS: "0x0000000000000000000000000000000000000000",

  // Base chain RPC
  RPC_URL: "https://mainnet.base.org",

  // How often to poll for new tasks (ms)
  HEARTBEAT: 60 * 1000, // every 60 seconds

  // How many blocks to look back on startup
  LOOKBACK_BLOCKS: 1000n,
};

// ─────────────────────────────────────────────
// ABI — Events we listen for
// ─────────────────────────────────────────────

const TASK_SUBMITTED_EVENT = parseAbiItem(
  "event TaskSubmitted(uint256 indexed taskId, address indexed agent, string submission)"
);

const TASK_CREATED_EVENT = parseAbiItem(
  "event TaskCreated(uint256 indexed taskId, address indexed poster, string brief, string category)"
);

// ─────────────────────────────────────────────
// BASE CHAIN CLIENT
// ─────────────────────────────────────────────

const client = createPublicClient({
  chain: base,
  transport: http(CONFIG.RPC_URL),
});

// ─────────────────────────────────────────────
// IN-MEMORY TASK STORE
// Holds task briefs so we can match them
// with submissions when they come in
// ─────────────────────────────────────────────

const taskStore = new Map();

// ─────────────────────────────────────────────
// MONITOR — Main entry point
// ─────────────────────────────────────────────

export async function startMonitor() {
  console.log("\n[AEGIS MONITOR] Starting task monitor...");
  console.log(`[AEGIS MONITOR] Watching: ${CONFIG.TASKPOOL_ADDRESS}`);
  console.log(`[AEGIS MONITOR] Chain: Base Mainnet`);
  console.log(`[AEGIS MONITOR] Heartbeat: ${CONFIG.HEARTBEAT / 1000}s\n`);

  // Initial sync — catch up on recent tasks
  await syncRecentTasks();

  // Start live monitoring
  await startLiveMonitor();
}

// ─────────────────────────────────────────────
// SYNC — Catch up on recent tasks on startup
// ─────────────────────────────────────────────

async function syncRecentTasks() {
  try {
    console.log("[AEGIS MONITOR] Syncing recent tasks...");

    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock - CONFIG.LOOKBACK_BLOCKS;

    // Fetch recent TaskCreated events
    const createdLogs = await client.getLogs({
      address: CONFIG.TASKPOOL_ADDRESS,
      event: TASK_CREATED_EVENT,
      fromBlock,
      toBlock: latestBlock,
    });

    // Store task briefs
    for (const log of createdLogs) {
      const { taskId, poster, brief, category } = log.args;
      taskStore.set(taskId.toString(), { taskId, poster, brief, category });
      console.log(`[AEGIS MONITOR] Loaded task #${taskId} — ${category}`);
    }

    // Fetch recent TaskSubmitted events
    const submittedLogs = await client.getLogs({
      address: CONFIG.TASKPOOL_ADDRESS,
      event: TASK_SUBMITTED_EVENT,
      fromBlock,
      toBlock: latestBlock,
    });

    console.log(`[AEGIS MONITOR] Found ${submittedLogs.length} pending submissions`);

    // Review each submission
    for (const log of submittedLogs) {
      await processSubmission(log);
    }

    console.log("[AEGIS MONITOR] Sync complete\n");

  } catch (error) {
    console.error(`[AEGIS MONITOR] Sync error: ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// LIVE MONITOR — Watch for new events
// ─────────────────────────────────────────────

async function startLiveMonitor() {
  console.log("[AEGIS MONITOR] Live monitoring started...\n");

  // Watch for new task creations
  client.watchEvent({
    address: CONFIG.TASKPOOL_ADDRESS,
    event: TASK_CREATED_EVENT,
    onLogs: async (logs) => {
      for (const log of logs) {
        const { taskId, poster, brief, category } = log.args;
        taskStore.set(taskId.toString(), { taskId, poster, brief, category });
        console.log(`[AEGIS MONITOR] New task detected: #${taskId} — ${category}`);
      }
    },
    onError: (error) => {
      console.error(`[AEGIS MONITOR] Watch error: ${error.message}`);
    },
  });

  // Watch for new submissions
  client.watchEvent({
    address: CONFIG.TASKPOOL_ADDRESS,
    event: TASK_SUBMITTED_EVENT,
    onLogs: async (logs) => {
      for (const log of logs) {
        console.log(`[AEGIS MONITOR] New submission detected for task #${log.args.taskId}`);
        await processSubmission(log);
      }
    },
    onError: (error) => {
      console.error(`[AEGIS MONITOR] Watch error: ${error.message}`);
    },
  });

  // Heartbeat — log status every minute
  setInterval(() => {
    const now = new Date().toLocaleTimeString();
    console.log(`[AEGIS MONITOR] ♥ Heartbeat ${now} — watching ${taskStore.size} tasks`);
  }, CONFIG.HEARTBEAT);
}

// ─────────────────────────────────────────────
// PROCESS — Run Aegis review on a submission
// ─────────────────────────────────────────────

async function processSubmission(log) {
  const { taskId, agent, submission } = log.args;
  const taskIdStr = taskId.toString();

  try {
    // Get the original task brief from store
    const task = taskStore.get(taskIdStr);

    if (!task) {
      console.warn(`[AEGIS MONITOR] Task #${taskIdStr} brief not found — skipping`);
      return;
    }

    console.log(`\n[AEGIS MONITOR] Running Aegis review for task #${taskIdStr}...`);

    // Build payload for Aegis
    const payload = {
      taskId: taskIdStr,
      category: task.category,
      brief: task.brief,
      submission,
      agentAddress: agent,
      posterAddress: task.poster,
    };

    // Run Aegis review
    const report = await runAegis(payload);

    // Log result
    console.log(`[AEGIS MONITOR] ✓ Review complete — Task #${taskIdStr}`);
    console.log(`[AEGIS MONITOR] Score: ${report.scores.overall}/10 — ${report.recommendation}`);
    console.log(`[AEGIS MONITOR] Summary: ${report.summary}\n`);

    return report;

  } catch (error) {
    console.error(`[AEGIS MONITOR] Review failed for task #${taskIdStr}: ${error.message}`);
  }
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────

startMonitor().catch(console.error);
