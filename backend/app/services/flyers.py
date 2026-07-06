from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_FLYER_WIDTH = 1200
MAX_FLYER_HEIGHT = 1600
JPEG_QUALITY = 85
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}


class FlyerValidationError(ValueError):
    pass


def save_event_flyer(*, event_id: int, uploads_dir: Path, content: bytes, content_type: str | None) -> str:
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise FlyerValidationError("Unsupported image type. Use JPEG, PNG, or WebP.")

    if len(content) > MAX_UPLOAD_BYTES:
        raise FlyerValidationError("Flyer image is too large. Maximum size is 8 MB.")

    if not content:
        raise FlyerValidationError("Flyer image file is empty.")

    try:
        with Image.open(BytesIO(content)) as image:
            image = ImageOps.exif_transpose(image)
            image = image.convert("RGB")
            image.thumbnail((MAX_FLYER_WIDTH, MAX_FLYER_HEIGHT), Image.Resampling.LANCZOS)

            flyers_dir = uploads_dir / "flyers"
            flyers_dir.mkdir(parents=True, exist_ok=True)
            output_path = flyers_dir / f"{event_id}.jpg"
            image.save(output_path, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    except UnidentifiedImageError as exc:
        raise FlyerValidationError("Could not read flyer image file.") from exc

    return f"/uploads/flyers/{event_id}.jpg"
