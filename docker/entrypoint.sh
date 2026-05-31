#!/bin/sh
set -e

echo "🚀 Starting Taskosaur Production Environment..."

# Function to wait for PostgreSQL
wait_for_postgres() {
  echo "⏳ Waiting for PostgreSQL..."
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

  max_attempts=30
  attempt=0
  until nc -z "$DB_HOST" "${DB_PORT:-5432}" 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
      echo "❌ PostgreSQL not ready in time"
      exit 1
    fi
    echo "   Waiting for PostgreSQL... ($attempt/$max_attempts)"
    sleep 2
  done
  echo "✅ PostgreSQL ready"
}

# Function to wait for Redis
wait_for_redis() {
  if [ "${SKIP_REDIS_CHECK:-false}" = "true" ]; then
    echo "⏭️  Skipping Redis check"
    return 0
  fi
  echo "⏳ Waiting for Redis..."
  max_attempts=30
  attempt=0
  until nc -z "${REDIS_HOST:-redis}" "${REDIS_PORT:-6379}" 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
      echo "⚠️  Redis not ready — continuing (Redis is optional)"
      return 0
    fi
    echo "   Waiting for Redis... ($attempt/$max_attempts)"
    sleep 2
  done
  echo "✅ Redis ready"
}

wait_for_postgres
wait_for_redis

# Prisma client already generated during Docker build
# Run migrations using the dist package.json script
if [ -f "prisma/schema.prisma" ]; then
  echo "🗃️  Deploying database migrations..."
  ls node_modules/.bin/prisma 2>/dev/null && echo "(prisma binary found)" || echo "(prisma binary missing)"
  npm run prisma:migrate:deploy || echo "⚠️  Migration deploy skipped"
fi

echo "🎯 Starting production server..."
exec node main.js
