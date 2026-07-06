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

        event_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(events)")).fetchall()
        }
        if "flyer_url" not in event_columns:
            connection.execute(text("ALTER TABLE events ADD COLUMN flyer_url VARCHAR(500)"))
