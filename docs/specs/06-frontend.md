# Frontend

Vite, React, TypeScript, React Router, Tailwind. Browser title `HailRyde`.

Routes:

- `/register` registration form
- `/login` login form
- `/` book, rider only
- `/rides/:id` status
- `/drive` driver desk, driver only

After login or register, a rider goes to `/` and a driver goes to `/drive`. A signed-in user who opens the other role's screen sees a short forbidden message and a link back to their own home. Signed-out users who open `/`, `/rides/:id`, or `/drive` go to `/login`.

Store the bearer token in `localStorage` under `hailryde.token`. The architecture note names an httpOnly cookie as the production replacement. Send the token on every API call. `401` clears the token and shows the login page.

## Register and login

Fields match the API. Role is a choice on the register form. Plate and category appear only when the role is driver. Show field errors from `error.details`. Submit shows a loading label and disables the button.

## Book

Place selects for pickup and destination, category Economy or Comfort, a quote panel, and a request button.

States:

- Empty: form before a quote has loaded, quote panel says to choose two different places.
- Loading quote: while `POST /api/estimates` is in flight.
- Quote: fare, distance, duration, and pickup ETA. If ETA is null, say no driver is available nearby and still show the fare.
- Loading submit: button shows a busy label and is disabled. Keep one `Idempotency-Key` for that attempt in `sessionStorage` until the request settles, then clear it.
- Error: the API error message and a retry control. Retry reuses the same idempotency key for that attempt.
- Success: navigate to `/rides/:id`.

Do not send a fare in the create body.

## Status

Show confirmation, places, fare, ETA, status, and the driver when present. An SVG placeholder draws the two places. It is not a live map.

Poll `GET /api/rides/{id}` every 3 seconds while status is `requested` or `accepted`. Stop polling after `completed` or `cancelled`.

A rider sees Cancel while status is `requested` or `accepted`. Cancel shows its own loading and error states.

## Driver desk

The signed-in driver is the only identity. There is no driver picker.

List requested rides in the driver's category. Accept calls `POST /api/rides/{id}/accept`. Show the driver's accepted ride with Complete. Accept and complete have loading and error states. A `409` from a lost accept shows the error message.

## API client

Non-OK responses become typed errors `{ code, message, details }`. Network failures use code `network_error` and a short message. The book page must render that error state rather than staying on the loading label.
