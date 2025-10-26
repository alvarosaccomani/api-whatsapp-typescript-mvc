# Etapa 1: Construcción
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar dependencias y compilar
COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build


# Etapa 2: Imagen final (producción)
FROM node:18-alpine

WORKDIR /app

# Instalar Chromium y todas las dependencias críticas
# Incluye bibliotecas de fuentes, renderizado y SSL
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

# Crear carpeta de sesiones y dar permisos totales
RUN mkdir -p .wwebjs_auth && chmod -R 777 .wwebjs_auth

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar app compilada y assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Configurar entorno
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/app.js"]