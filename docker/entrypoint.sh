#!/bin/sh
set -e

# Replace port placeholder in nginx config (Render provides PORT env var)
export PORT="${PORT:-80}"
sed -i "s/PORT_PLACEHOLDER/$PORT/g" /etc/nginx/nginx.conf

# Cache configuration for production
php artisan config:cache
php artisan view:cache

# Run migrations
php artisan migrate --force

# Seed database (skips if already seeded)
php artisan db:seed --force 2>/dev/null || true

# Create default admin (skips if already exists)
php artisan make:admin \
    --name="${ADMIN_NAME:-Admin}" \
    --phone="${ADMIN_PHONE:-+996700000000}" \
    --password="${ADMIN_PASSWORD:-admin123}"

# Create storage link if it doesn't exist
php artisan storage:link 2>/dev/null || true

exec "$@"
