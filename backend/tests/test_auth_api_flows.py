from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def test_register_and_login_endpoints_work_for_patient_account(monkeypatch):
    async def noop_send_verification_email(*args, **kwargs):
        return None

    monkeypatch.setattr("app.routes.auth.EmailService.send_verification_email", noop_send_verification_email)

    client = TestClient(app)

    register_response = client.post(
        "/api/auth/register",
        json={
            "email": "flow@example.com",
            "username": "flow-user",
            "first_name": "Flow",
            "last_name": "Tester",
            "password": "password123",
            "role": "patient",
        },
    )

    assert register_response.status_code == 201, register_response.text
    register_payload = register_response.json()
    assert register_payload["user"]["email"] == "flow@example.com"
    assert register_payload["message"] == "Account created successfully"
    assert register_payload["csrf_token"]
    assert "access_token" in register_response.cookies
    assert "refresh_token" in register_response.cookies
    assert "csrf_token" in register_response.cookies

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "flow@example.com",
            "password": "password123",
        },
    )

    assert login_response.status_code == 200, login_response.text
    login_payload = login_response.json()
    assert login_payload["user"]["email"] == "flow@example.com"
    assert login_payload["message"] == "Login successful"
    assert login_payload["csrf_token"]
    assert "access_token" in login_response.cookies
    assert "refresh_token" in login_response.cookies
    assert "csrf_token" in login_response.cookies
