import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "temporal-awareness",
  version: "1.0.0",
});

server.tool(
  "get_current_time",
  "Returns the current local date, time, and timezone. Use this whenever you need to know what time it is.",
  {
    timezone: z
      .string()
      .optional()
      .describe(
        "IANA timezone (e.g. 'America/New_York'). Defaults to system local time."
      ),
  },
  async ({ timezone }) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");

    let targetDate = now;
    let tzAbbr, tzFullName, ianaZone;

    if (timezone) {
      try {
        // Validate the timezone by attempting to use it
        now.toLocaleString("en-US", { timeZone: timezone });
        ianaZone = timezone;

        tzAbbr = now
          .toLocaleTimeString("en-US", { timeZone: timezone, timeZoneName: "short" })
          .split(" ")
          .pop();

        tzFullName = now
          .toLocaleDateString("en-US", { timeZone: timezone, timeZoneName: "long" })
          .split(", ")
          .pop();

        // Build the date parts in the target timezone
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false,
        }).formatToParts(now);

        const get = (type) => parts.find((p) => p.type === type)?.value;
        var datePart = `${get("year")}-${get("month")}-${get("day")}`;
        var timePart = `${get("hour")}:${get("minute")}:${get("second")}`;
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `Invalid timezone: "${timezone}". Use IANA format (e.g. "America/New_York").`,
            },
          ],
          isError: true,
        };
      }
    } else {
      ianaZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";

      tzAbbr = now
        .toLocaleTimeString("en-US", { timeZoneName: "short" })
        .split(" ")
        .pop();

      tzFullName = now
        .toLocaleDateString("en-US", { timeZoneName: "long" })
        .split(", ")
        .pop();

      var datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      var timePart = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }

    const display = `[${datePart} ${timePart} ${tzAbbr}] (${tzFullName})`;

    return {
      content: [{ type: "text", text: display }],
      structuredContent: {
        timestamp: `${datePart} ${timePart}`,
        abbreviation: tzAbbr,
        timezone_name: tzFullName,
        timezone: ianaZone,
        iso8601: now.toISOString(),
        display,
      },
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
