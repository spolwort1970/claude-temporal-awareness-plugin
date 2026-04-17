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

// ── helpers ──────────────────────────────────────────────────────────────────

function resolveTz(timezone) {
  try {
    // Validate by formatting a date in the requested zone
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw new Error(`Invalid timezone: "${timezone}". Use IANA format (e.g. "America/New_York").`);
  }
}

function parseDt(datetimeStr, timezone) {
  const d = new Date(datetimeStr);
  if (isNaN(d.getTime())) throw new Error(`Cannot parse datetime: "${datetimeStr}". Use ISO 8601 format.`);
  return d;
}

function tzParts(date, timezone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map(({ type, value }) => [type, value]));
  return {
    datePart: `${p.year}-${p.month}-${p.day}`,
    timePart: `${p.hour}:${p.minute}:${p.second}`,
    abbr: date.toLocaleTimeString("en-US", { timeZone: timezone, timeZoneName: "short" }).split(" ").pop(),
  };
}

// ── convert_timezone ──────────────────────────────────────────────────────────

server.tool(
  "convert_timezone",
  "Convert a datetime from one timezone to another.",
  {
    datetime_str: z.string().describe("ISO 8601 datetime string (e.g. '2026-04-17T10:30:00')."),
    from_tz: z.string().describe("Source IANA timezone (e.g. 'America/Los_Angeles')."),
    to_tz: z.string().describe("Target IANA timezone (e.g. 'America/New_York')."),
  },
  async ({ datetime_str, from_tz, to_tz }) => {
    resolveTz(from_tz);
    resolveTz(to_tz);
    const dt = parseDt(datetime_str, from_tz);
    const { datePart, timePart, abbr } = tzParts(dt, to_tz);
    const { datePart: srcDate, timePart: srcTime } = tzParts(dt, from_tz);
    const result = {
      original: `${srcDate}T${srcTime}`,
      converted: `${datePart}T${timePart}`,
      from_tz,
      to_tz,
      display: `${datePart} ${timePart} ${abbr} (${to_tz})`,
    };
    return { content: [{ type: "text", text: result.display }], structuredContent: result };
  }
);

// ── parse_datetime ────────────────────────────────────────────────────────────

server.tool(
  "parse_datetime",
  "Parse an ISO 8601 datetime string into structured components.",
  {
    datetime_str: z.string().describe("ISO 8601 datetime string (e.g. '2026-04-17T10:30:00-07:00')."),
    timezone: z.string().optional().describe("IANA timezone to interpret naive datetimes. Defaults to system local."),
  },
  async ({ datetime_str, timezone }) => {
    const dt = parseDt(datetime_str, timezone);
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    resolveTz(tz);
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
      weekday: "long",
    });
    const p = Object.fromEntries(fmt.formatToParts(dt).map(({ type, value }) => [type, value]));
    const startOfYear = new Date(dt.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((dt - startOfYear) / 86400000);
    const startOfWeek = new Date(dt.getFullYear(), 0, 1);
    const weekOfYear = Math.ceil(((dt - startOfWeek) / 86400000 + startOfWeek.getDay() + 1) / 7);
    const offset = -dt.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const absOff = Math.abs(offset);
    const utcOffset = `${sign}${String(Math.floor(absOff / 60)).padStart(2, "0")}${String(absOff % 60).padStart(2, "0")}`;
    const result = {
      year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate(),
      hour: dt.getHours(), minute: dt.getMinutes(), second: dt.getSeconds(),
      weekday: p.weekday,
      day_of_year: dayOfYear,
      week_of_year: weekOfYear,
      timezone: tz,
      utc_offset: utcOffset,
      iso8601: dt.toISOString(),
    };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  }
);

// ── time_diff ─────────────────────────────────────────────────────────────────

