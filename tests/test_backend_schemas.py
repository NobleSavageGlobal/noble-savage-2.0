from datetime import date

import pytest

pytest.importorskip("pydantic")

from backend.app.schemas import AuthRegisterIn, TaskPatch


def test_register_email_is_normalized() -> None:
    payload = AuthRegisterIn(
        email="  USER@Example.COM ",
        password="StrongPass123!",
    )
    assert payload.email == "user@example.com"


@pytest.mark.parametrize(
    "password",
    [
        "alllowercase123!",
        "ALLUPPERCASE123!",
        "NoNumberChars!",
        "NoSpecial12345",
    ],
)
def test_register_rejects_weak_password(password: str) -> None:
    with pytest.raises(ValueError):
        AuthRegisterIn(email="user@example.com", password=password)


def test_task_patch_accepts_ws_field() -> None:
    payload = TaskPatch(ws="u_12345678__ws_income", due=date(2026, 7, 4))
    assert payload.ws == "u_12345678__ws_income"
