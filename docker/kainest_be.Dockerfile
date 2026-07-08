FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies required for Prisma and native extensions 
RUN apk add --no-cache openssl

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client and Build TypeScript
RUN npm run postinstall
RUN npm run build

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

# Set environment to production
ENV NODE_ENV=production

# Copy built artifacts from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose port (default Hono is usually 3000, but we map in docker-compose)
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
