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

A MapLibre map of Soan Gardens (OpenFreeMap tiles, bounded to the service area) replaces the place selects. Below it the page shows `Pickup {lat}, {lng}` and `Destination {lat}, {lng}` with six decimals, or `Pickup not set` and `Destination not set`. A category choice (Economy or Comfort), a quote panel, and a request button complete the form.

Before a location request or the map, load `GET /api/rides?status=accepted` and `GET /api/rides?status=requested`. If either list has a ride, go to `/rides/:id`, using the `accepted` ride when both are present. While that lookup runs the page says `Loading ride…` and does not ask for a location. A failure shows the error message and a `Retry` control, and does not show the booking form.

Pickup:

- On mount the page asks the browser for a position. A fix inside the service area becomes the pickup and shows as a blue dot. A missing geolocation API, a denial, a timeout, or a fix outside the service area leaves the pickup unset and shows `Place the pickup pin on the map.`
- `Use my location` asks again. While a location request is in flight the button is disabled and reads `Finding your location…`. A fix inside the service area sets the pickup, including when a pickup pin is already placed, and the map centers on that fix. Otherwise the pickup stays as it is, and the page shows `Place the pickup pin on the map.` when the pickup is unset. The map also centers on the fix when the first usable position on mount becomes the pickup. With no usable fix the map stays centered on Soan Gardens.

Pins:

- A map click sets the pickup when it is unset and the destination otherwise. Both pins are draggable and a drag sets that pin to the drop point. A click that lands on an existing pin does not place or move a pin. Clicks on the map surface still set the pickup when it is unset and the destination otherwise.
- While a ride request is in flight the map is not interactive: clicks and drags are ignored.
- Available drivers of the chosen category show as small grey dots. The page polls `GET /api/drivers?category=` immediately, on category change, and every 10 seconds. A failed poll keeps the previous dots and does not block the quote.
- The quoted route is drawn as a line. With no quote the line is empty.

Quote:

- When both pins exist and differ at six decimals, wait 400 ms, then call `POST /api/estimates` with `pickup_lat`, `pickup_lng`, `destination_lat`, `destination_lng`, and `category` as numbers. A response for an older pin pair is ignored. Missing or equal pins clear the quote.
- Under the quote the page shows `Routes by OSRM`.

States:

- Empty: quote panel says `Set a pickup and a destination.`
- Loading quote: while the 400 ms wait or `POST /api/estimates` is in flight.
- Quote: fare, distance, duration, and pickup ETA. If ETA is null, say no driver is available nearby and still show the fare.
- Quote error: the API error message and a `Retry` control that requests the quote again.
- Loading submit: button shows a busy label and is disabled. Keep one `Idempotency-Key` for that attempt in `sessionStorage` until the request settles, then clear it. Changing a pin (at six decimals) or the category clears the key.
- Error: the API error message and a retry control. Retry reuses the same idempotency key for that attempt.
- Success: navigate to `/rides/:id`.

Create sends the same coordinate body as the estimate. Do not send a fare in the create body.

## Status

Show confirmation, places, fare, ETA, status, and the driver when present. The status page draws the stored route on the same MapLibre map used for booking, the assigned driver's stored coordinates when a driver is present, and the GPS dot when the browser allows it. The map frames the route, or the two pins when the route is null, so the trip is on screen. A null route draws the pins and no line. The page does not call OSRM.

Poll `GET /api/rides/{id}` every 3 seconds while status is `requested` or `accepted`. Stop polling after `completed` or `cancelled`.

A rider sees Cancel while status is `requested` or `accepted`. Cancel shows its own loading and error states.

The assigned driver sees Complete while status is `accepted`. Complete shows its own loading and error states.

When the status is `completed` or `cancelled`, the page shows a link to that account's home. A rider's link reads `Back to booking` and goes to `/`. A driver's link reads `Back to the driver desk` and goes to `/drive`.

## Driver desk

The signed-in driver is the only identity. There is no driver picker.

Before the request list, load `GET /api/rides?status=accepted`. A ride in that list goes to `/rides/:id`. While the lookup runs the page says `Loading ride…`. A failure shows the error message and `Retry`, and does not list requests.

List requested rides in the driver's category. The page polls `GET /api/rides?status=requested` immediately and every 3 seconds. A failed poll keeps the previous list and shows the error message. The next successful poll clears that error. A ride that leaves the list is removed. Accept calls `POST /api/rides/{id}/accept` and then goes to `/rides/:id`. Accept has a loading state and an error state. A `409` from a lost accept shows the error message. When that `409` is `invalid_transition`, the ride leaves the list at once. Complete stays on the status page.

## API client

Non-OK responses become typed errors `{ code, message, details }`. Network failures use code `network_error` and a short message. The book page must render that error state rather than staying on the loading label.
