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

```cmd
xcopy /E /I mcp-server\fallback C:\tools\mcp-servers\shared\temporal-awareness\fallback
xcopy /E /I mcp-server\node C:\tools\mcp-servers\shared\temporal-awareness\node
xcopy /E /I mcp-server\python C:\tools\mcp-servers\shared\temporal-awareness\python
```

Then add a single entry to your `~/.mcp.json` file (create it if it doesn't exist) pointing at the fallback wrapper:

```json
{
  "mcpServers": {
    "temporal-awareness": {
      "command": "node",
      "args": ["C:/tools/mcp-servers/shared/temporal-awareness/fallback/index.js"]
    }
  }
}
```

Alternatively, you can point directly at the repo paths if you prefer.

Restart Claude Code after updating `.mcp.json`. Use the `/mcp` command within Claude Code to verify the server is connected.

#### Fallback wrapper (`mcp-server/fallback/`)

The fallback wrapper is a thin Node.js script that selects the Python or Node runtime automatically — no manual switching required.

On startup it runs a pre-flight check (`python -c "import mcp"`). If Python and its dependencies are available, the Python server is used. If not, the Node server kicks in transparently. Claude sees a single `temporal-awareness` tool regardless of which runtime is active.

Stdin is buffered during the pre-flight so no MCP initialization messages are lost. The active runtime is logged to stderr on each startup:

```
[temporal-awareness] Using Python server
```

or, if Python is unavailable:

```
[temporal-awareness] Python/mcp unavailable, falling back to Node
[temporal-awareness] Using Node server
```

The fallback wrapper requires no additional dependencies — it uses only Node built-ins.

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

## Platform Support

All components work cross-platform (Windows, macOS, Linux):

- **Chrome extension** — runs anywhere Chrome does
- **Claude Code hook** — bash script, works natively on macOS/Linux and via Git Bash or WSL on Windows
- **MCP servers** — Node.js and Python are cross-platform; the `tzdata` Python dependency is only required on Windows but is harmless to install elsewhere

Path examples in this README use Windows-style paths (`C:/tools/...`) — substitute your own paths on other platforms.

## Why?

Claude doesn't inherently know what time it is. This matters for:
- Time-of-day awareness ("it's 2am, maybe sleep on it")
- Tracking elapsed time between messages
- Resolving references like "earlier today" or "yesterday"
- Conversations about scheduling and deadlines
