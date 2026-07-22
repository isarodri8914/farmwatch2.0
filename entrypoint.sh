#!/bin/sh
set -e

# TS_AUTHKEY llega como variable de entorno / secreto de Cloud Run —
# nunca está escrito aquí ni en el Dockerfile.
if [ -z "$TS_AUTHKEY" ]; then
  echo "ERROR: falta la variable de entorno TS_AUTHKEY (llave de Tailscale)."
  exit 1
fi

# Arranca tailscaled en modo "userspace networking": no necesita crear
# una interfaz de red real (Cloud Run no lo permite), en vez de eso expone
# un proxy SOCKS5 local en el puerto 1055 que sí puede usar cualquier
# proceso normal, incluyendo requests de Python.
tailscaled --state=mem: --socket=/tmp/tailscaled.sock --tun=userspace-networking &

# Espera a que el socket de control esté listo antes de pedirle que se conecte
for i in $(seq 1 20); do
  if tailscale --socket=/tmp/tailscaled.sock status >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

tailscale --socket=/tmp/tailscaled.sock up \
  --authkey="${TS_AUTHKEY}" \
  --hostname="farmwatch-cloudrun" \
  --accept-routes

echo "Tailscale conectado. IP asignada:"
tailscale --socket=/tmp/tailscaled.sock ip

# Arranca la app real. El "exec" es importante: reemplaza este proceso
# con gunicorn, para que Cloud Run pueda mandarle señales de apagado
# correctamente (si no, gunicorn queda como "hijo" y Cloud Run no
# sabría a quién avisarle para terminar limpio).
exec gunicorn --bind 0.0.0.0:8080 --workers 2 --timeout 60 --preload app:app