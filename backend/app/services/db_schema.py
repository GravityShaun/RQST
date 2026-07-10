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

        if "shoutout_amount_cents" not in song_request_columns:
            connection.execute(
                text("ALTER TABLE song_requests ADD COLUMN shoutout_amount_cents INTEGER NOT NULL DEFAULT 0")
            )
        if "shoutout_fulfilled" not in song_request_columns:
            connection.execute(text("ALTER TABLE song_requests ADD COLUMN shoutout_fulfilled BOOLEAN"))
        if "play_deadline_minutes" not in song_request_columns:
            connection.execute(text("ALTER TABLE song_requests ADD COLUMN play_deadline_minutes INTEGER"))
        if "play_deadline_amount_cents" not in song_request_columns:
            connection.execute(
                text("ALTER TABLE song_requests ADD COLUMN play_deadline_amount_cents INTEGER NOT NULL DEFAULT 0")
            )
        if "play_deadline_expires_at" not in song_request_columns:
            connection.execute(text("ALTER TABLE song_requests ADD COLUMN play_deadline_expires_at DATETIME"))
        if "play_deadline_remaining_seconds" not in song_request_columns:
            connection.execute(text("ALTER TABLE song_requests ADD COLUMN play_deadline_remaining_seconds INTEGER"))
        if "play_deadline_elapsed_seconds" not in song_request_columns:
            connection.execute(text("ALTER TABLE song_requests ADD COLUMN play_deadline_elapsed_seconds INTEGER"))
        if "expired_at" not in song_request_columns:
            connection.execute(text("ALTER TABLE song_requests ADD COLUMN expired_at DATETIME"))
        if "is_complimentary" not in song_request_columns:
            connection.execute(
                text("ALTER TABLE song_requests ADD COLUMN is_complimentary BOOLEAN NOT NULL DEFAULT 0")
            )

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS complimentary_song_codes (
                    id INTEGER NOT NULL PRIMARY KEY,
                    event_id INTEGER NOT NULL,
                    dj_profile_id INTEGER NOT NULL,
                    code VARCHAR(32) NOT NULL,
                    max_uses INTEGER NOT NULL DEFAULT 10,
                    allow_multiple_uses_per_user BOOLEAN NOT NULL DEFAULT 0,
                    voided_at DATETIME,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(event_id) REFERENCES events (id),
                    FOREIGN KEY(dj_profile_id) REFERENCES dj_profiles (id),
                    UNIQUE (code)
                )
                """
            )
        )
        complimentary_code_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(complimentary_song_codes)")).fetchall()
        }
        if "max_uses" not in complimentary_code_columns:
            connection.execute(
                text("ALTER TABLE complimentary_song_codes ADD COLUMN max_uses INTEGER NOT NULL DEFAULT 10")
            )
        if "voided_at" not in complimentary_code_columns:
            connection.execute(text("ALTER TABLE complimentary_song_codes ADD COLUMN voided_at DATETIME"))
        if "allow_multiple_uses_per_user" not in complimentary_code_columns:
            connection.execute(
                text(
                    "ALTER TABLE complimentary_song_codes "
                    "ADD COLUMN allow_multiple_uses_per_user BOOLEAN NOT NULL DEFAULT 0"
                )
            )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_complimentary_song_codes_event_id "
                "ON complimentary_song_codes (event_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_complimentary_song_codes_dj_profile_id "
                "ON complimentary_song_codes (dj_profile_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_complimentary_song_codes_code "
                "ON complimentary_song_codes (code)"
            )
        )
        # Allow voided historical codes per show; only one active (non-voided) code per event.
        connection.execute(text("DROP INDEX IF EXISTS uq_complimentary_song_codes_event_id"))
        active_duplicates = connection.execute(
            text(
                """
                SELECT event_id
                FROM complimentary_song_codes
                WHERE voided_at IS NULL
                GROUP BY event_id
                HAVING COUNT(*) > 1
                """
            )
        ).fetchall()
        for (event_id,) in active_duplicates:
            keep_id = connection.execute(
                text(
                    """
                    SELECT id
                    FROM complimentary_song_codes
                    WHERE event_id = :event_id AND voided_at IS NULL
                    ORDER BY id DESC
                    LIMIT 1
                    """
                ),
                {"event_id": event_id},
            ).scalar()
            if keep_id is None:
                continue
            connection.execute(
                text(
                    """
                    UPDATE complimentary_song_codes
                    SET voided_at = CURRENT_TIMESTAMP
                    WHERE event_id = :event_id
                      AND voided_at IS NULL
                      AND id != :keep_id
                    """
                ),
                {"event_id": event_id, "keep_id": keep_id},
            )
        connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_complimentary_song_codes_active_event_id
                ON complimentary_song_codes (event_id)
                WHERE voided_at IS NULL
                """
            )
        )

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS complimentary_song_credits (
                    id INTEGER NOT NULL PRIMARY KEY,
                    code_id INTEGER NOT NULL,
                    event_id INTEGER NOT NULL,
                    dj_profile_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    used_at DATETIME,
                    used_song_request_id INTEGER,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(code_id) REFERENCES complimentary_song_codes (id),
                    FOREIGN KEY(event_id) REFERENCES events (id),
                    FOREIGN KEY(dj_profile_id) REFERENCES dj_profiles (id),
                    FOREIGN KEY(user_id) REFERENCES users (id),
                    FOREIGN KEY(used_song_request_id) REFERENCES song_requests (id)
                )
                """
            )
        )
        credit_index_rows = list(
            connection.execute(text("PRAGMA index_list(complimentary_song_credits)")).fetchall()
        )
        # Drop one-credit-per-user uniqueness so DJs can allow repeat redemptions.
        needs_credit_rebuild = False
        for index_row in credit_index_rows:
            index_name = index_row[1]
            is_unique = bool(index_row[2])
            if not is_unique:
                continue
            index_columns = [
                column_row[2]
                for column_row in connection.execute(
                    text(f'PRAGMA index_info("{index_name}")')
                ).fetchall()
            ]
            if index_columns == ["code_id", "user_id"]:
                needs_credit_rebuild = True
                break
        if needs_credit_rebuild:
            connection.execute(text("PRAGMA foreign_keys=OFF"))
            connection.execute(text("DROP TABLE IF EXISTS complimentary_song_credits__multi"))
            connection.execute(
                text(
                    """
                    CREATE TABLE complimentary_song_credits__multi (
                        id INTEGER NOT NULL PRIMARY KEY,
                        code_id INTEGER NOT NULL,
                        event_id INTEGER NOT NULL,
                        dj_profile_id INTEGER NOT NULL,
                        user_id INTEGER NOT NULL,
                        used_at DATETIME,
                        used_song_request_id INTEGER,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(code_id) REFERENCES complimentary_song_codes (id),
                        FOREIGN KEY(event_id) REFERENCES events (id),
                        FOREIGN KEY(dj_profile_id) REFERENCES dj_profiles (id),
                        FOREIGN KEY(user_id) REFERENCES users (id),
                        FOREIGN KEY(used_song_request_id) REFERENCES song_requests (id)
                    )
                    """
                )
            )
            connection.execute(
                text(
                    """
                    INSERT INTO complimentary_song_credits__multi (
                        id, code_id, event_id, dj_profile_id, user_id,
                        used_at, used_song_request_id, created_at, updated_at
                    )
                    SELECT
                        id, code_id, event_id, dj_profile_id, user_id,
                        used_at, used_song_request_id, created_at, updated_at
                    FROM complimentary_song_credits
                    """
                )
            )
            connection.execute(text("DROP TABLE complimentary_song_credits"))
            connection.execute(
                text("ALTER TABLE complimentary_song_credits__multi RENAME TO complimentary_song_credits")
            )
            connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_complimentary_song_credits_event_id "
                "ON complimentary_song_credits (event_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_complimentary_song_credits_dj_profile_id "
                "ON complimentary_song_credits (dj_profile_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_complimentary_song_credits_user_id "
                "ON complimentary_song_credits (user_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_complimentary_song_credits_code_id "
                "ON complimentary_song_credits (code_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_complimentary_song_credits_code_user "
                "ON complimentary_song_credits (code_id, user_id)"
            )
        )

        # Allow the same email across roles (listener + dj); uniqueness is (email, role).
        user_table = connection.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        ).fetchone()
        if user_table is not None:
            user_indexes = list(connection.execute(text("PRAGMA index_list(users)")).fetchall())
            for index_row in user_indexes:
                index_name = index_row[1]
                is_unique = bool(index_row[2])
                if not is_unique:
                    continue
                index_columns = [
                    column_row[2]
                    for column_row in connection.execute(
                        text(f'PRAGMA index_info("{index_name}")')
                    ).fetchall()
                ]
                if index_columns == ["email"]:
                    connection.execute(text(f'DROP INDEX IF EXISTS "{index_name}"'))
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_role "
                    "ON users (email, role)"
                )
            )
            connection.execute(
                text("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)")
            )

        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS tips (
                    id INTEGER NOT NULL PRIMARY KEY,
                    session_id INTEGER NOT NULL,
                    dj_profile_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    amount_cents INTEGER NOT NULL,
                    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
                    status VARCHAR(32) NOT NULL DEFAULT 'pending_payment',
                    payment_id INTEGER,
                    thanked_at DATETIME,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(session_id) REFERENCES dj_sessions (id),
                    FOREIGN KEY(dj_profile_id) REFERENCES dj_profiles (id),
                    FOREIGN KEY(user_id) REFERENCES users (id),
                    FOREIGN KEY(payment_id) REFERENCES payments (id)
                )
                """
            )
        )
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_tips_session_id ON tips (session_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_tips_dj_profile_id ON tips (dj_profile_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_tips_user_id ON tips (user_id)"))

        payment_columns = {
            row[1] for row in connection.execute(text("PRAGMA table_info(payments)")).fetchall()
        }
        if payment_columns and "song_request_id" in payment_columns:
            # SQLite cannot easily alter nullability; recreate only when needed for tip payments.
            notnull = next(
                (row[3] for row in connection.execute(text("PRAGMA table_info(payments)")).fetchall() if row[1] == "song_request_id"),
                0,
            )
            if notnull == 1:
                connection.execute(text("PRAGMA foreign_keys=OFF"))
                connection.execute(
                    text(
                        """
                        CREATE TABLE payments__nullable_request (
                            id INTEGER NOT NULL PRIMARY KEY,
                            user_id INTEGER NOT NULL,
                            dj_profile_id INTEGER NOT NULL,
                            session_id INTEGER NOT NULL,
                            song_request_id INTEGER,
                            provider VARCHAR(64) NOT NULL DEFAULT 'polar',
                            provider_checkout_id VARCHAR(255),
                            provider_payment_id VARCHAR(255),
                            idempotency_key VARCHAR(128) NOT NULL,
                            gross_amount_cents INTEGER NOT NULL,
                            platform_fee_cents INTEGER NOT NULL DEFAULT 0,
                            processing_fee_cents INTEGER NOT NULL DEFAULT 0,
                            net_amount_cents INTEGER NOT NULL DEFAULT 0,
                            currency VARCHAR(3) NOT NULL DEFAULT 'USD',
                            status VARCHAR(32) NOT NULL DEFAULT 'payment_created',
                            checkout_url VARCHAR(500),
                            succeeded_at DATETIME,
                            failed_at DATETIME,
                            refunded_at DATETIME,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY(user_id) REFERENCES users (id),
                            FOREIGN KEY(dj_profile_id) REFERENCES dj_profiles (id),
                            FOREIGN KEY(session_id) REFERENCES dj_sessions (id),
                            FOREIGN KEY(song_request_id) REFERENCES song_requests (id),
                            UNIQUE (idempotency_key)
                        )
                        """
                    )
                )
                connection.execute(
                    text(
                        """
                        INSERT INTO payments__nullable_request (
                            id, user_id, dj_profile_id, session_id, song_request_id, provider,
                            provider_checkout_id, provider_payment_id, idempotency_key,
                            gross_amount_cents, platform_fee_cents, processing_fee_cents,
                            net_amount_cents, currency, status, checkout_url, succeeded_at,
                            failed_at, refunded_at, created_at, updated_at
                        )
                        SELECT
                            id, user_id, dj_profile_id, session_id, song_request_id, provider,
                            provider_checkout_id, provider_payment_id, idempotency_key,
                            gross_amount_cents, platform_fee_cents, processing_fee_cents,
                            net_amount_cents, currency, status, checkout_url, succeeded_at,
                            failed_at, refunded_at, created_at, updated_at
                        FROM payments
                        """
                    )
                )
                connection.execute(text("DROP TABLE payments"))
                connection.execute(text("ALTER TABLE payments__nullable_request RENAME TO payments"))
                connection.execute(text("CREATE INDEX IF NOT EXISTS ix_payments_user_id ON payments (user_id)"))
                connection.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_payments_dj_profile_id ON payments (dj_profile_id)")
                )
                connection.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_payments_session_id ON payments (session_id)")
                )
                connection.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_payments_song_request_id ON payments (song_request_id)")
                )
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_payments_provider_payment_id "
                        "ON payments (provider_payment_id)"
                    )
                )
                connection.execute(text("PRAGMA foreign_keys=ON"))

        ledger_columns = {
            row[1]
            for row in connection.execute(text("PRAGMA table_info(dj_earnings_ledger)")).fetchall()
        }
        if ledger_columns:
            if "tip_id" not in ledger_columns:
                connection.execute(text("ALTER TABLE dj_earnings_ledger ADD COLUMN tip_id INTEGER"))
                connection.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_dj_earnings_ledger_tip_id ON dj_earnings_ledger (tip_id)")
                )
            song_request_notnull = next(
                (
                    row[3]
                    for row in connection.execute(text("PRAGMA table_info(dj_earnings_ledger)")).fetchall()
                    if row[1] == "song_request_id"
                ),
                0,
            )
            if song_request_notnull == 1:
                connection.execute(text("PRAGMA foreign_keys=OFF"))
                connection.execute(
                    text(
                        """
                        CREATE TABLE dj_earnings_ledger__nullable_request (
                            id INTEGER NOT NULL PRIMARY KEY,
                            dj_profile_id INTEGER NOT NULL,
                            session_id INTEGER NOT NULL,
                            song_request_id INTEGER,
                            tip_id INTEGER,
                            payment_id INTEGER NOT NULL,
                            amount_cents INTEGER NOT NULL,
                            currency VARCHAR(3) NOT NULL DEFAULT 'USD',
                            status VARCHAR(32) NOT NULL DEFAULT 'pending_confirmation',
                            available_at DATETIME,
                            paid_out_at DATETIME,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY(dj_profile_id) REFERENCES dj_profiles (id),
                            FOREIGN KEY(session_id) REFERENCES dj_sessions (id),
                            FOREIGN KEY(song_request_id) REFERENCES song_requests (id),
                            FOREIGN KEY(tip_id) REFERENCES tips (id),
                            FOREIGN KEY(payment_id) REFERENCES payments (id)
                        )
                        """
                    )
                )
                connection.execute(
                    text(
                        """
                        INSERT INTO dj_earnings_ledger__nullable_request (
                            id, dj_profile_id, session_id, song_request_id, tip_id, payment_id,
                            amount_cents, currency, status, available_at, paid_out_at, created_at
                        )
                        SELECT
                            id, dj_profile_id, session_id, song_request_id, tip_id, payment_id,
                            amount_cents, currency, status, available_at, paid_out_at, created_at
                        FROM dj_earnings_ledger
                        """
                    )
                )
                connection.execute(text("DROP TABLE dj_earnings_ledger"))
                connection.execute(
                    text("ALTER TABLE dj_earnings_ledger__nullable_request RENAME TO dj_earnings_ledger")
                )
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_dj_earnings_ledger_dj_profile_id "
                        "ON dj_earnings_ledger (dj_profile_id)"
                    )
                )
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_dj_earnings_ledger_session_id "
                        "ON dj_earnings_ledger (session_id)"
                    )
                )
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_dj_earnings_ledger_song_request_id "
                        "ON dj_earnings_ledger (song_request_id)"
                    )
                )
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_dj_earnings_ledger_tip_id "
                        "ON dj_earnings_ledger (tip_id)"
                    )
                )
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_dj_earnings_ledger_payment_id "
                        "ON dj_earnings_ledger (payment_id)"
                    )
                )
                connection.execute(text("PRAGMA foreign_keys=ON"))

