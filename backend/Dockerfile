# syntax=docker/dockerfile:1

# ---- deps: install production dependencies in isolation ----
FROM node:22-alpine AS deps
WORKDIR /app
# Copy only manifests first so this layer is cached unless deps change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runner: minimal final image with just deps + source ----
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Bring in the pruned node_modules from the deps stage and the app source.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY index.js ./
COPY src ./src

# Run as the built-in unprivileged user.
USER node

EXPOSE 3000

# Container-level health check hitting the /health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "index.js"]
