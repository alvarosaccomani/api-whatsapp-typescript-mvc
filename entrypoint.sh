#!/bin/bash
set -e

echo "🚀 Iniciando API WhatsApp..."

# Asegurar que la carpeta de sesiones exista
mkdir -p /app/.wwebjs_auth
chmod -R 777 /app/.wwebjs_auth

# Limpiar bloqueos anteriores (por si quedó mal cerrada la sesión)
if [ -f /app/.wwebjs_auth/SingletonLock ]; then
    echo "🔧 Eliminando archivo de bloqueo previo..."
    rm -f /app/.wwebjs_auth/SingletonLock
fi

# Ejecutar limpieza adicional si existe
if [ -f /app/cleanup.sh ]; then
    /app/cleanup.sh
fi

# Ejecutar la API
echo "✅ Ejecutando aplicación Node..."
exec node dist/app.js