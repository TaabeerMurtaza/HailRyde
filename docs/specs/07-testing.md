# Testing

## Pest feature tests

Use Pest. Cover:

- Register a rider and a driver. A driver registration without plate or category is `422`.
- A rider can create a ride. A driver cannot (`403`). A driver can accept. A rider cannot (`403`).
- Create persists the fare computed by the documented formula from a fixed fake router's distance and duration, for Economy. The test computes the expected fare with that formula and compares it to the response.
- Coordinates outside the bookable area are `422`.
- The same pin for pickup and destination is `422`.
- A router that reports no road connection gives `422` `no_route`.
- A router that fails or times out gives `503` `route_unavailable`.
- `php artisan test` binds the fake router and does not call the public OSRM demo.
- Invalid body, the same pickup and destination, and a missing `Idempotency-Key` are `422`.
- An offline driver and a driver of the wrong category cannot accept (`409`). An eligible available driver can.
- Two accepts: one PostgreSQL connection holds `SELECT ... FOR UPDATE` on the ride while the other accept returns `409` `lock_timeout`. After that lock commits and releases, one driver accepts with `200` and the other driver accepts with `409` `invalid_transition`.
- Completing a `requested` ride, cancelling a `completed` ride, and accepting a `cancelled` ride are `409` `invalid_transition`.
- The same idempotency key and body returns the original ride with `200` and does not insert a second row. The same key with a different destination returns `409` `idempotency_conflict`.

Tests use the Laravel testing database configuration already set to in-memory SQLite, except the lock-timeout test, which needs PostgreSQL row locks. Skip that one test unless `DB_CONNECTION=pgsql`. Document the Postgres command in the README: run it against the Compose database.

## Frontend

Vitest and Testing Library, on the book page:

- While create is in flight, the busy label is visible.
- When create fails, the error message is visible and the busy label is gone.

## End to end

One Playwright test. The API and Vite dev server are already running. Browser geolocation is set to Gulberg. Log in as `rider@hailryde.test`, click the map once to set the destination, wait for the quoted fare, book Economy, and land on a status URL that shows the same fare. The running API needs network access to the OSRM demo, and the browser needs OpenFreeMap.

## Commands

- `cd backend && php artisan test`
- Lock test, with Compose Postgres up: `cd backend && DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=5432 DB_DATABASE=hailryde DB_USERNAME=hailryde DB_PASSWORD=hailryde php artisan test --filter=lock`
- `cd frontend && npm test`
- `cd frontend && npx playwright test`
