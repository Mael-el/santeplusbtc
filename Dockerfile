FROM node:22-bookworm-slim

WORKDIR /app

# Copy configuration files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# Install all dependencies (dev + prod needed for build)
RUN npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000

# Copy source code and assets
COPY src ./src
COPY public ./public
COPY index.html ./
COPY backend ./backend
COPY server.ts ./

# Compile both Frontend SPA (Vite) and Backend Server bundle (esbuild)
RUN npm run build

# Expose API port
EXPOSE 3000

# Start unified server
CMD ["npm", "start"]
