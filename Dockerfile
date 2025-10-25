# Etapa 1: Construcción
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar dependencias y compilar
COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build


# Etapa 2: Imagen final (producción)
FROM node:18-alpine

WORKDIR /app

# Instalar Chromium y dependencias críticas
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Crear directorios temporales con permisos
RUN mkdir -p /tmp/chromium-user-data /tmp/chromium-cache .wwebjs_auth && \
    chmod -R 777 /tmp/chromium-user-data /tmp/chromium-cache .wwebjs_auth

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar app compilada
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Configurar entorno
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/app.js"]