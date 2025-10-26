# =============================
# Etapa 1: Construcción
# =============================
FROM node:18-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

COPY . .
RUN npm run build


# =============================
# Etapa 2: Imagen final
# =============================
FROM node:18-slim

WORKDIR /app

# Instalar Chromium y dependencias necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium-browser \
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
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Crear carpeta de sesiones local (sin volumen)
RUN mkdir -p /app/.wwebjs_auth && chmod -R 777 /app/.wwebjs_auth

# Instalar dependencias de producción
COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force

# Copiar archivos compilados y scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY cleanup.sh /app/cleanup.sh
COPY entrypoint.sh /app/entrypoint.sh

# Permisos de ejecución
RUN chmod +x /app/cleanup.sh /app/entrypoint.sh

# Variables de entorno para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production

# Flags para Puppeteer (evita errores comunes)
ENV PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --no-zygote --single-process --disable-extensions"

# Exponer el puerto de la API
EXPOSE 3000

# Iniciar con dumb-init (mejor manejo de señales)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Ejecutar script de inicio
CMD ["/app/entrypoint.sh"]