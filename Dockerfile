# Dockerfile
# Etapa 1: Construcción
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar TODAS las dependencias (dev + production) para compilar TypeScript
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build


# Etapa 2: Imagen final (solo producción)
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

# Crear un usuario no-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S whatsapp -u 1001

# Cambiar al usuario no-root
USER whatsapp

# Solo dependencias de producción
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