FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# --preload: gunicorn importa app.py UNA vez en el proceso maestro, antes
# de bootear workers. Si algo como el "import requests" faltante vuelve a
# pasar, el contenedor falla inmediatamente con un traceback claro en los
# logs, en vez de repetir el ciclo de "Booting worker -> WORKER TIMEOUT"
# que acabamos de diagnosticar a ciegas.
#
# --workers 2: explícito en vez de dejarlo en el default silencioso.
# --timeout 60: un poco más de margen que los 30s por defecto, útil
# mientras las consultas a Cloud SQL o a Wazuh todavía no están optimizadas.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "60", "--preload", "app:app"]