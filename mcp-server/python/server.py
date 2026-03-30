from datetime import datetime, timezone as tz
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("temporal-awareness")


@mcp.tool()
def get_current_time(timezone: str | None = None) -> dict:
    """Returns the current local date, time, and timezone.
    Use this whenever you need to know what time it is.

    Args:
        timezone: IANA timezone (e.g. 'America/New_York'). Defaults to system local time.
    """
    now = datetime.now().astimezone()

    if timezone:
        try:
            zi = ZoneInfo(timezone)
        except (ZoneInfoNotFoundError, KeyError):
            raise ValueError(
                f'Invalid timezone: "{timezone}". Use IANA format (e.g. "America/New_York").'
            )
        now = datetime.now(tz=tz.utc).astimezone(zi)

    iana_zone = timezone or str(now.astimezone().tzinfo)
    abbr = now.strftime("%Z")
    full_name = abbr  # Python doesn't expose long timezone names natively
    date_part = now.strftime("%Y-%m-%d")
    time_part = now.strftime("%H:%M:%S")
    display = f"[{date_part} {time_part} {abbr}] ({iana_zone})"

    return {
        "timestamp": f"{date_part} {time_part}",
        "abbreviation": abbr,
        "timezone_name": iana_zone,
        "timezone": iana_zone,
        "iso8601": now.isoformat(),
        "display": display,
    }


if __name__ == "__main__":
    mcp.run()
