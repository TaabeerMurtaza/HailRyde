#!/bin/sh
set -e
cd /var/www/html

if [ ! -f .env ]; then
    cp .env.example .env
fi

if [ ! -d vendor ]; then
    composer install --no-interaction --prefer-dist
fi

# `php artisan serve` does not forward container environment variables to the
# request worker. Persist the database settings Compose provides so the worker
# reads them from .env.
write_env() {
    key="$1"
    value="$2"
    if [ -z "$value" ]; then
        return
    fi
    if grep -q "^${key}=" .env; then
        sed -i "s|^${key}=.*|${key}=${value}|" .env
    else
        printf '%s=%s\n' "$key" "$value" >> .env
    fi
}

write_env DB_CONNECTION "${DB_CONNECTION:-}"
write_env DB_HOST "${DB_HOST:-}"
write_env DB_PORT "${DB_PORT:-}"
write_env DB_DATABASE "${DB_DATABASE:-}"
write_env DB_USERNAME "${DB_USERNAME:-}"
write_env DB_PASSWORD "${DB_PASSWORD:-}"
write_env APP_NAME "${APP_NAME:-}"
write_env APP_URL "${APP_URL:-}"

if ! grep -q '^APP_KEY=base64:' .env; then
    php artisan key:generate --force --ansi
fi

php artisan migrate --force --ansi

exec "$@"
