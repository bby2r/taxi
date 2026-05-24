#!/bin/sh
set -e

# Replace port placeholder in nginx config (Render provides PORT env var)
export PORT="${PORT:-80}"
sed -i "s/PORT_PLACEHOLDER/$PORT/g" /etc/nginx/nginx.conf

# Clear stale caches
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Cache for production
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

# Debug: print all client routes
echo "=== REGISTERED ROUTES (client) ==="
php artisan route:list --path=client 2>&1
echo "==================================="

# Reclaim any storage/cache files the boot-time artisan commands above
# created as root, so php-fpm workers (www-data) can append to today's
# laravel-YYYY-MM-DD.log without "Permission denied" — that error was
# escaping WhatsAppCloudApiChannel's logging and surfacing as a 500 on
# /api/v1/auth/send-otp.
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache 2>/dev/null || true

exec "$@"
