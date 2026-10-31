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
- `route` json null, the GeoJSON `LineString` of the driving route saved at create time
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

## Map points

Places are not stored. A pickup or destination is a map point the rider chooses.

- Bookable area: south 31.300000, north 31.700000, west 74.100000, east 74.550000. Coordinates outside it are validation errors.
- Each coordinate is rounded to 6 decimal places before it is hashed, stored, or compared.
- `place_id` is `{lat},{lng}` with both values at 6 decimal places, for example `31.520400,74.358700`.
- `name` is `{lat}, {lng}`, for example `31.520400, 74.358700`.
- `rides.route` is nullable JSON. Rows written before routes existed have no route.

New drivers still start at Gulberg 31.520400, 74.358700, as the auth spec says.
