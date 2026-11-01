# HTTP API

Base path `/api`. Authenticated routes use `Authorization: Bearer <token>`.

Error body:

```json
{ "error": { "code": "validation_error", "message": "The given data was invalid.", "details": { "email": ["The email has already been taken."] } } }
```

`details` is an object. Use `{}` when there are no field errors.

## Public

- `POST /api/register` — see auth spec. `201` or `422`.
- `POST /api/login` — `200`, or `401` `invalid_credentials`.

## Authenticated

- `POST /api/logout` — `204`.
- `GET /api/me` — `{ "user": User }`.
- `GET /api/drivers` — query `category` (`economy` or `comfort`, required). Rider only; a driver gets `403` code `forbidden`. `200` `{ "drivers": [ { "id", "lat", "lng", "category" } ] }` for the `available` drivers in that category.
- `POST /api/estimates` — body `pickup_lat`, `pickup_lng`, `destination_lat`, `destination_lng` (numbers), `category`. `200` `{ "distance_km", "duration_min", "fare_amount", "currency": "PKR", "pickup_eta_min", "route" }`. `route` is a GeoJSON `LineString` with `[lng, lat]` positions. `422` for the same pin after 6-decimal rounding and for coordinates outside the bookable area. `422` code `no_route` with message `Those points are not connected by a road.` when no road joins the points. `503` code `route_unavailable` with message `Road routing is unavailable.` when the router cannot be used.

## Rides

`POST /api/rides` — rider only. Header `Idempotency-Key`. Body `pickup_lat`, `pickup_lng`, `destination_lat`, `destination_lng`, `category`. `201` on create, `200` on idempotent replay, `409` for `idempotency_conflict` or `active_ride_exists`, `422` for invalid input (including the same pin and coordinates outside the bookable area), `422` `no_route`, `503` `route_unavailable`, `403` for a driver.

`GET /api/rides/{id}` — rider owner, the assigned driver, or a driver whose category matches a still-`requested` ride. Anyone else gets `403`. Unknown id is `404` code `not_found`.

`GET /api/rides` — query `status` optional.

- Rider: only that rider's rides, newest first. `status` filters when present.
- Driver with `status=requested`: requested rides in the driver's category, oldest first.
- Driver with `status=accepted`: rides assigned to that driver that are `accepted`.
- Driver with no status: the requested list above.
- A rider calling this for the driver desk is just their own rides. A driver is `403` only on create, accept is separate. Listing is allowed for both roles as defined here.

`POST /api/rides/{id}/accept` — driver only. Empty body. `200` with the ride. Errors from the lifecycle spec, plus `403`.

`POST /api/rides/{id}/cancel` — owning rider. `200` with the ride.

`POST /api/rides/{id}/complete` — assigned driver. `200` with the ride.

## Ride resource

```json
{
  "id": 1,
  "status": "requested",
  "category": "economy",
  "pickup": { "id": "33.561778,73.148275", "name": "33.561778, 73.148275", "lat": "33.561778", "lng": "73.148275" },
  "destination": { "id": "33.590000,73.140000", "name": "33.590000, 73.140000", "lat": "33.590000", "lng": "73.140000" },
  "distance_km": "4.21",
  "duration_min": 10,
  "pickup_eta_min": 3,
  "fare_amount": "389.45",
  "currency": "PKR",
  "route": { "type": "LineString", "coordinates": [[73.148275, 33.561778], [73.140000, 33.590000]] },
  "rider": { "id": 1, "name": "Ayesha Khan", "phone": "03000000001" },
  "driver": null,
  "accepted_at": null,
  "cancelled_at": null,
  "completed_at": null
}
```

Numeric money and coordinates are JSON strings from `numeric` casts so values stay exact. `driver` is null until accepted, then `{ "id", "name", "phone", "plate", "category", "lat", "lng" }` with `lat` and `lng` as strings. `route` is the GeoJSON `LineString` saved at create time, or null for a ride that has none. `pickup_eta_min` is null when no available driver matched at create time.

Wrap a single ride as `{ "ride": Ride }`. Wrap a list as `{ "rides": [Ride] }`.
