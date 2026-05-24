# syntax=docker/dockerfile:1.7
# -------- base: node + npm, working dir, non-root user --------
FROM node:22-alpine AS base
WORKDIR /app
RUN addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nestjs -G nodejs
ENV NODE_ENV=production

# -------- build: install ALL deps and compile TS --------
FROM base AS build
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# -------- dev: install ALL deps, mount source for watch mode --------
FROM base AS dev
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# -------- prod-deps: production-only deps cache --------
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# -------- production: minimal runtime --------
FROM base AS production
ENV NODE_ENV=production
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build     --chown=nestjs:nodejs /app/dist          ./dist
COPY --chown=nestjs:nodejs package.json ./
USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
