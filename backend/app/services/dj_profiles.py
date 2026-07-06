from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DJProfile, User, UserRole


def slugify_display_name(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower().strip())
    return slug.strip("-")[:120]


def _unique_slug(db: Session, base_slug: str) -> str:
    slug = base_slug or "dj"
    suffix = 1

    while db.scalar(select(DJProfile.id).where(DJProfile.slug == slug)):
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    return slug


def ensure_dj_profile_for_user(db: Session, user: User) -> DJProfile | None:
    if user.role not in {UserRole.DJ, UserRole.ADMIN}:
        return None

    existing = db.scalar(select(DJProfile).where(DJProfile.user_id == user.id))
    if existing:
        if not existing.is_public:
            existing.is_public = True
        return existing

    artist_name = user.display_name.strip() or f"DJ {user.id}"
    base_slug = slugify_display_name(artist_name) or f"dj-{user.id}"
    profile = DJProfile(
        user_id=user.id,
        artist_name=artist_name,
        slug=_unique_slug(db, base_slug),
        is_public=True,
    )
    db.add(profile)
    db.flush()
    return profile


def ensure_registered_dj_profiles(db: Session) -> None:
    dj_users = list(db.scalars(select(User).where(User.role.in_([UserRole.DJ, UserRole.ADMIN]))))
    for user in dj_users:
        ensure_dj_profile_for_user(db, user)
    db.commit()
