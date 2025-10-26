#!/bin/sh
set -e

echo "🚀 Iniciando limpieza de sesiones..."
/app/cleanup.sh

echo "✅ Iniciando aplicación..."
exec node dist/app.js