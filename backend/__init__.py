"""
Backend package bootstrap.

This keeps the `backend` directory importable from the project root while
preserving the existing module layout that uses `config`, `database`, and
`app.*` imports.
"""

from pathlib import Path
import sys

package_root = Path(__file__).resolve().parent
package_root_str = str(package_root)
if package_root_str not in sys.path:
    sys.path.insert(0, package_root_str)
