from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

AVATAR_SIZE = 256
JPEG_QUALITY = 82
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


class AvatarValidationError(ValueError):
    pass


def save_user_avatar(*, user_id: int, uploads_dir: Path, content: bytes, content_type: str | None) -> str:
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise AvatarValidationError("Unsupported image type. Use JPEG, PNG, or WebP.")

    if len(content) > MAX_UPLOAD_BYTES:
        raise AvatarValidationError("Image is too large. Maximum size is 5 MB.")

    if not content:
        raise AvatarValidationError("Image file is empty.")

    try:
        with Image.open(BytesIO(content)) as image:
            image = ImageOps.exif_transpose(image)
            image = image.convert("RGB")
            image = ImageOps.fit(image, (AVATAR_SIZE, AVATAR_SIZE), Image.Resampling.LANCZOS)

            avatars_dir = uploads_dir / "avatars"
            avatars_dir.mkdir(parents=True, exist_ok=True)
            output_path = avatars_dir / f"{user_id}.jpg"
            image.save(output_path, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    except UnidentifiedImageError as exc:
        raise AvatarValidationError("Could not read image file.") from exc

    return f"/uploads/avatars/{user_id}.jpg"
