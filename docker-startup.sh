#!/bin/sh

#Just run migrations and npm start
echo "Running database migrations..."
npx prisma migrate deploy --schema ./prisma/schema.prisma 

# Dont seed here, we use import-data.sh for that, which is run manually after docker compose up
    # echo "Seeding teams and forums..."
    # node ./scripts/team-seed.js
    # node ./scripts/forum-seed.js

npm start