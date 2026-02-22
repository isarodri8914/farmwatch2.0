from flask import Flask, render_template, request, jsonify
import os
import pymysql
from datetime import datetime, timezone
from flask_mail import Mail, Message

app = Flask(__name__)

# ────────────────────────────────────────────────
# Configuración de email (Flask-Mail)
# ────────────────────────────────────────────────
app.config.update(
    MAIL_SERVER='smtp.gmail.com',
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USE_SSL=False,
    MAIL_USERNAME=os.environ.get('isarodri8914@gmail.com'),
    MAIL_PASSWORD=os.environ.get('yfvqdjgoprunrype'),
    MAIL_DEFAULT_SENDER=os.environ.get('isarodri8914@gmail.com')
)

mail = Mail(app)

def send_alert_email(alerts):
    """
    Envía un email consolidado con todas las alertas actuales.
    Solo se llama si hay alertas.
    """
    if not alerts:
        return False

    recipient = os.environ.get('ALERT_EMAIL')
    if not recipient:
        app.logger.warning("No hay ALERT_EMAIL configurado → no se envía alerta")
        return False

    subject = "🚨 ALERTAS ACTIVAS - FarmWatch 2.0"

    body = "¡Se detectaron alertas en el sistema!\n\n"
    for alert in alerts:
        body += f"- {alert['cow']}: {alert['text']} ({alert['time']})\n"
    body += "\nRevisa el dashboard inmediatamente:\n"
    body += "https://farmwatch2-0-202793965858.us-central1.run.app/dashboard\n\n"
    body += "FarmWatch 2.0 - Monitoreo de ganado"

    msg = Message(
        subject=subject,
        recipients=[recipient],
        body=body
    )

    try:
        mail.send(msg)
        app.logger.info(f"Email de alerta enviado a {recipient} con {len(alerts)} alertas")
        return True
    except Exception as e:
        app.logger.error(f"Error enviando email de alerta: {str(e)}")
        return False

# ────────────────────────────────────────────────
# Conexión a Cloud SQL
# ────────────────────────────────────────────────
def get_connection():
    return pymysql.connect(
        unix_socket=f"/cloudsql/{os.environ['INSTANCE_CONNECTION_NAME']}",
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.environ["DB_NAME"],
        cursorclass=pymysql.cursors.DictCursor  # Devuelve dicts por default
    )

