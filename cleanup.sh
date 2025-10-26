#!/bin/sh
SESSIONS_DIR="/app/.wwebjs_auth"

echo "🧹 Limpiando archivos de bloqueo en $SESSIONS_DIR..."

if [ -d "$SESSIONS_DIR" ]; then
  find "$SESSIONS_DIR" -type f \( -name "SingletonLock" -o -name "SingletonSocket" -o -name "SS" \) -delete
  echo "✅ Archivos de bloqueo eliminados."
else
  echo "⚠️  Directorio de sesiones no encontrado. Se creará al iniciar la primera sesión."
fi