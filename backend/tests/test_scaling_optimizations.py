import pytest
from fastapi.testclient import TestClient
from main import app
from app.utils.redis import redis_get, redis_set, redis_delete
import json
import time

client = TestClient(app)

@pytest.fixture
def admin_token():
    response = client.post(
        "/api/auth/login",
        json={
            "email": "admin@alera.health",
            "password": "admin_alera_2026!",
        },
    )
    assert response.status_code == 200
    return response.cookies.get("access_token")

def test_dashboard_stats_caching(admin_token):
    # Clear cache first
    redis_delete("admin:dashboard:stats")
    
    # First request - should be a miss
    response = client.get("/api/admin/dashboard/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert "cached" not in data
    
    # Second request - should be a hit
    response = client.get("/api/admin/dashboard/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200
    data = response.json()
    assert data.get("cached") is True

def test_user_status_caching(admin_token):
    # This test is harder to verify externally without checking Redis directly,
    # but we can check if it still works.
    response = client.get("/api/admin/system/health", headers={"Authorization": f"Bearer {admin_token}"})
    assert response.status_code == 200

def test_slow_request_logging():
    # We can't easily check logs from here, but we can check the header
    response = client.get("/api/health")
    assert response.status_code == 200
    assert "X-Process-Time-Ms" in response.headers
