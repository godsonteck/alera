"""Backend application package."""

import sys

# Keep `app` and `backend.app` aligned for legacy imports.
sys.modules.setdefault("app", sys.modules[__name__])
sys.modules.setdefault("backend.app", sys.modules[__name__])
