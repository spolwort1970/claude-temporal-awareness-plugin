# Claude Temporal Awareness Plugin

Gives Claude the gift of time. Injects timestamps into conversations so Claude knows *when* you're talking, not just *what* you're saying.

## Components

### Chrome Extension (`chrome-extension/`)

Prepends a timestamp like `[2026-03-27 12:34:56 PST]` to every message you send on **claude.ai**.

**Install:**
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `chrome-extension/` folder
4. Open or refresh claude.ai — timestamps are automatic from that point on

### Claude Code Hook (`claude-code/`)

Injects the current timestamp as additional context on every prompt submission in **Claude Code** (CLI/desktop/IDE).

**Install:**

Copy the hook configuration into your project or user settings:

**Option A — Project-level** (this repo only):
Copy `claude-code/settings.json` to `.claude/settings.json` in your project, updating the path to `timestamp.sh`.

**Option B — User-level** (all projects):
Merge the hook config from `claude-code/settings.json` into `~/.claude/settings.json` and use an absolute path to `timestamp.sh`.

Example for user-level setup:
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash /path/to/claude-temporal-awareness-plugin/claude-code/timestamp.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### MCP Server (`mcp-server/`)

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes a `get_current_time` tool Claude can call on demand. Available in both Node.js and Python — pick whichever runtime you have.

The server returns both a display string and structured data:

```json
{
  "timestamp": "2026-03-30 07:16:55",
  "abbreviation": "PDT",
  "timezone_name": "Pacific Daylight Time",
  "timezone": "America/Los_Angeles",
  "iso8601": "2026-03-30T14:16:55.264Z",
  "display": "[2026-03-30 07:16:55 PDT] (Pacific Daylight Time)"
}
```

The tool also accepts an optional `timezone` parameter (IANA format like `America/New_York`) and defaults to system local time.

#### Install (Node.js)

```bash
cd mcp-server/node
npm install
```

#### Install (Python)

```bash
cd mcp-server/python
pip install -r requirements.txt
```

#### Configure

**Recommended:** Copy the server to a central tools directory so your config doesn't depend on the repo location:

```bash
# Create the directory structure
mkdir -p /c/tools/mcp-servers/shared/temporal-awareness

# Copy the server(s) you want to use
cp -r mcp-server/node /c/tools/mcp-servers/shared/temporal-awareness/node
cp -r mcp-server/python /c/tools/mcp-servers/shared/temporal-awareness/python
```

Then add an entry to your `~/.mcp.json` file (create it if it doesn't exist). You can register one or both versions:

```json
{
  "mcpServers": {
    "temporal-awareness": {
      "command": "python",
      "args": ["C:/tools/mcp-servers/shared/temporal-awareness/python/server.py"]
    },
    "temporal-awareness-node": {
      "command": "node",
      "args": ["C:/tools/mcp-servers/shared/temporal-awareness/node/index.js"]
    }
  }
}
```

Alternatively, you can point directly at the repo paths if you prefer.

Restart Claude Code after updating `.mcp.json`. Use the `/mcp` command within Claude Code to verify the server is connected and to enable/disable servers as needed.

> **Tip:** The MCP server and Claude Code hook complement each other — the hook provides passive timestamp injection on every message, while the MCP server lets Claude actively check the time mid-task. You can run both simultaneously.

#### Compatibility

The MCP server uses the standard [MCP protocol](https://modelcontextprotocol.io/) over stdio, so it works with any MCP-compatible client — not just Claude Code. If you use other AI CLI tools that support MCP (e.g., OpenAI Codex CLI), you can point them at the same server.

## Timestamp Format

All components use the same display format:

```
[2026-03-30 14:30:45 PDT] (Pacific Daylight Time)
```

`YYYY-MM-DD HH:MM:SS TZ` — 24-hour local time with timezone abbreviation and full timezone name.

The MCP server additionally returns structured fields (timestamp, abbreviation, timezone, iso8601) for programmatic use.

## Why?

Claude doesn't inherently know what time it is. This matters for:
- Time-of-day awareness ("it's 2am, maybe sleep on it")
- Tracking elapsed time between messages
- Resolving references like "earlier today" or "yesterday"
- Conversations about scheduling and deadlines
