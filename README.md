# HailRyde

Take-home ride-booking assessment. This repository is licensed for technical evaluation only. See [LICENSE](LICENSE).

## Stack

- Frontend: Vite, React, TypeScript (`frontend/`)
- API: Laravel (`backend/`)
- Database: PostgreSQL 16

Behavior is defined in `docs/specs`. Cursor was used to implement the application from those specs.

## Local setup

```bash
docker compose up --build
```

- Web: http://localhost:5173
- API: http://localhost:8000
- Postgres: `localhost:5432`, database `hailryde`, user `hailryde`, password `hailryde`

Those database credentials are for local development only.

## Demo accounts

Local development only. Every seed account uses the password `password`.

| Email | Role | Name |
| --- | --- | --- |
| rider@hailryde.test | rider | Ayesha Khan |
| economy1@hailryde.test | driver | Bilal Ahmed |
| economy2@hailryde.test | driver | Sana Iqbal |
| comfort1@hailryde.test | driver | Hassan Raza |
| comfort2@hailryde.test | driver | Maria Qureshi |
| offline@hailryde.test | driver | Omar Farooq |

Seed them with `cd backend && php artisan db:seed` after migrating.

## Checks

These commands were run:

- `cd backend && php artisan test` (the lock test skips on SQLite)
- Lock test, with Compose Postgres up: `cd backend && DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=5432 DB_DATABASE=hailryde DB_USERNAME=hailryde DB_PASSWORD=hailryde php artisan test --filter=lock`

Earlier auth checks also ran `cd frontend && npm test`, `cd frontend && npm run build`, and the register, login, logout, and rider/driver route guards in the browser.
