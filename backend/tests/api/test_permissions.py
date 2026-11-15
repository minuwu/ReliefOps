"""N15: the permission table, API_SPEC §2 × every mounted route (guide §8.5).

When §2 changes, change this table first. A role marked allowed must get past the
role check: write routes are called with an empty body, so an allowed role gets 422
(validation runs after authentication) and nothing is written; a denied role gets
exactly 403 and an anonymous caller 401. Bank isolation (404) is checked separately.
"""

from __future__ import annotations

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from app.seed import CASE_42_ID, user_id

Login = Callable[[str], dict[str, str]]

CASE = str(CASE_42_ID)
SOMEONE = str(user_id("operator2@opscenter.test"))
INVITATION = "00000000-0000-4000-8000-000000000001"
ROLES = ("operator", "supervisor", "viewer_b", "victim1")

# (method, path, roles allowed); everyone else logged in gets 403, nobody logged in gets 401.
TABLE: list[tuple[str, str, set[str]]] = [
    ("GET", "/api/auth/me", {"operator", "supervisor", "viewer_b", "victim1"}),
    ("GET", "/api/cases", {"operator", "supervisor", "viewer_b"}),
    ("GET", f"/api/cases/{CASE}", {"operator", "supervisor", "viewer_b"}),
    ("POST", "/api/cases", {"operator", "supervisor"}),
    ("PATCH", f"/api/cases/{CASE}", {"operator", "supervisor"}),
    ("POST", f"/api/cases/{CASE}/transition", {"operator", "supervisor"}),
    ("POST", f"/api/cases/{CASE}/assign", {"operator", "supervisor"}),
    ("POST", f"/api/cases/{CASE}/notes", {"operator", "supervisor"}),
    ("GET", "/api/users", {"operator", "supervisor"}),
    ("PATCH", f"/api/users/{SOMEONE}", {"supervisor"}),
    ("POST", "/api/invitations", {"supervisor"}),
    ("GET", "/api/invitations", {"supervisor"}),
    ("POST", f"/api/invitations/{INVITATION}/revoke", {"supervisor"}),
    ("GET", "/api/dashboard/stats", {"supervisor", "viewer_b"}),
    ("GET", "/api/alerts/shared-accounts", {"supervisor"}),
    ("GET", f"/api/victim/cases/{CASE}/chat", {"victim1"}),
    ("GET", f"/api/cases/{CASE}/chat", {"operator", "supervisor", "viewer_b"}),
    ("POST", f"/api/cases/{CASE}/chat/reply", {"operator", "supervisor"}),
    ("GET", "/api/kb/documents", {"operator", "supervisor", "viewer_b"}),
    ("POST", "/api/kb/documents", {"supervisor"}),
    ("POST", f"/api/kb/documents/{INVITATION}/publish", {"supervisor"}),
    ("POST", f"/api/kb/documents/{INVITATION}/archive", {"supervisor"}),
]
PUBLIC: list[tuple[str, str]] = [
    ("GET", "/api/health"),
    ("GET", "/api/banks"),
    ("POST", "/api/auth/login"),
    ("POST", "/api/auth/signup"),
    ("POST", "/api/auth/verify-email"),
    ("POST", "/api/auth/resend-verification"),
    ("POST", "/api/auth/forgot-password"),
    ("POST", "/api/auth/reset-password"),
    ("POST", "/api/auth/accept-invitation"),
]


def _call(client: TestClient, method: str, path: str, headers: dict[str, str]) -> int:
    body = {} if method in ("POST", "PATCH") else None
    return client.request(method, path, headers=headers, json=body).status_code


@pytest.mark.parametrize(
    ("method", "path", "who", "allowed"),
    [(m, p, who, who in allowed) for m, p, allowed in TABLE for who in ROLES],
    ids=lambda v: v if isinstance(v, str) else "",
)
def test_role_matrix(client: TestClient, login_as: Login, method: str, path: str, who: str, allowed: bool) -> None:
    status = _call(client, method, path, login_as(who))
    if allowed:
        assert status not in (401, 403), f"{who} should pass the role check on {method} {path}, got {status}"
    else:
        assert status == 403, f"{who} should get 403 on {method} {path}, got {status}"


@pytest.mark.parametrize(("method", "path", "_allowed"), TABLE, ids=lambda v: v if isinstance(v, str) else "")
def test_no_token_is_401_everywhere(client: TestClient, method: str, path: str, _allowed: set[str]) -> None:
    assert _call(client, method, path, {}) == 401


@pytest.mark.parametrize(("method", "path"), PUBLIC)
def test_public_routes_need_no_token(client: TestClient, method: str, path: str) -> None:
    assert _call(client, method, path, {}) not in (401, 403)


def test_a_viewer_of_another_bank_gets_404_not_403(client: TestClient, login_as: Login) -> None:
    r = client.get(f"/api/cases/{CASE}", headers=login_as("viewer_a"))  # case 00042 is bank_b
    assert (r.status_code, r.json()["error"]["code"]) == (404, "RESOURCE_NOT_FOUND")


def test_every_mounted_api_route_is_in_the_table(client: TestClient) -> None:
    """A new route must be added to the table (or PUBLIC) before it ships."""
    paths = client.get("/openapi.json").json()["paths"]
    mounted = {(m.upper(), p) for p, ops in paths.items() for m in ops if p.startswith("/api/")}
    listed_paths = {p for _m, p, _a in TABLE} | {p for _m, p in PUBLIC}
    templated = {
        p.replace(CASE, "{case_id}")
        .replace(SOMEONE, "{user_id}")
        .replace(INVITATION, "{invitation_id}")
        .replace("/kb/documents/{invitation_id}", "/kb/documents/{kb_document_id}")
        for p in listed_paths
    }
    known_extra = {
        "/api/auth/logout",
        "/api/victim/cases/{case_id}/chat/messages",
        "/api/victim/cases/{case_id}/chat/messages/{message_id}/feedback",
    }
    missing = sorted(p for _m, p in mounted if p not in templated and p not in known_extra)
    assert missing == [], f"add these routes to the permission table: {missing}"
