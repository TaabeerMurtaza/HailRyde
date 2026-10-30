# Implementation guidelines

Follow [AGENTS.md](../../AGENTS.md).

## Commit discipline

- The first commit is the scaffold. Never amend it.
- This spec commit contains `docs/specs/`, `AGENTS.md`, and `.cursor/rules/follow-specs.mdc` only.
- Implementation commits come after this one. Each stays local until the user approves a push.
- Author and committer timestamps are the 6–8 hour record. Read them with `git log --format=fuller`.
- When behavior changes, edit the relevant spec in the same commit as the code.

## AI disclosure

The README must say that Cursor was used, that implementation was instructed to follow `docs/specs`, and which commands were run to check the result. Do not claim a check that was not run.

## Code shape

- HTTP controllers validate input and call one action. Business rules live in `backend/app/Actions`.
- Persistence goes through Eloquent models. Do not hide ride transitions in controllers.
- JSON errors for `/api/*` use `{ "error": { "code", "message", "details" } }`.
- Log ride id and status transitions at info. Do not log passwords, tokens, or raw authorization headers.
- Fare math and place coordinates live in code and `backend/config/rides.php`, not in the client.
