from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask import Flask, render_template, request, jsonify
import os
import pymysql
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import math

import math

def distancia(lat1, lon1, lat2, lon2):

    R = 6371

    dlat = math.radians(lat2-lat1)
    dlon = math.radians(lon2-lon1)

    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2

    c = 2*math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R*c

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "una_clave_muy_segura_123") # Cambia esto en producción
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,  # Cloud Run usa HTTPS
    SESSION_COOKIE_SAMESITE="Lax"
)



def get_connection():
    return pymysql.connect(
        unix_socket=f"/cloudsql/{os.environ['INSTANCE_CONNECTION_NAME']}",
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.environ["DB_NAME"]
    )

#PROTECCION PARA REQUERIR LOGIN EN TOD MOMENTO TANTO PARA URLS COMO PARA APIS
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

    
    #API PARA DATOS 

@app.route("/api/datos")
@login_required
def api_datos():
    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT 
                id_vaca,
                temp_ambiente,
                temp_objeto,
                ritmo_cardiaco,
                oxigeno,
                gyro_x,
                gyro_y,
                gyro_z,
                latitud,
                longitud,
                fecha
            FROM sensores
            ORDER BY fecha DESC
            LIMIT 100
        """)

        datos = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(datos)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    #API PARA COWS.HTML
@app.route("/api/vacas")
@login_required
def obtener_vacas():
    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        cursor.execute("SELECT * FROM vacas ORDER BY id DESC")
        vacas = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(vacas)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    #DETECTAR VACAS
    
@app.route("/api/vacas/detectadas")
@login_required
def vacas_detectadas():
    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)


        cursor.execute("SELECT DISTINCT id_vaca FROM sensores")
        resultados = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(resultados)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    
    #CREAR O EDITAR VACAS EN COWS.HTML

@app.route("/api/vacas", methods=["POST"])
@login_required
def guardar_vaca():
    data = request.get_json()

    try:
        conn = get_connection()
        cursor = conn.cursor()

        if data.get("id"):  # editar
            sql = """
                UPDATE vacas SET
                id_esp32=%s,
                nombre=%s,
                raza=%s,
                edad=%s,
                peso=%s,
                notas=%s
                WHERE id=%s
            """
            cursor.execute(sql, (
                data["id_esp32"],
                data["nombre"],
                data["raza"],
                data["edad"],
                data["peso"],
                data["notas"],
                data["id"]
            ))

        else:  # nueva
            sql = """
                INSERT INTO vacas
                (id_esp32, nombre, raza, edad, peso, notas)
                VALUES (%s,%s,%s,%s,%s,%s)
            """
            cursor.execute(sql, (
                data["id_esp32"],
                data["nombre"],
                data["raza"],
                data["edad"],
                data["peso"],
                data["notas"]
            ))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"status": "ok"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

#ELIMINAR VACA EN COWS.HTML

@app.route("/api/vacas/<int:id>", methods=["DELETE"])
@login_required
def eliminar_vaca(id):
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM vacas WHERE id=%s", (id,))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify({"status": "deleted"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

#VERIFICAR HISTORIAL EN COWS.HTML
@app.route("/api/vacas/<id_esp32>/historial")
@login_required
def historial_vaca(id_esp32):
    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("""
            SELECT 
                temp_ambiente,
                temp_objeto,
                ritmo_cardiaco,
                oxigeno,
                gyro_x,
                gyro_y,
                gyro_z,
                latitud,
                longitud,
                fecha
            FROM sensores
            WHERE id_vaca=%s
            ORDER BY fecha DESC
            LIMIT 1
        """, (id_esp32,))

        dato = cursor.fetchone()

        cursor.close()
        conn.close()

        return jsonify(dato)

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# ---------- API ESP32 ----------
@app.route("/api/sensores", methods=["POST"])
def recibir_datos():
    
    data = request.get_json()

    if not data:
        return jsonify({"error": "No JSON recibido"}), 400

    try:
        conn = get_connection()
        cursor = conn.cursor()

        sql = """
        INSERT INTO sensores (
            id_vaca, temp_ambiente, temp_objeto,
            ritmo_cardiaco, oxigeno,
            gyro_x, gyro_y, gyro_z,
            latitud, longitud, satelites
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
        cursor.close()
        conn.close()

        return jsonify({"status": "ok"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# API: OBTENER ÚLTIMA LECTURA DE SENSORES
# =========================================

@app.route("/api/sensores/ultimos")
def ultimos_datos():
    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT 
                id_vaca,
                temp_ambiente,
                temp_objeto,
                ritmo_cardiaco,
                oxigeno,
                gyro_x,
                gyro_y,
                gyro_z,
                latitud,
                longitud,
                fecha
            FROM sensores
            ORDER BY fecha DESC
            LIMIT 5
        """)

        datos = cursor.fetchall()

        cursor.close()
        conn.close()

        return jsonify(datos)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    

#ESTADO DEL SISTEMA ALERTAS

@app.route("/api/estado-sistema")
@login_required
def estado_sistema():

    estado = {
        "sql_conectado": False,
        "sensores": [],
        "vacas": []
    }

    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        estado["sql_conectado"] = True

        cursor.execute("""
            SELECT *
            FROM sensores
            ORDER BY fecha DESC
            LIMIT 1
        """)

        dato = cursor.fetchone()

        if not dato:
            conn.close()
            return jsonify(estado)

        from datetime import datetime

        OFFLINE_TIMEOUT = 60  # segundos sin datos para considerar offline
        ahora = datetime.now()

        # 🔴 1️⃣ VERIFICAR SI EL ESP32 ESTÁ OFFLINE
        if dato["fecha"] and (ahora - dato["fecha"]).total_seconds() > OFFLINE_TIMEOUT:
            estado["sensores"].append({
                "id": "ESP32",
                "estado": "offline"
            })

            conn.close()
            return jsonify(estado)

        # 🟢 2️⃣ SI EL ESP32 ESTÁ ONLINE, EVALUAR SENSORES

        # MAX30100
        if dato["ritmo_cardiaco"] == 0:
            estado["sensores"].append({"id": "MAX30100", "estado": "sin señal"})
        else:
            estado["sensores"].append({"id": "MAX30100", "estado": "activo"})

        # MLX90614
        if dato["temp_objeto"] == 0 and dato["temp_ambiente"] == 0:
            estado["sensores"].append({"id": "MLX90614", "estado": "sin señal"})
        else:
            estado["sensores"].append({"id": "MLX90614", "estado": "activo"})

        # MPU6050
        if dato["gyro_x"] == 0 and dato["gyro_y"] == 0 and dato["gyro_z"] == 0:
            estado["sensores"].append({"id": "MPU6050", "estado": "sin señal"})
        else:
            estado["sensores"].append({"id": "MPU6050", "estado": "activo"})

        # GPS
        if dato["latitud"] == 0 and dato["longitud"] == 0:
            estado["sensores"].append({"id": "GPS", "estado": "sin señal"})
        else:
            estado["sensores"].append({"id": "GPS", "estado": "activo"})

        # 🐄 Estado vaca
        estado["vacas"].append({
            "id": dato["id_vaca"],
            "temperatura": dato["temp_objeto"],
            "ritmo": dato["ritmo_cardiaco"]
        })

        conn.close()

    except Exception as e:
        print("Error SQL:", e)

    return jsonify(estado)


# =========================================
# API DASHBOARD PRINCIPAL (TIEMPO REAL)
# =========================================

@app.route("/api/dashboard")
@login_required
def dashboard_data():
    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # 1. Cargar umbrales desde BD (fallback si no existen)
        umbrales = {"temp_max": 39.5, "hr_max": 95}
        cursor.execute("SELECT clave, valor FROM configuracion")
        for row in cursor.fetchall():
            if row['clave'] == 'temp_max':
                umbrales['temp_max'] = float(row['valor'])
            if row['clave'] == 'hr_max':
                umbrales['hr_max'] = float(row['valor'])

        # 2. Obtener última lectura de cada vaca
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

# Antes del for
        cursor.execute("SELECT NOW() as ahora")
        row_now = cursor.fetchone()
        now = row_now["ahora"]


        OFFLINE_TIMEOUT = 30  # segundos

        for d in datos:
            estado = "ok"

            # DETECTAR OFFLINE
            if d["fecha"] and (now - d["fecha"]).total_seconds() > OFFLINE_TIMEOUT:
                estado = "offline"

            # ALERTAS BIOMÉTRICAS (usando umbrales dinámicos)
            if d["temp_objeto"] and d["temp_objeto"] > umbrales["temp_max"]:
                estado = "alert"
                alerts.append({
                    "cow": f"Vaca {d['id_vaca']}",
                    "text": f"Temperatura alta {d['temp_objeto']}°C (máx: {umbrales['temp_max']}°C)",
                    "time": "Ahora"
                })

            if d["ritmo_cardiaco"] and d["ritmo_cardiaco"] > umbrales["hr_max"]:
                estado = "alert"
                alerts.append({
                    "cow": f"Vaca {d['id_vaca']}",
                    "text": f"Ritmo alto {d['ritmo_cardiaco']} bpm (máx: {umbrales['hr_max']} bpm)",
                    "time": "Ahora"
                })

            # SENSOR DESCONECTADO
            if d["ritmo_cardiaco"] == 0 and d["oxigeno"] == 0:
                estado = "offline"

            if d["gyro_x"] == 0 and d["gyro_y"] == 0 and d["gyro_z"] == 0:
                estado = "offline"

            if d["latitud"] == 0 and d["longitud"] == 0:
                estado = "offline"

            cows.append({
                "id": d["id_vaca"],
                "name": f"Vaca {d['id_vaca']}",
                "lat": d["latitud"] or 20.97,  # Mérida por default
                "lng": d["longitud"] or -89.62,
                "temp": d["temp_objeto"],
                "hr": d["ritmo_cardiaco"],
                "status": estado
            })

        # =========================================
        # OBTENER ÚLTIMA FECHA GLOBAL DESDE MYSQL
        # =========================================
        cursor.execute("SELECT MAX(fecha) as ultima FROM sensores")
        row = cursor.fetchone()

        last_sync = "--:--:--"
        if row and row["ultima"]:
            last_sync = row["ultima"].strftime("%H:%M:%S")

        cursor.close()
        conn.close()

        return jsonify({
            "cows": cows,
            "alerts": alerts,
            "last_update": datetime.now().strftime("%H:%M:%S"),
            "last_sync": last_sync
        })

    except Exception as e:
        print("Error en /api/dashboard:", str(e))  # Para depurar en terminal
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/vaca/<id>")
def get_vaca(id):
    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT temp_objeto as temperatura, ritmo_cardiaco as ritmo, 
                   latitud, longitud, fecha, status
            FROM sensores WHERE id_vaca = %s
            ORDER BY fecha DESC LIMIT 1
        """, (id,))
        data = cursor.fetchone()
        cursor.close()
        conn.close()
        return jsonify(data or {})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#REGISTRO APRUEBA DE XXS
@app.route('/api/registrar', methods=['POST'])
def api_registrar():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No se recibió JSON"}), 400

        print("DEBUG: Datos recibidos →", data)  # ← muy importante

        nombre   = data.get('nombre', '').strip()
        correo   = data.get('correo', '').strip().lower()
        password = data.get('password', '')
        
        import re

# Bloquear etiquetas HTML (previene XSS)
        if re.search(r"<.*?>", nombre):
         return jsonify({"error": "Nombre inválido"}), 400

        if re.search(r"<.*?>", correo):
         return jsonify({"error": "Correo inválido"}), 400

        if not all([nombre, correo, password]):
            return jsonify({"error": "Faltan campos obligatorios"}), 400

        if len(password) < 6:
            return jsonify({"error": "La contraseña debe tener al menos 6 caracteres"}), 400

        hashed_pw = generate_password_hash(password)

        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO usuarios (nombre, correo, password) VALUES (%s, %s, %s)",
                    (nombre, correo, hashed_pw)
                )
            conn.commit()

        print("DEBUG: Usuario creado correctamente →", correo)
        return jsonify({"status": "ok", "message": "Registro exitoso"}), 201

    except pymysql.err.IntegrityError as e:
        if e.args[0] == 1062:  # Duplicate entry
            return jsonify({"error": "Este correo ya está registrado"}), 409
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print("ERROR EN REGISTRO:", type(e).__name__, str(e))
        return jsonify({"error": "Error interno del servidor"}), 500

#LOGIN APRUEBA DE INYECCIONES SQL
@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    correo = data.get('correo')
    password = data.get('password')

    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT * FROM usuarios WHERE correo = %s", (correo,))
        user = cursor.fetchone()

        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['user_name'] = user['nombre']
            return jsonify({"status": "ok", "redirect": "/dashboard"})

        return jsonify({"error": "Correo o contraseña incorrectos"}), 401

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ---------- RUTAS ----------

@app.route('/')
def login():
    return render_template('login.html')

@app.route('/dashboard')

def dashboard():
    # Esta es la pared de seguridad
    if 'user_id' not in session:
        return redirect(url_for('login')) # Si no hay sesión, lo saca de aquí
    return render_template('dashboard.html')

@app.route('/cows')
@login_required
def cows():
    return render_template('cows.html')

@app.route('/alerts')
@login_required
def alerts():
    return render_template('alerts.html')

@app.route('/map')
@login_required
def map_view():
    return render_template('map.html')

@app.route('/data')
@login_required
def data():
    return render_template('data.html')

@app.route('/sensors')
@login_required
def sensors():
    return render_template('sensors.html')

@app.route('/register')
@login_required
def register():
    return render_template('register.html')

@app.route('/registro', methods=['POST'])
def registro():
    return render_template('registro_exitoso.html')

@app.route('/reports')
@login_required
def reports():
    return render_template('reports.html')

@app.route("/api/vacasnew")
def obtener_vacas_reporte():

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT DISTINCT id_vaca FROM sensores")

    vacas = [row[0] for row in cursor.fetchall()]

    return jsonify(vacas)

@app.route("/api/reporte")
@login_required
def generar_reporte():

    vaca = request.args.get("vaca", "all")
    inicio = request.args.get("inicio")
    fin = request.args.get("fin")

    if not inicio or not fin:
        fin = datetime.now()
        inicio = fin - timedelta(days=1)

    conn = get_connection()
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    sql = """
    SELECT *
    FROM sensores
    WHERE fecha BETWEEN %s AND %s
    """

    params = [inicio, fin]

    if vaca != "all":
        sql += " AND id_vaca=%s"
        params.append(vaca)

    cursor.execute(sql, params)
    datos = cursor.fetchall()

    if not datos:
        return jsonify({"error": "Sin datos"})

    # ==============================
    # CALCULAR DISTANCIA RECORRIDA
    # ==============================

    distancia_total = 0
    puntos_validos = []

    for d in datos:
        lat = d["latitud"]
        lon = d["longitud"]

        if lat and lon and lat != 0 and lon != 0:
            puntos_validos.append((lat, lon))

    for i in range(1, len(puntos_validos)):
        lat1, lon1 = puntos_validos[i-1]
        lat2, lon2 = puntos_validos[i]

        distancia_total += distancia(lat1, lon1, lat2, lon2)

    # ==============================
    # ZONAS MÁS FRECUENTES
    # ==============================

    zonas = {}

    for lat, lon in puntos_validos:

        key = f"{round(lat,3)},{round(lon,3)}"

        if key not in zonas:
            zonas[key] = 0

        zonas[key] += 1

    zonas_frecuentes = sorted(zonas.items(), key=lambda x: x[1], reverse=True)[:3]

    # ==============================
    # ESTADÍSTICAS BIOMÉTRICAS
    # ==============================

    temps = [d["temp_objeto"] for d in datos if d["temp_objeto"]]
    hr = [d["ritmo_cardiaco"] for d in datos if d["ritmo_cardiaco"]]

    temp_avg = sum(temps)/len(temps)
    hr_avg = sum(hr)/len(hr)

    temp_max = max(temps)
    hr_max = max(hr)

    # -------- HEALTH SCORE --------

    score = 100

    if temp_max > 39.5:
        score -= 30

    if hr_max > 100:
        score -= 30

    estado = "Saludable"

    if score < 70:
        estado = "Posible problema"

    # ==============================
    # TEXTO AUTOMÁTICO
    # ==============================

    analisis = f"""
Durante el periodo analizado se registró una temperatura promedio de {temp_avg:.2f} °C
y un ritmo cardíaco promedio de {hr_avg:.2f} bpm.

La temperatura máxima registrada fue {temp_max:.2f} °C y el ritmo cardíaco máximo fue
{hr_max:.2f} bpm.

El índice de salud calculado es {score}/100, lo cual clasifica el estado del animal
como: {estado}.

Distancia total recorrida durante el periodo: {distancia_total:.2f} km.
"""

    return jsonify({
        "datos": datos,
        "estadisticas":{
            "temp_avg": temp_avg,
            "hr_avg": hr_avg,
            "temp_max": temp_max,
            "hr_max": hr_max,
            "score": score,
            "estado": estado
        },
        "movimiento":{
            "distancia_km": distancia_total,
            "zonas_frecuentes": zonas_frecuentes
        },
        "analisis": analisis
    })

# Obtener todos los umbrales
@app.route("/api/config/umbral", methods=["GET"])
@login_required
def get_umbrales():
    try:
        with get_connection() as conn:
            with conn.cursor(pymysql.cursors.DictCursor) as cursor:
                cursor.execute("SELECT clave, valor FROM configuracion")
                umbrales = {row['clave']: float(row['valor']) for row in cursor.fetchall()}
        return jsonify(umbrales)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Actualizar un umbral específico
@app.route("/api/config/umbral/<clave>", methods=["PUT"])
def update_umbral(clave):
    data = request.get_json()
    if not data or "valor" not in data:
        return jsonify({"error": "Falta el campo 'valor'"}), 400

    try:
        valor = float(data["valor"])
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO configuracion (clave, valor) 
                    VALUES (%s, %s) 
                    ON DUPLICATE KEY UPDATE valor = %s, fecha_actualizacion = NOW()
                """, (clave, valor, valor))
            conn.commit()
        return jsonify({"status": "ok", "clave": clave, "valor": valor})
    except ValueError:
        return jsonify({"error": "El valor debe ser numérico"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- EJECUCIÓN ----------
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8080)

