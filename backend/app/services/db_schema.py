from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.config import get_settings


def ensure_sqlite_schema_patches(engine: Engine) -> None:
    settings = get_settings()
    if not settings.database_url.startswith("sqlite"):
        return

    with engine.begin() as connection:
        columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(contributions)")).fetchall()
        }
        if "is_initial" not in columns:
            connection.execute(
                text("ALTER TABLE contributions ADD COLUMN is_initial BOOLEAN NOT NULL DEFAULT 0")
            )
            connection.execute(
                text(
                    """
                    UPDATE contributions
                    SET is_initial = 1
                    WHERE id IN (
                        SELECT MIN(id)
                        FROM contributions
                        GROUP BY song_request_id
                    )
                    """
                )
            )

        event_column_rows = connection.execute(text("PRAGMA table_info(events)")).fetchall()
        event_columns = {row[1] for row in event_column_rows}
        if "flyer_url" not in event_columns:
            connection.execute(text("ALTER TABLE events ADD COLUMN flyer_url VARCHAR(500)"))

        name_column = next((row for row in event_column_rows if row[1] == "name"), None)
        if name_column is not None and name_column[3] == 1:
            connection.execute(text("PRAGMA foreign_keys=OFF"))
            connection.execute(
                text(
                    """
                    CREATE TABLE events__name_nullable (
                        id INTEGER NOT NULL PRIMARY KEY,
                        dj_profile_id INTEGER NOT NULL,
                        venue_id INTEGER NOT NULL,
                        name VARCHAR(255),
                        description TEXT,
                        starts_at DATETIME NOT NULL,
                        ends_at DATETIME,
                        ticket_url VARCHAR(500),
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        flyer_url VARCHAR(500),
                        FOREIGN KEY(dj_profile_id) REFERENCES dj_profiles (id),
                        FOREIGN KEY(venue_id) REFERENCES venues (id)
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    INSERT INTO events__name_nullable (
                        id,
                        dj_profile_id,
                        venue_id,
                        name,
                        description,
                        starts_at,
                        ends_at,
                        ticket_url,
                        created_at,
                        updated_at,
                        flyer_url
                    )
                    SELECT
                        id,
                        dj_profile_id,
                        venue_id,
                        name,
                        description,
                        starts_at,
                        ends_at,
                        ticket_url,
                        created_at,
                        updated_at,
                        flyer_url
                    FROM events
                    """
                )
            )
            connection.execute(text("DROP TABLE events"))
            connection.execute(text("ALTER TABLE events__name_nullable RENAME TO events"))
            connection.execute(text("CREATE INDEX ix_events_venue_id ON events (venue_id)"))
            connection.execute(text("CREATE INDEX ix_events_dj_profile_id ON events (dj_profile_id)"))
            connection.execute(text("PRAGMA foreign_keys=ON"))

        song_request_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(song_requests)")).fetchall()
        }
        if "event_id" not in song_request_columns:
            connection.execute(text("ALTER TABLE song_requests ADD COLUMN event_id INTEGER"))
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_song_requests_event_id ON song_requests (event_id)")
            )
            connection.execute(
                text(
                    """
                    UPDATE song_requests
                    SET event_id = (
                        SELECT dj_sessions.event_id
                        FROM dj_sessions
                        WHERE dj_sessions.id = song_requests.session_id
                    )
                    WHERE event_id IS NULL
                    """
                )
            )
