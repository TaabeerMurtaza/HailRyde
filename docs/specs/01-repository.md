# Repository

## Name

The product name is HailRyde in the README title, the browser title, the UI, the Composer package name `hailryde/api`, and the npm package name `hailryde`.

## Layout

- `frontend/` — Vite, React, TypeScript
- `backend/` — Laravel API
- `docker-compose.yml` — PostgreSQL 16, API, Vite
- `docs/specs/` — this contract
- `docs/openapi.yaml` — generated during implementation, must match `05-http-api.md`
- `docs/architecture.md` — answers the assessment architecture questions
- `LICENSE` — assessment-only notice. Do not commit `LISCENCE.txt`

## Framework version

Laravel 11 cannot be installed: Composer blocks every 11.x release for security advisories. Use the current Laravel 13 release and PHP 8.4. Do not ignore the advisories to force Laravel 11.

## Docker

`docker compose up --build` boots:

- Postgres 16 on `localhost:5432`, database `hailryde`, user `hailryde`, password `hailryde`
- API on `http://localhost:8000`
- Web on `http://localhost:5173`

Those database credentials are local development only.

`php artisan serve` does not pass container environment variables into the request worker. The API entrypoint writes `DB_*`, `APP_NAME`, and `APP_URL` from the container environment into `.env` before migrating.

`.env` is never committed. `.env.example` documents the local Postgres settings with `DB_HOST=127.0.0.1` for a host-run API. Compose overrides the host to `postgres`.

## Secrets

No production secrets. Demo account passwords are documented in the README and exist only for local seed data.
