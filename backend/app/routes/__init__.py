"""Route package for the backend API."""

import sys

sys.modules.setdefault("app.routes", sys.modules[__name__])
sys.modules.setdefault("backend.app.routes", sys.modules[__name__])
