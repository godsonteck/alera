# Vercel Deployment Setup for ALERA

Use this together with [PRODUCTION_RUNBOOK.md](/home/sad/Downloads/alera/PRODUCTION_RUNBOOK.md).

## Required Environment Variables

| Variable | Description | Recommended Value |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Deployment environment override | Leave unset on Vercel unless you explicitly need `production` |
| `VERCEL` | Vercel environment flag | `1` |
| `DATABASE_URL` | Database connection string | Managed PostgreSQL URL |
| `SECRET_KEY` | JWT signing key | Long random secret |
| `ENCRYPTION_KEY` | Sensitive-data encryption key | Long random secret |
| `FRONTEND_URL` | Public frontend origin | `https://alera.health` |
| `CORS_ORIGINS` | Allowed frontend origins | `["https://alera.health"]` |
| `TRUSTED_HOSTS` | Allowed incoming hosts | `alera.health,www.alera.health,*.vercel.app` |
| `EXPOSE_API_DOCS` | OpenAPI/docs exposure | `false` |

## Database Configuration

> [!CAUTION]
> SQLite is not suitable for production persistence on Vercel.

Use a managed PostgreSQL provider such as Supabase, Neon, Railway PostgreSQL, or Render PostgreSQL.

## Environment Notes

- Do not set `ENVIRONMENT=development` in Vercel.
- Vercel already exposes `VERCEL_ENV` as `preview` or `production`, and ALERA now uses that automatically.
- If `ENVIRONMENT=development` is still present in Vercel, ALERA now normalizes it back to the active `VERCEL_ENV`, but it should still be removed from the dashboard.
- Local files like `.env.local` and `backend/.env` are for local development only and should never be tracked in git.

## Deployment Verification

After deploy:

```bash
bash test-health.sh https://your-production-domain
```

Expected:

- `/api/health` returns `200`
- `/api/ready` returns `200`
- `/api/health` reports `environment` as `preview` or `production`, not `development`

## Troubleshooting

If you still see 500 errors:
1. Check Vercel runtime logs.
2. Confirm `DATABASE_URL`, `SECRET_KEY`, `ENCRYPTION_KEY`, and `FRONTEND_URL` are set.
3. Confirm `ENVIRONMENT` is not set to `development` in the Vercel dashboard.
4. Confirm `api/index.py` is the active API entrypoint.
5. Confirm the production DB accepts connections from Vercel.
