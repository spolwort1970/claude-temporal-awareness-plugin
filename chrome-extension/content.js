/**
 * Claude Temporal Awareness — Content Script
 *
 * Intercepts outgoing messages on claude.ai and prepends a local timestamp
 * so that Claude has temporal context for the conversation.
 *
 * Timestamp format: [2026-03-27 12:34:56 PST]
 */

(function () {
  "use strict";

  /** Build a formatted timestamp string for right now. */
  function getTimestamp() {
    const now = new Date();

    const pad = (n) => String(n).padStart(2, "0");

    const date = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
    ].join("-");

    const time = [
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join(":");

    // Short timezone name (e.g. "PST", "EDT").  Falls back to offset if the
    // browser doesn't provide a short name.
    let tz;
    try {
      tz = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName").value;
    } catch {
      const offset = -now.getTimezoneOffset();
      const sign = offset >= 0 ? "+" : "-";
      const hrs = pad(Math.floor(Math.abs(offset) / 60));
      const mins = pad(Math.abs(offset) % 60);
      tz = `UTC${sign}${hrs}:${mins}`;
    }

    return `[${date} ${time} ${tz}]`;
  }

  /** Locate the ProseMirror / Tiptap editor element on the page. */
  function getEditor() {
    return document.querySelector(
      '[contenteditable="true"].ProseMirror, .ProseMirror[contenteditable="true"]'
    );
  }

  /**
   * Prepend the timestamp to the editor's first text node.
   * Returns true if the timestamp was injected, false otherwise.
   */
  function injectTimestamp(editor) {
    if (!editor) return false;

    const text = editor.innerText.trim();
    if (!text) return false;

    // Don't double-stamp if the user is retrying / editing.
    if (/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} .+?\]/.test(text)) {
      return false;
    }

    const stamp = getTimestamp();

    // Find the first paragraph / text node and prepend.
    const firstBlock = editor.querySelector("p") || editor;
    const firstTextNode = findFirstTextNode(firstBlock);

    if (firstTextNode) {
      firstTextNode.textContent = `${stamp} ${firstTextNode.textContent}`;
    } else {
      firstBlock.textContent = `${stamp} ${firstBlock.textContent}`;
    }

    // Fire an input event so the framework picks up the change.
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    return true;
  }

  /** Walk the DOM to find the first non-empty Text node. */
  function findFirstTextNode(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.textContent.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP,
    });
    return walker.nextNode();
  }

  // ---- Intercept submissions ------------------------------------------------

  /**
   * We capture the keydown (Enter without Shift) and click on the send button
   * during the *capture* phase so we can prepend the timestamp before the app's
   * own handlers fire.
   */

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        const editor = getEditor();
        if (editor && editor.contains(document.activeElement) || editor === document.activeElement) {
          injectTimestamp(editor);
        }
      }
    },
    true // capture phase — runs before the app's listener
  );

  // Also handle the send button click.
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest('button[aria-label="Send message"]') ||
                  e.target.closest('button[aria-label="Send Message"]');
      if (btn) {
        injectTimestamp(getEditor());
      }
    },
    true
  );

  console.log("[Claude Temporal Awareness] Content script loaded.");
})();
