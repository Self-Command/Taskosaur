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
# Run migrations directly via node (prisma bin symlink may be broken)
if [ -f "prisma/schema.prisma" ]; then
  echo "🗃️  Deploying database migrations..."
  if ! node node_modules/prisma/build/index.js migrate deploy; then
    echo "⚠️  Migration deploy failed, auto-resolving and pushing schema..."
    # Mark failed migrations as rolled back
    for row in $(node node_modules/prisma/build/index.js migrate status 2>/dev/null | grep "Failed" | awk '{print $1}'); do
      echo "   Rolling back: $row"
      node node_modules/prisma/build/index.js migrate resolve --rolled-back "$row" 2>/dev/null || true
    done
    # Push schema with data loss acceptance
    node node_modules/prisma/build/index.js db push --accept-data-loss || true
  fi
fi

# Ensure upload directories exist with correct permissions
UPLOAD_DIR="${UPLOAD_DEST:-./uploads}"
echo "📁 Ensuring upload directory exists: $UPLOAD_DIR"
mkdir -p "$UPLOAD_DIR/avatar" "$UPLOAD_DIR/chat" "$UPLOAD_DIR/tasks" 2>/dev/null || true

echo "🎯 Starting production server..."
exec node main.js
