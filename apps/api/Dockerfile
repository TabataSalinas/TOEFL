# ── Build stage ─────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Install root + api deps using the monorepo lockfile context.
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
RUN npm install --workspace @toefl/api --include-workspace-root

COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY apps/api/package.json ./package.json

EXPOSE 4000
# Apply migrations then start. (Migrations are created on first `prisma migrate`.)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