server.tool(
  "time_diff",
  "Calculate the duration between two datetimes.",
  {
    datetime1: z.string().describe("ISO 8601 datetime string."),
    datetime2: z.string().describe("ISO 8601 datetime string."),
    timezone: z.string().optional().describe("IANA timezone for naive datetimes. Defaults to system local."),
  },
  async ({ datetime1, datetime2, timezone }) => {
    const dt1 = parseDt(datetime1, timezone);
    const dt2 = parseDt(datetime2, timezone);
    const totalSeconds = Math.round((dt2 - dt1) / 1000);
    const sign = totalSeconds < 0 ? "-" : "";
    const abs = Math.abs(totalSeconds);
    const days = Math.floor(abs / 86400);
    const hours = Math.floor((abs % 86400) / 3600);
    const minutes = Math.floor((abs % 3600) / 60);
    const seconds = abs % 60;
    const result = {
      total_seconds: totalSeconds,
      days, hours, minutes, seconds,
      display: `${sign}${days}d ${hours}h ${minutes}m ${seconds}s`,
      future: totalSeconds > 0,
    };
    return { content: [{ type: "text", text: result.display }], structuredContent: result };
  }
);

// ── is_dst ────────────────────────────────────────────────────────────────────

server.tool(
  "is_dst",
  "Check whether a timezone is currently observing Daylight Saving Time.",
  {
    timezone: z.string().describe("IANA timezone (e.g. 'America/Los_Angeles')."),
  },
  async ({ timezone }) => {
    resolveTz(timezone);
    const now = new Date();
    // Compare UTC offset in Jan (standard) vs now to detect DST
    const jan = new Date(now.getFullYear(), 0, 1);
    const jul = new Date(now.getFullYear(), 6, 1);
    const janOffset = getOffset(jan, timezone);
    const julOffset = getOffset(jul, timezone);
    const nowOffset = getOffset(now, timezone);
    const stdOffset = Math.max(janOffset, julOffset); // standard = larger offset (less negative)
    const observing = nowOffset !== stdOffset;
    const abbr = now.toLocaleTimeString("en-US", { timeZone: timezone, timeZoneName: "short" }).split(" ").pop();
    const result = {
      timezone,
      is_dst: observing,
      dst_offset_hours: observing ? (nowOffset - stdOffset) / 60 : 0,
      current_time: now.toLocaleString("en-US", { timeZone: timezone }),
      abbreviation: abbr,
    };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };

    function getOffset(date, tz) {
      const utc = date.toLocaleString("en-US", { timeZone: "UTC", hour12: false, hour: "2-digit", minute: "2-digit" });
      const local = date.toLocaleString("en-US", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" });
      const [uh, um] = utc.split(":").map(Number);
      const [lh, lm] = local.split(":").map(Number);
      return (lh * 60 + lm) - (uh * 60 + um);
    }
  }
);

// ── time_until ────────────────────────────────────────────────────────────────

server.tool(
  "time_until",
  "Calculate how much time remains until a future datetime.",
  {
    target_datetime: z.string().describe("ISO 8601 datetime string for the target moment."),
    timezone: z.string().optional().describe("IANA timezone for naive datetimes. Defaults to system local."),
  },
  async ({ target_datetime, timezone }) => {
    const target = parseDt(target_datetime, timezone);
    const now = new Date();
    const totalSeconds = Math.round((target - now) / 1000);
    const abs = Math.abs(totalSeconds);
    const days = Math.floor(abs / 86400);
    const hours = Math.floor((abs % 86400) / 3600);
    const minutes = Math.floor((abs % 3600) / 60);
    const seconds = abs % 60;
    if (totalSeconds < 0) {
      const result = { target: target.toISOString(), in_past: true, total_seconds: totalSeconds, display: `Passed ${days}d ${hours}h ${minutes}m ${seconds}s ago` };
      return { content: [{ type: "text", text: result.display }], structuredContent: result };
    }
    const result = { target: target.toISOString(), in_past: false, total_seconds: totalSeconds, days, hours, minutes, seconds, display: `${days}d ${hours}h ${minutes}m ${seconds}s` };
    return { content: [{ type: "text", text: result.display }], structuredContent: result };
  }
);

// ── start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
