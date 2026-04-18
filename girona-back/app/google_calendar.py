from __future__ import annotations

import json
import os
from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from . import models

_RESERVATION_TIME_FORMATS = ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p")
_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"


class GoogleCalendarConfigError(Exception):
    pass


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _parse_reservation_time(raw_value: str) -> time | None:
    normalized = (raw_value or "").strip()
    for fmt in _RESERVATION_TIME_FORMATS:
        try:
            return datetime.strptime(normalized, fmt).time()
        except ValueError:
            continue
    return None


def _calendar_client():
    service_account_json = (os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON") or "").strip()
    service_account_file = (os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE") or "").strip()

    credentials = None
    if service_account_json:
        try:
            info = json.loads(service_account_json)
        except json.JSONDecodeError as exc:
            raise GoogleCalendarConfigError(
                "GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON valido"
            ) from exc
        credentials = service_account.Credentials.from_service_account_info(
            info, scopes=[_CALENDAR_SCOPE]
        )
    elif service_account_file:
        credentials = service_account.Credentials.from_service_account_file(
            service_account_file, scopes=[_CALENDAR_SCOPE]
        )

    if credentials is None:
        raise GoogleCalendarConfigError(
            "Falta configuracion Google Calendar: define GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_SERVICE_ACCOUNT_FILE"
        )

    return build("calendar", "v3", credentials=credentials, cache_discovery=False)


def _reservation_event_payload(reservation: models.Reservation) -> dict[str, Any]:
    tz_name = (os.getenv("GOOGLE_CALENDAR_TIMEZONE") or "America/Bogota").strip()
    try:
        timezone = ZoneInfo(tz_name)
    except Exception as exc:
        raise GoogleCalendarConfigError(
            f"GOOGLE_CALENDAR_TIMEZONE invalida: {tz_name}"
        ) from exc

    reservation_time = _parse_reservation_time(reservation.reservation_time)
    if reservation_time is None:
        raise GoogleCalendarConfigError(
            f"Hora de reserva invalida para Google Calendar: {reservation.reservation_time}"
        )

    duration_minutes_raw = (os.getenv("GOOGLE_CALENDAR_EVENT_DURATION_MINUTES") or "120").strip()
    try:
        duration_minutes = max(15, int(duration_minutes_raw))
    except ValueError:
        duration_minutes = 120

    start_at = datetime.combine(reservation.reservation_date, reservation_time, tzinfo=timezone)
    end_at = start_at + timedelta(minutes=duration_minutes)

    notify_emails_raw = (os.getenv("GOOGLE_CALENDAR_NOTIFY_EMAIL") or "").strip()
    notify_emails = [email.strip() for email in notify_emails_raw.split(",") if email.strip()]

    attendees = [{"email": email} for email in notify_emails]

    return {
        "summary": f"Reserva Girona - {reservation.name}",
        "description": (
            f"Reserva #{reservation.id}\n"
            f"Nombre: {reservation.name}\n"
            f"Telefono: {reservation.phone}\n"
            f"Personas: {reservation.party_size}\n"
            f"Fecha: {reservation.reservation_date.isoformat()}\n"
            f"Hora: {reservation.reservation_time}"
        ),
        "start": {"dateTime": start_at.isoformat(), "timeZone": tz_name},
        "end": {"dateTime": end_at.isoformat(), "timeZone": tz_name},
        "attendees": attendees,
        "reminders": {"useDefault": True},
    }


def sync_reservation_event(reservation: models.Reservation) -> str | None:
    if not _env_bool("GOOGLE_CALENDAR_ENABLED", default=False):
        return reservation.google_event_id

    calendar_id = (os.getenv("GOOGLE_CALENDAR_ID") or "primary").strip()
    client = _calendar_client()
    payload = _reservation_event_payload(reservation)

    has_attendees = bool(payload.get("attendees"))
    send_updates = "all" if has_attendees else "none"

    try:
        if reservation.google_event_id:
            event = (
                client.events()
                .update(
                    calendarId=calendar_id,
                    eventId=reservation.google_event_id,
                    body=payload,
                    sendUpdates=send_updates,
                )
                .execute()
            )
            return str(event.get("id") or reservation.google_event_id)

        event = (
            client.events()
            .insert(
                calendarId=calendar_id,
                body=payload,
                sendUpdates=send_updates,
            )
            .execute()
        )
        return str(event.get("id") or "")
    except HttpError as exc:
        # Personal Gmail calendars usually reject attendee invites from service accounts
        # unless Domain-Wide Delegation is enabled in Google Workspace.
        if exc.resp is not None and int(exc.resp.status or 0) == 403 and has_attendees:
            fallback_payload = dict(payload)
            fallback_payload.pop("attendees", None)
            if reservation.google_event_id:
                event = (
                    client.events()
                    .update(
                        calendarId=calendar_id,
                        eventId=reservation.google_event_id,
                        body=fallback_payload,
                        sendUpdates="none",
                    )
                    .execute()
                )
                return str(event.get("id") or reservation.google_event_id)
            event = (
                client.events()
                .insert(
                    calendarId=calendar_id,
                    body=fallback_payload,
                    sendUpdates="none",
                )
                .execute()
            )
            return str(event.get("id") or "")
        raise


def delete_reservation_event(event_id: str | None) -> None:
    if not _env_bool("GOOGLE_CALENDAR_ENABLED", default=False):
        return
    normalized_event_id = (event_id or "").strip()
    if not normalized_event_id:
        return
    calendar_id = (os.getenv("GOOGLE_CALENDAR_ID") or "primary").strip()
    client = _calendar_client()
    client.events().delete(
        calendarId=calendar_id,
        eventId=normalized_event_id,
        sendUpdates="all",
    ).execute()
