#!/bin/sh
set -e
cd /app

if [ ! -d node_modules/react ]; then
    npm install
fi

exec "$@"
