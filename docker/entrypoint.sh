#!/bin/sh
set -e

# Cache configuration for production
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run migrations
php artisan migrate --force

# Create storage link if it doesn't exist
php artisan storage:link 2>/dev/null || true

exec "$@"
