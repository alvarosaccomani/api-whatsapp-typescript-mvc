# Etapa 1: Construcción
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build


# Etapa 2: Imagen final
FROM node:18-alpine

WORKDIR /app

# Instalar Chromium y dependencias
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    fontconfig \
    libpng \
    zlib-dev

# Crear carpeta de sesiones
RUN mkdir -p .wwebjs_auth && chmod -R 777 .wwebjs_auth

# Instalar dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar app y scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY cleanup.sh /app/cleanup.sh
COPY entrypoint.sh /app/entrypoint.sh

# Permisos
RUN chmod +x /app/cleanup.sh /app/entrypoint.sh

# Entorno
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

EXPOSE 3000

CMD ["/app/entrypoint.sh"]