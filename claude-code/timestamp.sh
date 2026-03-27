#!/bin/bash
# Claude Temporal Awareness — Claude Code Hook
#
# Injects the current local timestamp as additional context so Claude
# knows exactly when the user is sending each message.

set -e

TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S %Z")

echo "[Current timestamp: ${TIMESTAMP}]"
exit 0
