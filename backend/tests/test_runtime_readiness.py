from fastapi.testclient import TestClient

from main import app


def test_health_endpoint_reports_database_and_startup_checks():
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "ALERA Healthcare API"
    assert payload["checks"]["database"] == "ok"
    assert payload["checks"]["startup"] in {"ok", "pending"}


def test_readiness_endpoint_returns_ready_when_startup_and_database_are_ok():
    client = TestClient(app)
    app.state.startup_complete = True
    app.state.startup_error = None

    response = client.get("/api/ready")

    assert response.status_code == 200
    assert response.json()["status"] == "ready"


def test_runtime_headers_are_attached_to_api_responses():
    client = TestClient(app)

    response = client.get("/api/health", headers={"X-Request-ID": "req-123"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "req-123"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert response.headers["Permissions-Policy"] == "camera=(), microphone=(), geolocation=(self)"
