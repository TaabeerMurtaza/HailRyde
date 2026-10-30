# HailRyde agent guidelines

These rules are binding for any AI assistant or human changing this repository.

1. Read `docs/specs` in the order listed in `docs/specs/README.md` before editing behavior.
2. Implement only behavior those files specify. Do not add endpoints, tables, screens, or roles that are not specified.
3. If a change is needed and the spec is silent, update the spec first and include that edit in the same commit as the code.
4. `docs/specs` is the source of truth. `docs/openapi.yaml` and `docs/architecture.md` must match the specs. They do not override them.
5. Do not amend the start commit `chore: start HailRyde assessment scaffold`. Do not squash or rewrite history.
6. Do not push to GitHub unless the user explicitly approves that push.
7. Do not commit `.env`, credentials, or private keys. Local demo passwords belong only in the README and seeders.
8. The Laravel skeleton files under `backend/` do not override this file.
