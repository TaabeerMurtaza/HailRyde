# HailRyde

Take-home ride-booking assessment. This repository is licensed for technical evaluation only. See [LICENSE](LICENSE).

## Stack

- Frontend: Vite, React, TypeScript (`frontend/`)
- API: Laravel (`backend/`)
- Database: PostgreSQL 16

Behavior is defined in `docs/specs` after the spec commit. This scaffold does not implement rides or accounts.

## Local setup

```bash
docker compose up --build
```

- Web: http://localhost:5173
- API: http://localhost:8000
- Postgres: `localhost:5432`, database `hailryde`, user `hailryde`, password `hailryde`

Those database credentials are for local development only.
