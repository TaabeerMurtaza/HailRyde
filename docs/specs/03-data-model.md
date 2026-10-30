# Data model

Use PostgreSQL. Primary keys are `bigint` identity columns. Timestamps are `timestamptz`. Money is `numeric(10,2)`. Coordinates are `numeric(9,6)`.

Keep Laravel's `users` table and add:

- `phone` text not null
- `role` text not null, check `role in ('rider', 'driver')`

`driver_profiles`

- `user_id` bigint not null, unique, foreign key to `users.id` on delete cascade
- `plate` text not null
- `category` text not null, check `category in ('economy', 'comfort')`
- `status` text not null, default `available`, check `status in ('available', 'on_trip', 'offline')`
- `lat` numeric(9,6) not null
- `lng` numeric(9,6) not null
- timestamps

Index `driver_profiles (status, category)`.

`rides`

- `rider_id` foreign key to `users.id`
- pickup and destination: `place_id` text, `name` text, `lat` numeric(9,6), `lng` numeric(9,6)
- `category` text, check `economy` or `comfort`
- `status` text, check `requested`, `accepted`, `completed`, `cancelled`
- `distance_km` numeric(8,2)
- `duration_min` integer
- `pickup_eta_min` integer null
- `fare_amount` numeric(10,2)
- `idempotency_key` text not null
- `request_hash` text not null
- `accepted_at`, `cancelled_at`, `completed_at` timestamptz null
- timestamps

Constraints and indexes:

- unique `(rider_id, idempotency_key)`
- partial unique index `rides_one_active_per_rider` on `(rider_id)` where `status in ('requested', 'accepted')`
- index `rides (status)`

`driver_assignments`

- `ride_id` unique, foreign key to `rides.id`
- `driver_id` foreign key to `users.id`
- `assigned_at` timestamptz not null
- index on `driver_id`

Sanctum `personal_access_tokens` as published by the package.

## Places

Places are code, not a table. Ids and coordinates:

- `gulberg` — Gulberg — 31.520400, 74.358700
- `liberty` — Liberty — 31.510100, 74.343600
- `dha-phase-5` — DHA Phase 5 — 31.461800, 74.406600
- `model-town` — Model Town — 31.483600, 74.316600
- `airport` — Allama Iqbal Airport — 31.521600, 74.403600
- `johar-town` — Johar Town — 31.469700, 74.272800
- `anarkali` — Anarkali — 31.568900, 74.309500
- `cantt` — Lahore Cantt — 31.524600, 74.379000

Unknown place ids are validation errors.
