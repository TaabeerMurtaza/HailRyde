# Auth and roles

Two roles, one per account: `rider` and `driver`. No admin role and no permission package. Store `role` on `users` with a check constraint.

Use Laravel Sanctum bearer tokens. The Vite app and the API are different origins.

## Register

`POST /api/register`

Body for every account: `name`, `email`, `password` (minimum 8), `phone` (string, 7 to 20 characters), `role` (`rider` or `driver`).

Drivers also send `plate` (required, max 20) and `category` (`economy` or `comfort`). A rider who sends those fields is still a rider; the fields are ignored.

One database transaction creates the user and, for a driver, one `driver_profiles` row:

- status `available`
- lat `31.520400`, lng `74.358700` (Gulberg)

Response `201`:

```json
{ "token": "...", "user": { "id": 1, "name": "...", "email": "...", "phone": "...", "role": "rider", "driver_profile": null } }
```

A driver user includes `driver_profile` with `plate`, `category`, `status`, `lat`, `lng`.

Duplicate email returns `422` with code `validation_error`. A driver missing `plate` or `category` returns the same.

## Login and session

- `POST /api/login` with `email` and `password`. `200` and the same body shape as register. Unknown credentials return `401` with code `invalid_credentials`.
- `POST /api/logout` revokes the current access token. `204` empty body. Requires auth.
- `GET /api/me` returns `{ "user": { ... } }`. Requires auth.

Send `Authorization: Bearer <token>` on protected routes. Missing or invalid token returns `401` with code `unauthenticated`.

## Authorization

Identity comes from the token. Ignore any user id or driver id in a request body.

- A rider creates, lists, views, and cancels only their own rides.
- A driver lists requested rides in their own category, accepts as themselves, and completes only a ride assigned to them.
- A driver calling create returns `403` code `forbidden`.
- A rider calling accept, complete, or the driver ride list returns `403` code `forbidden`.
- `GET /api/drivers` requires a logged-in rider, and `POST /api/estimates` requires a logged-in user of either role.

## Demo seed

Password for every seed account is `password`. Document it in the README as local only.

| Email | Role | Category | Status | Lat | Lng | Plate |
| --- | --- | --- | --- | --- | --- | --- |
| rider@hailryde.test | rider | | | | | |
| economy1@hailryde.test | driver | economy | available | 31.520400 | 74.358700 | LEA-1001 |
| economy2@hailryde.test | driver | economy | available | 31.469700 | 74.272800 | LEA-1002 |
| comfort1@hailryde.test | driver | comfort | available | 31.461800 | 74.406600 | LEA-2001 |
| comfort2@hailryde.test | driver | comfort | available | 31.521600 | 74.403600 | LEA-2002 |
| offline@hailryde.test | driver | economy | offline | 31.483600 | 74.316600 | LEA-1003 |

Seed names: Ayesha Khan, Bilal Ahmed, Sana Iqbal, Hassan Raza, Maria Qureshi, Omar Farooq, in that email order. Phone numbers `03000000001` through `03000000006`.
