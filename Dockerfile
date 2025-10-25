# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build


FROM node:18-alpine

WORKDIR /app

# Instalar Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Instalar dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Crear carpeta de sesiones (asegurar permisos)
RUN mkdir -p .wwebjs_auth && chmod -R 777 .wwebjs_auth

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/app.js"]