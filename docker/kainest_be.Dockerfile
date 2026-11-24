FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies required for Prisma and native extensions 
RUN apk add --no-cache openssl tzdata

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy source code
COPY . .

# Generate Prisma Client, Build TypeScript, and prune devDependencies
RUN npm run postinstall
RUN npm run build
RUN npm prune --omit=dev --legacy-peer-deps

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl tzdata

# Set environment to production and timezone
ENV NODE_ENV=production
ENV TZ="Asia/Jakarta"

# Copy built artifacts from builder
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/doc ./doc

# Ensure writable data & log directories owned by non-root user
RUN mkdir -p /app/logs /app/data/academic && chown -R node:node /app/logs /app/data

# Drop root privileges
USER node

# Expose port (default Hono is usually 3000, but we map in docker-compose)
EXPOSE 3001

# Start the application
CMD ["node", "dist/server.js"]
