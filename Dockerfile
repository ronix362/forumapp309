# Stage 1: The Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Copy the entire prisma folder to ensure the schema, migrations, and db.js are included
    # prisma/generated is in .dockerignore
COPY prisma ./prisma/ 
# RUN npm install
# Trying Copilot change - npm ci
RUN npm ci --no-audit --no-fund
COPY . .

# Generate the client into your custom @/prisma/generated folder
RUN npx prisma generate
RUN npm run build

# Stage 2: The Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy the built Next.js app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
# Copilot change - below 1 line 
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/public ./public

# Also copy the prisma folder (generated client, schema, migrations, and db.js)
COPY --from=builder /app/prisma ./prisma

# copy docker-startup.sh and make it executable
COPY --from=builder /app/docker-startup.sh ./docker-startup.sh
RUN chmod +x ./docker-startup.sh

# copy seed scripts
COPY --from=builder /app/scripts ./scripts

# copy utils
COPY --from=builder /app/utils ./utils

# Install production dependencies
# RUN npm install --omit=dev
RUN npm ci --omit=dev --no-audit --no-fund

EXPOSE 3000
# Cant call startup script here because it needs to wait for the database to be ready, so we will call it in docker-compose.yaml instead
CMD ["npm", "start"] 