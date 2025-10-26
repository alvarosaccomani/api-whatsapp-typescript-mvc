#!/bin/bash
set -e

echo "🧹 Limpiando bloqueos previos de Chromium..."
rm -rf /app/.wwebjs_auth/SingletonLock || true
rm -rf /app/.wwebjs_auth/SingletonCookie || true
rm -rf /app/.wwebjs_auth/CrashpadMetrics-active.pma || true

echo "🚀 Iniciando API de WhatsApp..."
# Asegurar permisos correctos por si Docker los resetea
chmod -R 777 /app/.wwebjs_auth || true

# Esperar un poco antes de iniciar (útil si hay base de datos u otra dependencia)
sleep 2

# Ejecutar la app
exec node dist/app.js