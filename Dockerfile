# Etapa 1: Construcción
FROM node:18-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

COPY . .
RUN npm run build


# Etapa 2: Imagen final
FROM node:18-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias para Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Crear carpeta de sesiones
RUN mkdir -p .wwebjs_auth && chmod -R 777 .wwebjs_auth

# Instalar dependencias de producción
COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force

# Copiar app y scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY cleanup.sh /app/cleanup.sh
COPY entrypoint.sh /app/entrypoint.sh

# Permisos
RUN chmod +x /app/cleanup.sh /app/entrypoint.sh

# Variables de entorno
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production

# Deshabilitar el sandbox (IMPORTANTE para Docker)
ENV CHROME_NO_SANDBOX=true

EXPOSE 3000

CMD ["/app/entrypoint.sh"]