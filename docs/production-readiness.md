# Alera production readiness

Last reviewed: 2026-07-26

This document tracks evidence, not aspirations. A category is complete only after its controls and automated verification have passed in the target environment.

| Area | Status | Current evidence / required exit criteria |
| --- | --- | --- |
| Architecture inventory | In Progress | React/Vite SPA with FastAPI application deployed through Vercel has been identified. Module-by-module review is pending. |
| Routing and session guard | In Progress | Legal, maintenance, lazy-route fallback, and role-gated dashboard routes were repaired. Route and role matrix still needs executable coverage. |
| Authentication | In Progress | Password, Google, and Apple flows exist. Apple requires production Apple Services ID, return URL, and a complete live-provider verification pass. |
| Authorization | In Progress | Workforce patient-directory access now requires verification and a documented relationship, with regression coverage. Every API endpoint still needs independent review; UI restrictions are not sufficient authorization evidence. |
| Security headers and CORS | In Progress | CSP permits Google and Apple SDKs; HSTS, no-sniff, frame protection, and referrer policy are configured. Credentialed wildcard Vercel CORS has been removed; header verification in deployed production is required. |
| Data protection and privacy | Needs Review | Healthcare data controls, retention, consent, encryption, backups, and access audit policies need formal review and evidence. |
| API and database | In Progress | Production/serverless web workers no longer execute migrations or DDL at startup. The release pipeline must run Alembic before serving traffic; validation, pagination, indexing, idempotency, and query performance still need audit. |
| UI/UX and accessibility | In Progress | Shared visual shells exist. WCAG keyboard, screen-reader, contrast, responsive, error, and loading-state review is pending. |
| Performance | Blocked | Bundle, Core Web Vitals, API latency, and load testing require an executable Node/Python environment and deployed target. |
| Testing | In Progress | CI now executes frontend lint, type-check, tests, build, and backend tests. Local execution is blocked because Node/npm and Python are unavailable on PATH; an isolated API/database-backed E2E job is still required. |
| Observability and operations | Needs Review | Health checks exist in the repository; production logging, alerting, error tracking, runbooks, backups, and rollback drills require review. |
| Deployment | In Progress | Vercel configuration exists. Staging environment, secrets configuration, migrations, deployment protection, and rollback verification are pending. |
| Documentation | In Progress | This readiness register exists. Architecture, deployment, API, data handling, incident response, and onboarding documentation remain to be completed. |

## Current release blockers

1. Runtime tooling is unavailable in the current workspace, so no build, type-check, frontend tests, backend tests, or E2E tests can be executed.
2. Production secrets and external-provider configuration have not been supplied or verified. At minimum, this includes the database, token and encryption secrets, email provider, Google server client ID, and Apple Services ID.
3. A staging deployment with production-equivalent configuration has not yet been validated, including an explicit Alembic migration step before application rollout.
4. Healthcare compliance requirements and operating controls must be approved by qualified legal, privacy, and security stakeholders; code review alone cannot establish HIPAA or other regulatory compliance.

## Required release gate

Before public launch, CI must pass `npm run lint`, `npm run type-check`, `npm test`, backend tests, and Playwright E2E tests. A staged deployment must pass authenticated smoke tests, security-header checks, database migration checks, backup restoration, load testing, and monitoring/alert delivery tests.
