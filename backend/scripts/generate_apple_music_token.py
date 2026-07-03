from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import time
from pathlib import Path


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for line in path.read_text().splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def upsert_env_value(path: Path, key: str, value: str) -> None:
    lines = path.read_text().splitlines() if path.exists() else []
    next_lines: list[str] = []
    replaced = False

    for line in lines:
        if line.startswith(f"{key}="):
            next_lines.append(f"{key}={value}")
            replaced = True
        else:
            next_lines.append(line)

    if not replaced:
        next_lines.append(f"{key}={value}")

    path.write_text("\n".join(next_lines) + "\n")


def base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def read_der_integer(signature: bytes, offset: int) -> tuple[bytes, int]:
    if signature[offset] != 0x02:
        raise ValueError("Invalid ECDSA signature integer")

    length = signature[offset + 1]
    start = offset + 2
    end = start + length
    value = signature[start:end].lstrip(b"\x00")
    return value.rjust(32, b"\x00"), end


def der_to_raw_ecdsa_signature(signature: bytes) -> bytes:
    if not signature or signature[0] != 0x30:
        raise ValueError("Invalid ECDSA signature")

    offset = 2
    if signature[1] & 0x80:
        length_bytes = signature[1] & 0x7F
        offset = 2 + length_bytes

    r, offset = read_der_integer(signature, offset)
    s, _offset = read_der_integer(signature, offset)
    return r + s


def sign_es256(signing_input: bytes, key_file: Path) -> bytes:
    result = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", str(key_file)],
        check=True,
        input=signing_input,
        capture_output=True,
    )
    return der_to_raw_ecdsa_signature(result.stdout)


def encode_developer_token(*, team_id: str, key_id: str, key_file: Path, expires_at: int) -> str:
    now = int(time.time())
    header = {"alg": "ES256", "kid": key_id, "typ": "JWT"}
    payload = {"iss": team_id, "iat": now, "exp": expires_at}
    signing_input = ".".join(
        [
            base64url(json.dumps(header, separators=(",", ":")).encode("utf-8")),
            base64url(json.dumps(payload, separators=(",", ":")).encode("utf-8")),
        ]
    ).encode("ascii")
    signature = sign_es256(signing_input, key_file)
    return f"{signing_input.decode('ascii')}.{base64url(signature)}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate and store an Apple Music developer JWT.")
    parser.add_argument("--env-file", default=".env", type=Path)
    parser.add_argument("--key-file", type=Path)
    parser.add_argument("--ttl-days", default=180, type=int)
    args = parser.parse_args()

    env = read_env(args.env_file)
    team_id = env.get("RQST_APPLE_MUSIC_TEAM_ID") or os.getenv("RQST_APPLE_MUSIC_TEAM_ID")
    key_id = env.get("RQST_APPLE_MUSIC_KEY_ID") or os.getenv("RQST_APPLE_MUSIC_KEY_ID")

    if not team_id or not key_id:
        raise SystemExit("Missing RQST_APPLE_MUSIC_TEAM_ID or RQST_APPLE_MUSIC_KEY_ID")

    key_file = args.key_file or Path(".secrets") / f"AuthKey_{key_id}.p8"
    if not key_file.exists():
        raise SystemExit(f"Missing Apple Music private key file: {key_file}")

    token = encode_developer_token(
        team_id=team_id,
        key_id=key_id,
        key_file=key_file,
        expires_at=int(time.time()) + args.ttl_days * 24 * 60 * 60,
    )

    upsert_env_value(args.env_file, "RQST_APPLE_MUSIC_DEVELOPER_TOKEN", token)
    print(f"Updated {args.env_file} with a {len(token)} character Apple Music developer token.")


if __name__ == "__main__":
    main()
