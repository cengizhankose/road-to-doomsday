# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# Run stage
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm i -g tsx
COPY --from=build /app/dist ./dist
COPY api ./api
COPY src ./src
COPY tsconfig.json tsconfig.api.json ./
COPY server.ts ./
EXPOSE 3000
CMD ["tsx", "server.ts"]
