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

## Timestamp Format

Both components use the same format:

```
[2026-03-27 14:30:45 PST]
```

`YYYY-MM-DD HH:MM:SS TZ` — 24-hour local time with the user's timezone abbreviation.

## Why?

Claude doesn't inherently know what time it is. This matters for:
- Time-of-day awareness ("it's 2am, maybe sleep on it")
- Tracking elapsed time between messages
- Resolving references like "earlier today" or "yesterday"
- Conversations about scheduling and deadlines
