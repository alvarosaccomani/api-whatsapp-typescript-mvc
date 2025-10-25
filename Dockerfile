# Dockerfile
# Etapa 1: Construcción
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar solo lo necesario para instalar dependencias
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build


# Etapa 2: Imagen final (liviana)
FROM node:18-alpine

WORKDIR /app

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar la app compilada
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public  # si usas frontend estático

# Instalar Chromium (requerido por puppeteer)
# puppeteer >= v22 requiere estos paquetes en Alpine
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Configurar entorno
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/app.js"]