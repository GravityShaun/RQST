from app.core.security import create_token_pair, decode_token, hash_password, verify_password


def test_password_hash_round_trip() -> None:
    password_hash = hash_password("nightlife-secure-password")
    assert verify_password("nightlife-secure-password", password_hash)


def test_access_token_decodes_with_expected_kind() -> None:
    pair = create_token_pair("123", "dj")
    payload = decode_token(pair.access_token, expected_kind="access")
    assert payload["sub"] == "123"
    assert payload["role"] == "dj"
