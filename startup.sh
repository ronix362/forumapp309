#!/bin/bash

# Install the packages
npm install
npm install --save-dev @types/jsonwebtoken
npm install --save-dev @types/bcrypt
# Generate the Prisma client
npx prisma generate

# Reset the DB
npx prisma migrate reset --force

# Push the schema to local SQLite file
npx prisma migrate dev --name init
npx tsx scripts/team-seed.ts
npx tsx scripts/forum-seed.ts
npx tsx scripts/prepopulated_data.ts