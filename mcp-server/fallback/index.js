#!/usr/bin/env node
/**
 * Temporal Awareness MCP Server — Fallback Wrapper
 *
 * Tries the Python server first. If Python or its dependencies are unavailable,
 * falls back to the Node server transparently. The MCP client sees a single
 * "temporal-awareness" server regardless of which runtime is active.
 *
 * No npm dependencies — uses only Node built-ins.
 */

const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PYTHON_SERVER = path.join(ROOT, "python", "server.py");
const NODE_SERVER = path.join(ROOT, "node", "index.js");
const PREFLIGHT_TIMEOUT_MS = 3000;

// Buffer stdin while the pre-flight check runs so we don't drop
// any initialization messages the MCP client sends immediately.
const stdinBuffer = [];
process.stdin.on("data", (chunk) => stdinBuffer.push(chunk));

function startServer(command, args, label) {
  process.stderr.write(`[temporal-awareness] Using ${label} server\n`);

  const proc = spawn(command, args, {
    stdio: ["pipe", "pipe", "inherit"], // inherit stderr so server errors surface
  });

  // Replay anything buffered during pre-flight
  for (const chunk of stdinBuffer) {
    proc.stdin.write(chunk);
  }
  stdinBuffer.length = 0;

  // Wire up ongoing I/O
  process.stdin.pipe(proc.stdin);
  proc.stdout.pipe(process.stdout);

  proc.on("error", (err) => {
    process.stderr.write(
      `[temporal-awareness] ${label} server error: ${err.message}\n`
    );
    process.exit(1);
  });

  proc.on("exit", (code) => process.exit(code ?? 0));
}

function checkPython() {
  return new Promise((resolve) => {
    // Verify both Python and the mcp package are available
    const check = spawn("python", ["-c", "import mcp"], { stdio: "pipe" });

    const timer = setTimeout(() => {
      check.kill();
      resolve(false);
    }, PREFLIGHT_TIMEOUT_MS);

    check.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });

    check.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

async function main() {
  const pythonOk = await checkPython();

  if (pythonOk) {
    startServer("python", [PYTHON_SERVER], "Python");
  } else {
    process.stderr.write(
      "[temporal-awareness] Python/mcp unavailable, falling back to Node\n"
    );
    startServer("node", [NODE_SERVER], "Node");
  }
}

main();
