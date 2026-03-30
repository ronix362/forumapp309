#!/bin/bash

# Script to seed docker db (after docker compose up)
# Handout: This script should call the specific Docker Compose services that 
# import the data into your database (for the prepopulated database).


echo "Starting data import process..."

# 1. Run migrations to ensure the schema exists
docker compose exec -T app npx prisma migrate deploy

# 2. Run your seed scripts inside the 'app' service
echo "Importing team and forum data..."
docker compose exec -T app npx tsx ./scripts/team-seed.ts
docker compose exec -T app npx tsx ./scripts/forum-seed.ts
docker compose exec -T app npx tsx ./scripts/prepopulated_data.ts


echo "Import complete! 🚀"