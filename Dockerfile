# Dockerfile
# Etapa 1: Construcción
FROM node:18-alpine AS builder

WORKDIR /app

# Instalar dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build


# Etapa 2: Imagen final
FROM node:18-alpine

WORKDIR /app

# Instalar Chromium (requerido por puppeteer)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar app compilada y assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Configurar entorno
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

# Puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/app.js"]