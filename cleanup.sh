#!/bin/bash
set -e

echo "🧹 Ejecutando limpieza previa..."

# Borrar archivos de sesión corruptos o antiguos
find /app/.wwebjs_auth -type f \( -name '*.lock' -o -name '*.tmp' \) -delete

# Limpiar posibles carpetas temporales de Chromium
rm -rf /tmp/* /var/tmp/*

echo "✅ Limpieza completa."