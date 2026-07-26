import json
import os
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_vercel_health_endpoint_reports_startup_errors_instead_of_crashing():
    env = os.environ.copy()
    env.update(
        {
            "VERCEL": "1",
            "VERCEL_ENV": "production",
            "PYTHONPATH": str(PROJECT_ROOT),
        }
    )
    for key in ("DATABASE_URL", "SECRET_KEY", "ENCRYPTION_KEY", "ENVIRONMENT"):
        env.pop(key, None)

    command = [
        sys.executable,
        "-c",
        "\n".join(
            [
                "import asyncio",
                "from api.index import app",
                "",
                "messages = []",
                "",
                "async def receive():",
                "    return {'type': 'http.request', 'body': b'', 'more_body': False}",
                "",
                "async def send(message):",
                "    messages.append(message)",
                "",
                "scope = {",
                "    'type': 'http',",
                "    'asgi': {'version': '3.0'},",
                "    'http_version': '1.1',",
                "    'method': 'GET',",
                "    'scheme': 'http',",
                "    'path': '/api/health',",
                "    'raw_path': b'/api/health',",
                "    'query_string': b'',",
                "    'headers': [],",
                "    'client': ('127.0.0.1', 12345),",
                "    'server': ('testserver', 80),",
                "}",
                "",
                "asyncio.run(app(scope, receive, send))",
                "status = next(message['status'] for message in messages if message['type'] == 'http.response.start')",
                "body = next(message['body'] for message in messages if message['type'] == 'http.response.body')",
                "print(status)",
                "print(body.decode())",
            ]
        ),
    ]
    result = subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )

    lines = [line for line in result.stdout.splitlines() if line.strip()]
    status_line = next(line for line in lines if line.isdigit())
    assert status_line == "200"
    payload = json.loads(lines[-1])

    assert payload["status"] == "degraded"
    assert payload["checks"]["backend"] == "error"
    assert "SECRET_KEY" in payload["startup_error"]