# ────────────────────────────────────────────────
# APIs - DATOS GENERALES
# ────────────────────────────────────────────────
@app.route("/api/datos")
def api_datos():
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        id_vaca, temp_ambiente, temp_objeto, ritmo_cardiaco, oxigeno,
                        gyro_x, gyro_y, gyro_z, latitud, longitud, fecha
                    FROM sensores
                    ORDER BY fecha DESC
                    LIMIT 100
                """)
                datos = cursor.fetchall()
        return jsonify(datos)
    except Exception as e:
        app.logger.error(f"Error en /api/datos: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/vacas")
def obtener_vacas():
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM vacas ORDER BY id DESC")
                vacas = cursor.fetchall()
        return jsonify(vacas)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/vacas/detectadas")
def vacas_detectadas():
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT DISTINCT id_vaca FROM sensores")
                resultados = cursor.fetchall()
        return jsonify(resultados)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ────────────────────────────────────────────────
# Gestión de vacas (CRUD básico)
# ────────────────────────────────────────────────
@app.route("/api/vacas", methods=["POST"])
def guardar_vaca():
    data = request.get_json()
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                if data.get("id"):  # editar
                    sql = """
                        UPDATE vacas SET
                        id_esp32=%s, nombre=%s, raza=%s, edad=%s, peso=%s, notas=%s
                        WHERE id=%s
                    """
                    params = (
                        data["id_esp32"], data["nombre"], data["raza"],
                        data["edad"], data["peso"], data["notas"], data["id"]
                    )
                else:  # nueva
                    sql = """
                        INSERT INTO vacas (id_esp32, nombre, raza, edad, peso, notas)
                        VALUES (%s,%s,%s,%s,%s,%s)
                    """
                    params = (
                        data["id_esp32"], data["nombre"], data["raza"],
                        data["edad"], data["peso"], data["notas"]
                    )
                cursor.execute(sql, params)
            conn.commit()
        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/vacas/<int:id>", methods=["DELETE"])
def eliminar_vaca(id):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("DELETE FROM vacas WHERE id=%s", (id,))
            conn.commit()
        return jsonify({"status": "deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/vacas/<id_esp32>/historial")
def historial_vaca(id_esp32):
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        temp_ambiente, temp_objeto, ritmo_cardiaco, oxigeno,
                        gyro_x, gyro_y, gyro_z, latitud, longitud, fecha
                    FROM sensores
                    WHERE id_vaca=%s
                    ORDER BY fecha DESC
                    LIMIT 1
                """, (id_esp32,))
                dato = cursor.fetchone()
        return jsonify(dato or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ────────────────────────────────────────────────
# Recepción de datos desde ESP32
# ────────────────────────────────────────────────
@app.route("/api/sensores", methods=["POST"])
def recibir_datos():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON recibido"}), 400

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                sql = """
                INSERT INTO sensores (
                    id_vaca, temp_ambiente, temp_objeto, ritmo_cardiaco, oxigeno,
                    gyro_x, gyro_y, gyro_z, latitud, longitud, satelites
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """
                cursor.execute(sql, (
                    data.get("id_vaca"),
                    data.get("temp_ambiente"),
                    data.get("temp_objeto"),
                    data.get("ritmo_cardiaco"),
                    data.get("oxigeno"),
                    data.get("gyro_x"),
                    data.get("gyro_y"),
                    data.get("gyro_z"),
                    data.get("latitud"),
                    data.get("longitud"),
                    data.get("satelites")
                ))
            conn.commit()
        return jsonify({"status": "ok"}), 200
    except Exception as e:
        app.logger.error(f"Error recibiendo datos ESP32: {e}")
        return jsonify({"error": str(e)}), 500

# ────────────────────────────────────────────────
# Otras APIs auxiliares
# ────────────────────────────────────────────────
@app.route("/api/sensores/ultimos")
def ultimos_datos():
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        id_vaca, temp_ambiente, temp_objeto, ritmo_cardiaco, oxigeno,
                        gyro_x, gyro_y, gyro_z, latitud, longitud, fecha
                    FROM sensores
                    ORDER BY fecha DESC
                    LIMIT 5
                """)
                datos = cursor.fetchall()
        return jsonify(datos)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/estado-sistema")
def estado_sistema():
    estado = {"sql_conectado": False, "sensores": [], "vacas": []}
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                estado["sql_conectado"] = True
                cursor.execute("SELECT * FROM sensores ORDER BY fecha DESC LIMIT 1")
                dato = cursor.fetchone()

                if not dato:
                    return jsonify(estado)

                # Evaluación de sensores (igual que antes)
                if dato["ritmo_cardiaco"] == 0:
                    estado["sensores"].append({"id": "MAX30100", "estado": "sin señal"})
                else:
                    estado["sensores"].append({"id": "MAX30100", "estado": "activo"})

                if dato["temp_objeto"] == 0 and dato["temp_ambiente"] == 0:
                    estado["sensores"].append({"id": "MLX90614", "estado": "sin señal"})
                else:
                    estado["sensores"].append({"id": "MLX90614", "estado": "activo"})

                if dato["gyro_x"] == 0 and dato["gyro_y"] == 0 and dato["gyro_z"] == 0:
                    estado["sensores"].append({"id": "MPU6050", "estado": "sin señal"})
                else:
                    estado["sensores"].append({"id": "MPU6050", "estado": "activo"})

                if dato["latitud"] == 0 and dato["longitud"] == 0:
                    estado["sensores"].append({"id": "GPS", "estado": "sin señal"})
                else:
                    estado["sensores"].append({"id": "GPS", "estado": "activo"})

                vaca_estado = {
                    "id": dato["id_vaca"],
                    "temperatura": dato["temp_objeto"],
                    "ritmo": dato["ritmo_cardiaco"]
                }
                estado["vacas"].append(vaca_estado)
    except Exception as e:
        app.logger.error(f"Error en estado-sistema: {e}")

    return jsonify(estado)

# ────────────────────────────────────────────────
# DASHBOARD - con envío de email si hay alertas
# ────────────────────────────────────────────────
@app.route("/api/dashboard")
def dashboard_data():
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT s.*
                    FROM sensores s
                    INNER JOIN (
                        SELECT id_vaca, MAX(fecha) as max_fecha
                        FROM sensores
                        GROUP BY id_vaca
                    ) grouped
                    ON s.id_vaca = grouped.id_vaca 
                    AND s.fecha = grouped.max_fecha
                """)
                datos = cursor.fetchall()

        cows = []
        alerts = []
        now = datetime.now(timezone.utc)
        OFFLINE_TIMEOUT = 30  # segundos

        for d in datos:
            estado = "ok"

            # Offline por tiempo
            if d["fecha"] and (now - d["fecha"]).total_seconds() > OFFLINE_TIMEOUT:
                estado = "offline"

            # Alertas biométricas
            if d["temp_objeto"] and d["temp_objeto"] > 39.5:
                estado = "alert"
                alerts.append({
                    "cow": f"Vaca {d['id_vaca']}",
                    "text": f"Temperatura alta {d['temp_objeto']}°C",
                    "time": "Ahora"
                })

            if d["ritmo_cardiaco"] and d["ritmo_cardiaco"] > 95:
                estado = "alert"
                alerts.append({
                    "cow": f"Vaca {d['id_vaca']}",
                    "text": f"Ritmo alto {d['ritmo_cardiaco']} bpm",
                    "time": "Ahora"
                })

            # Sensores desconectados → offline
            if d["ritmo_cardiaco"] == 0 and d["oxigeno"] == 0:
                estado = "offline"
            if d["gyro_x"] == 0 and d["gyro_y"] == 0 and d["gyro_z"] == 0:
                estado = "offline"
            if d["latitud"] == 0 and d["longitud"] == 0:
                estado = "offline"

            cows.append({
                "id": d["id_vaca"],
                "name": f"Vaca {d['id_vaca']}",
                "lat": d["latitud"] or 19.4325,
                "lng": d["longitud"] or -99.1332,
                "temp": d["temp_objeto"],
                "hr": d["ritmo_cardiaco"],
                "status": estado
            })

        # ─── Enviar email SOLO si hay alertas ───
        if alerts:
            send_alert_email(alerts)

        return jsonify({
            "cows": cows,
            "alerts": alerts,
            "last_update": now.strftime("%H:%M:%S")
        })

    except Exception as e:
        app.logger.error(f"Error en dashboard_data: {e}")
        return jsonify({"error": str(e)}), 500

# ────────────────────────────────────────────────
# Rutas web (HTML)
# ────────────────────────────────────────────────
@app.route('/')
def login():
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/cows')
def cows():
    return render_template('cows.html')

@app.route('/alerts')
def alerts():
    return render_template('alerts.html')

@app.route('/map')
def map_view():
    return render_template('map.html')

@app.route('/data')
def data():
    return render_template('data.html')

@app.route('/sensors')
def sensors():
    return render_template('sensors.html')

@app.route('/register')
def register():
    return render_template('register.html')

@app.route('/registro', methods=['POST'])
def registro():
    return render_template('registro_exitoso.html')

# ────────────────────────────────────────────────
# Ejecución
# ────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8080, debug=True)