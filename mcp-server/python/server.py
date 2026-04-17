from datetime import datetime, timezone as tz, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("temporal-awareness")


def _parse_dt(datetime_str: str, timezone: str | None = None) -> datetime:
    """Parse ISO 8601 string into an aware datetime, optionally in a given tz."""
    try:
        dt = datetime.fromisoformat(datetime_str)
    except ValueError:
        raise ValueError(f'Cannot parse datetime: "{datetime_str}". Use ISO 8601 format.')
    if dt.tzinfo is None:
        if timezone:
            try:
                dt = dt.replace(tzinfo=ZoneInfo(timezone))
            except (ZoneInfoNotFoundError, KeyError):
                raise ValueError(f'Invalid timezone: "{timezone}".')
        else:
            dt = dt.astimezone()
    return dt


def _resolve_tz(timezone: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, KeyError):
        raise ValueError(f'Invalid timezone: "{timezone}". Use IANA format (e.g. "America/New_York").')


@mcp.tool()
def get_current_time(timezone: str | None = None) -> dict:
    """Returns the current local date, time, and timezone.
    Use this whenever you need to know what time it is.

    Args:
        timezone: IANA timezone (e.g. 'America/New_York'). Defaults to system local time.
    """
    now = datetime.now().astimezone()

    if timezone:
        zi = _resolve_tz(timezone)
        now = datetime.now(tz=tz.utc).astimezone(zi)

    iana_zone = timezone or str(now.astimezone().tzinfo)
    abbr = now.strftime("%Z")
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


@mcp.tool()
def convert_timezone(datetime_str: str, from_tz: str, to_tz: str) -> dict:
    """Convert a datetime from one timezone to another.

    Args:
        datetime_str: ISO 8601 datetime string (e.g. '2026-04-17T10:30:00').
        from_tz: Source IANA timezone (e.g. 'America/Los_Angeles').
        to_tz: Target IANA timezone (e.g. 'America/New_York').
    """
    src_zi = _resolve_tz(from_tz)
    dst_zi = _resolve_tz(to_tz)

    dt = _parse_dt(datetime_str, from_tz)
    if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
        dt = dt.replace(tzinfo=src_zi)
    else:
        dt = dt.astimezone(src_zi)

    converted = dt.astimezone(dst_zi)
    return {
        "original": dt.isoformat(),
        "converted": converted.isoformat(),
        "from_tz": from_tz,
        "to_tz": to_tz,
        "display": converted.strftime(f"%Y-%m-%d %H:%M:%S %Z ({to_tz})"),
    }


@mcp.tool()
def parse_datetime(datetime_str: str, timezone: str | None = None) -> dict:
    """Parse an ISO 8601 datetime string into structured components.

    Args:
        datetime_str: ISO 8601 datetime string (e.g. '2026-04-17T10:30:00-07:00').
        timezone: IANA timezone to interpret naive datetimes. Defaults to system local.
    """
    dt = _parse_dt(datetime_str, timezone)
    return {
        "year": dt.year,
        "month": dt.month,
        "day": dt.day,
        "hour": dt.hour,
        "minute": dt.minute,
        "second": dt.second,
        "weekday": dt.strftime("%A"),
        "day_of_year": int(dt.strftime("%j")),
        "week_of_year": int(dt.strftime("%W")),
        "timezone": str(dt.tzinfo),
        "utc_offset": dt.strftime("%z"),
        "iso8601": dt.isoformat(),
    }


@mcp.tool()
def time_diff(datetime1: str, datetime2: str, timezone: str | None = None) -> dict:
    """Calculate the duration between two datetimes.

    Args:
        datetime1: ISO 8601 datetime string (earlier or later — order doesn't matter).
        datetime2: ISO 8601 datetime string.
        timezone: IANA timezone for naive datetimes. Defaults to system local.
    """
    dt1 = _parse_dt(datetime1, timezone)
    dt2 = _parse_dt(datetime2, timezone)

    delta = dt2 - dt1
    total_seconds = int(delta.total_seconds())
    sign = "" if total_seconds >= 0 else "-"
    total_seconds = abs(total_seconds)

    days, rem = divmod(total_seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, seconds = divmod(rem, 60)

    return {
        "total_seconds": int(delta.total_seconds()),
        "days": days,
        "hours": hours,
        "minutes": minutes,
        "seconds": seconds,
        "display": f"{sign}{days}d {hours}h {minutes}m {seconds}s",
        "future": delta.total_seconds() > 0,
    }


@mcp.tool()
def is_dst(timezone: str) -> dict:
    """Check whether a timezone is currently observing Daylight Saving Time.

    Args:
        timezone: IANA timezone (e.g. 'America/Los_Angeles').
    """
    zi = _resolve_tz(timezone)
    now = datetime.now(tz=zi)
    dst_offset = now.dst()
    observing = dst_offset is not None and dst_offset != timedelta(0)
    return {
        "timezone": timezone,
        "is_dst": observing,
        "dst_offset_hours": dst_offset.total_seconds() / 3600 if dst_offset else 0,
        "current_time": now.isoformat(),
        "abbreviation": now.strftime("%Z"),
    }


@mcp.tool()
def time_until(target_datetime: str, timezone: str | None = None) -> dict:
    """Calculate how much time remains until a future datetime.

    Args:
        target_datetime: ISO 8601 datetime string for the target moment.
        timezone: IANA timezone for naive datetimes. Defaults to system local.
    """
    target = _parse_dt(target_datetime, timezone)
    now = datetime.now(tz=target.tzinfo)
    delta = target - now
    total_seconds = int(delta.total_seconds())

    if total_seconds < 0:
        elapsed = abs(total_seconds)
        days, rem = divmod(elapsed, 86400)
        hours, rem = divmod(rem, 3600)
        minutes, seconds = divmod(rem, 60)
        return {
            "target": target.isoformat(),
            "in_past": True,
            "total_seconds": total_seconds,
            "display": f"Passed {days}d {hours}h {minutes}m {seconds}s ago",
        }

    days, rem = divmod(total_seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, seconds = divmod(rem, 60)

    return {
        "target": target.isoformat(),
        "in_past": False,
        "total_seconds": total_seconds,
        "days": days,
        "hours": hours,
        "minutes": minutes,
        "seconds": seconds,
        "display": f"{days}d {hours}h {minutes}m {seconds}s",
    }


if __name__ == "__main__":
    mcp.run()
