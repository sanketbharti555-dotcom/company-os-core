FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/
RUN npm install --workspace=apps/api --workspace=packages/plugin-sdk
COPY apps/api ./apps/api
COPY packages/plugin-sdk ./packages/plugin-sdk
WORKDIR /app/apps/api
RUN npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app/apps/api
ENV NODE_ENV=production
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./package.json
EXPOSE 4000
CMD ["sh", "-c", "npx prisma db push && npx ts-node prisma/seed.ts || true && node dist/main"]
