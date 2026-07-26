#!/bin/bash
# ALERA - Deployment Verification Script
# Run this before pushing to GitHub to ensure everything is ready

set -e  # Exit on any error

echo "🔍 ALERA - Pre-Deployment Verification"
echo "======================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

fail() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Check Node.js version
echo "1️⃣  Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ]; then
    pass "Node.js v$(node -v) (requirement: >= 18)"
else
    fail "Node.js version too old. Need v18+, got $(node -v)"
fi

# 2. Check npm/yarn
echo ""
echo "2️⃣  Checking package manager..."
if command -v npm &> /dev/null; then
    pass "npm v$(npm -v) installed"
else
    fail "npm not found. Please install Node.js"
fi

# 3. Check git
echo ""
echo "3️⃣  Checking git configuration..."
if command -v git &> /dev/null; then
    pass "git v$(git --version | cut -d' ' -f3) installed"
else
    fail "git not found. Please install git"
fi

# 4. Check git status
echo ""
echo "4️⃣  Checking git status..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    pass "git repository detected"
    GIT_REMOTE=$(git config --get remote.origin.url)
    if [[ "$GIT_REMOTE" == *"emmanueldrah/alera-typescript"* ]]; then
        pass "GitHub remote configured: $GIT_REMOTE"
    else
        warn "GitHub remote: $GIT_REMOTE (expected: emmanueldrah/alera-typescript)"
    fi
else
    fail "Not a git repository"
fi

# 5. Check dependencies
echo ""
echo "5️⃣  Checking dependencies..."
if [ -d "node_modules" ]; then
    pass "node_modules directory exists"
else
    warn "node_modules not found. Run 'npm install'"
fi

# 6. Check important files
echo ""
echo "6️⃣  Checking required files..."
REQUIRED_FILES=(
    "package.json"
    "vite.config.ts"
    "tsconfig.json"
    "vercel.json"
    ".gitignore"
    ".env.example"
    "backend/config.py"
    "backend/main.py"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        pass "$file"
    else
        fail "$file is missing"
    fi
done

# 7. Check for sensitive data
echo ""
echo "7️⃣  Checking for hardcoded secrets..."
if grep -r "your-super-secret-key-change-in-production" . --include="*.py" --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "\.git" > /dev/null; then
    warn "Found placeholder secrets (ensure they're in .env variables)"
else
    pass "No obvious hardcoded secrets found"
fi

# 8. Check for local env files
echo ""
echo "8️⃣  Checking .env files..."
LOCAL_ENV_FILES=()
for env_file in .env .env.local backend/.env; do
    if [ -f "$env_file" ]; then
        LOCAL_ENV_FILES+=("$env_file")
    fi
done

if [ ${#LOCAL_ENV_FILES[@]} -gt 0 ]; then
    warn "Local env files present: ${LOCAL_ENV_FILES[*]}"
    echo "    They are fine for local development, but Vercel should rely on dashboard env vars only."
else
    pass "No local env files found"
fi

TRACKED_ENV_FILES=()
for env_file in .env .env.local backend/.env; do
    if git ls-files --error-unmatch "$env_file" > /dev/null 2>&1; then
        TRACKED_ENV_FILES+=("$env_file")
    fi
done

if [ ${#TRACKED_ENV_FILES[@]} -gt 0 ]; then
    fail "Tracked env files detected: ${TRACKED_ENV_FILES[*]}"
else
    pass "No env files are tracked by git"
fi

# 9. Check TypeScript
echo ""
echo "9️⃣  Checking TypeScript compilation..."
if npm run type-check > /tmp/tsc-check.log 2>&1; then
    pass "TypeScript compilation successful"
else
    fail "TypeScript errors found. Run: npm run type-check"
fi

# 10. Check frontend tests
echo ""
echo "🔟  Running frontend tests..."
if npm test > /tmp/alera-frontend-tests.log 2>&1; then
    pass "Frontend tests passing"
else
    fail "Frontend tests failed. Run: npm test"
fi

# 11. Check backend tests
echo ""
echo "1️⃣1️⃣  Running backend tests..."
if python3 -m pytest -q backend/tests > /tmp/alera-backend-tests.log 2>&1; then
    pass "Backend tests passing"
else
    fail "Backend tests failed. Run: pytest -q backend/tests"
fi

# 12. Check production build
echo ""
echo "1️⃣2️⃣  Building production bundle..."
if npm run build > /tmp/alera-build.log 2>&1; then
    pass "Production build successful"
else
    fail "Production build failed. Run: npm run build"
fi

# 13. Warn about required production env vars
echo ""
echo "1️⃣3️⃣  Checking production environment guidance..."
REQUIRED_ENV_VARS=(
    "DATABASE_URL"
    "SECRET_KEY"
    "ENCRYPTION_KEY"
    "FRONTEND_URL"
    "CORS_ORIGINS"
)

for env_var in "${REQUIRED_ENV_VARS[@]}"; do
    if [ -z "${!env_var}" ]; then
        warn "$env_var is not set in the current shell. Make sure it is configured in production."
    else
        pass "$env_var is set in the current shell"
    fi
done

if [ "${ENVIRONMENT}" = "development" ]; then
    warn "ENVIRONMENT is set to development in the current shell. Do not use that value on Vercel."
fi

if [ -n "${VERCEL_ENV}" ]; then
    pass "VERCEL_ENV is visible in the current shell: ${VERCEL_ENV}"
else
    warn "VERCEL_ENV is not set locally. On Vercel it should be preview or production."
fi

# 14. Summary
echo ""
echo "======================================"
echo -e "${GREEN}✅ All checks passed!${NC}"
echo "======================================"
echo ""
echo "📋 Next steps:"
echo "  1. git add ."
echo "  2. git commit -m 'chore: prepare for production deployment'"
echo "  3. git push origin main"
echo "  4. Deploy via Vercel Dashboard"
echo ""
echo "🔒 Production Checklist:"
echo "  [ ] Generate SECRET_KEY: python scripts/generate_keys.py"
echo "  [ ] Generate ENCRYPTION_KEY (same script)"
echo "  [ ] Add keys to Vercel Environment Variables"
echo "  [ ] Configure DATABASE_URL for production"
echo "  [ ] Confirm Vercel is not injecting ENVIRONMENT=development"
echo "  [ ] Test deployment: https://alera-typescript.vercel.app"
echo ""
