# HailRyde

Take-home ride-booking assessment. This repository is licensed for technical evaluation only. See [LICENSE](LICENSE).

## Stack

- Frontend: Vite, React, TypeScript (`frontend/`)
- API: Laravel on PHP 8.4 (`backend/`)
- Database: PostgreSQL 16

Behavior is defined in `docs/specs`. Cursor was used to implement the application from those specs.

## Service area

Booking is in Soan Gardens. The assessment brief uses Lahore as the example city. Soan Gardens is the service area so a phone or browser at that real place can set the pickup during testing. The bookable box is the neighborhood plus about six kilometres of surrounding roads.

A driver accepts a requested ride in their own category. The pickup ETA is the driving time to the nearest available driver in that category.

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
- `cd frontend && npm test`
- `cd frontend && npm run build`
- `cd frontend && npx playwright test` (Compose web and API already running, database seeded)

The book, status, and driver-desk screens were also walked in the browser: a rider quote, request, status, and cancel; a lost accept showing the transition error; a driver complete; and the rider and driver route guards.

## Known limitations

- Routing uses the public OSRM demo, which has no uptime guarantee. When it fails, quotes return `route_unavailable` and the pickup ETA is null.
- A driver accepts their own ride. The server does not dispatch the nearest driver.
- The demo token lives in `localStorage`. A production client would use an httpOnly cookie.
- The status page and the driver desk poll every 3 seconds. They do not use a push channel.
- The build is one service area, Soan Gardens, with one API process and one Postgres primary.
- `php artisan test` skips the accept lock test unless `DB_CONNECTION=pgsql`.
