"""
wazuh_client.py
================
Consulta el Wazuh Indexer (OpenSearch) para obtener datos REALES que
alimentan el Dashboard Ejecutivo SOC: alertas por categoría de activo,
cobertura MITRE ATT&CK y conteo de alertas críticas.

Requiere estas variables de entorno (mismo patrón que usa tu app.py
para la base de datos):

    WAZUH_INDEXER_URL       ej. https://10.0.0.5:9200
    WAZUH_INDEXER_USER      usuario con permisos de lectura sobre wazuh-alerts-*
    WAZUH_INDEXER_PASSWORD
    WAZUH_ALERTS_INDEX      opcional, por defecto "wazuh-alerts-*"

IMPORTANTE DE SEGURIDAD:
- Estas credenciales viven SOLO en el servidor (variables de entorno),
  nunca en el HTML/JS del dashboard, igual que ya haces con DB_USER/DB_PASSWORD.
- `verify=False` de abajo acepta certificados autofirmados (típico en Wazuh
  recién instalado). En producción, cambia esto por la ruta a tu CA:
  verify="/ruta/a/tu/ca.pem"
"""

import os
import requests
from datetime import datetime, timedelta, timezone

WAZUH_INDEXER_URL = os.environ.get("WAZUH_INDEXER_URL", "https://localhost:9200")
WAZUH_INDEXER_USER = os.environ.get("admin")
WAZUH_INDEXER_PASSWORD = os.environ.get("?67OUiy5.bTNoZMdmgizELrr*V.T?vsU")
WAZUH_ALERTS_INDEX = os.environ.get("WAZUH_ALERTS_INDEX", "wazuh-alerts-*")

# ---------------------------------------------------------------------------
# AJUSTA ESTE MAPEO a los nombres reales de tus agentes en Wazuh.
# Es lo que traduce "qué agente mandó la alerta" a "categoría de negocio"
# que usa el dashboard (Cloud, IoT, Web/API, Docker, Active Directory...).
# Puedes ver los nombres exactos en Wazuh Dashboard > Agents.
# ---------------------------------------------------------------------------
AGENTE_A_CATEGORIA = {
    "cloud-run-farmwatch": "Cloud",
    "cloudsql-farmwatch": "Base de datos",
    "raspberrypi-iot": "IoT",
    "docker-host": "Docker",
    "windows-server-ad": "Active Directory",
    "compute-engine-wazuh": "Cloud",
    # agrega aquí el resto de tus agentes reales...
}
CATEGORIA_DEFAULT = "Otros / sin clasificar"


def _rango_fechas(dias):
    fin = datetime.now(timezone.utc)
    inicio = fin - timedelta(days=dias)
    return inicio.strftime("%Y-%m-%dT%H:%M:%S"), fin.strftime("%Y-%m-%dT%H:%M:%S")


def _query(body):
    if not WAZUH_INDEXER_USER or not WAZUH_INDEXER_PASSWORD:
        raise RuntimeError("Faltan WAZUH_INDEXER_USER / WAZUH_INDEXER_PASSWORD en el entorno")

    resp = requests.post(
        f"{WAZUH_INDEXER_URL}/{WAZUH_ALERTS_INDEX}/_search",
        json=body,
        auth=(WAZUH_INDEXER_USER, WAZUH_INDEXER_PASSWORD),
        verify=False,  # ver nota de seguridad arriba
        timeout=15
    )
    resp.raise_for_status()
    return resp.json()


def total_alertas(dias=90):
    inicio, fin = _rango_fechas(dias)
    body = {
        "size": 0,
        "query": {"range": {"timestamp": {"gte": inicio, "lte": fin}}}
    }
    data = _query(body)
    return data["hits"]["total"]["value"]


def alertas_por_categoria(dias=90):
    """Cuenta alertas agrupadas por agente y las traduce a categoría de negocio."""
    inicio, fin = _rango_fechas(dias)
    body = {
        "size": 0,
        "query": {"range": {"timestamp": {"gte": inicio, "lte": fin}}},
        "aggs": {
            "por_agente": {"terms": {"field": "agent.name", "size": 100}}
        }
    }
    data = _query(body)
    buckets = data.get("aggregations", {}).get("por_agente", {}).get("buckets", [])

    conteo = {}
    for b in buckets:
        categoria = AGENTE_A_CATEGORIA.get(b["key"], CATEGORIA_DEFAULT)
        conteo[categoria] = conteo.get(categoria, 0) + b["doc_count"]

    return conteo  # ej. {"IoT": 42, "Cloud": 31, ...}


def cobertura_mitre(dias=90, top=20):
    """Técnicas MITRE que realmente dispararon alertas (rule.mitre.id)."""
    inicio, fin = _rango_fechas(dias)
    body = {
        "size": 0,
        "query": {"range": {"timestamp": {"gte": inicio, "lte": fin}}},
        "aggs": {
            "por_tecnica": {"terms": {"field": "rule.mitre.id", "size": top}}
        }
    }
    data = _query(body)
    buckets = data.get("aggregations", {}).get("por_tecnica", {}).get("buckets", [])
    return [{"tecnica": b["key"], "alertas": b["doc_count"]} for b in buckets]


def alertas_criticas(dias=90, nivel_minimo=12):
    """Cuenta alertas con rule.level >= nivel_minimo (por defecto, alto/crítico en Wazuh)."""
    inicio, fin = _rango_fechas(dias)
    body = {
        "size": 0,
        "query": {
            "bool": {
                "filter": [
                    {"range": {"timestamp": {"gte": inicio, "lte": fin}}},
                    {"range": {"rule.level": {"gte": nivel_minimo}}}
                ]
            }
        }
    }
    data = _query(body)
    return data["hits"]["total"]["value"]


def obtener_resumen_wazuh(dias=90):
    """Punto de entrada único: junta todo lo anterior en un solo dict."""
    return {
        "total_alertas": total_alertas(dias),
        "por_categoria": alertas_por_categoria(dias),
        "por_tecnica": cobertura_mitre(dias),
        "criticas": alertas_criticas(dias)
    }