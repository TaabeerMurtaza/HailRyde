# HailRyde specs

These files are the build contract. Later commits implement them. An interviewer can read this directory to see what was asked for, then compare it with the code.

Read in this order:

1. [00-implementation-guidelines.md](00-implementation-guidelines.md)
2. [01-repository.md](01-repository.md)
3. [02-auth-and-roles.md](02-auth-and-roles.md)
4. [03-data-model.md](03-data-model.md)
5. [04-ride-lifecycle.md](04-ride-lifecycle.md)
6. [05-http-api.md](05-http-api.md)
7. [06-frontend.md](06-frontend.md)
8. [07-testing.md](07-testing.md)

HailRyde lets a rider in Soan Gardens register, set a pickup and destination on the map, choose Economy or Comfort, see a server-priced road fare and pickup ETA, and request a ride. A driver registers, accepts one matching requested ride, and completes it. PostgreSQL row locks make a second accept lose.
