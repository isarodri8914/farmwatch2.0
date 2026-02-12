from flask import Flask, render_template, request, jsonify
import pymysql
import os

app = Flask(__name__)
# ---------- CONEXIÓN DB ----------
def get_connection():
    return pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "farmwatch_user"),
        password=os.environ.get("DB_PASS", "Jihr8914."),
        database=os.environ.get("DB_NAME", "farmwatch_db")
    )

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


# ---------- RUTAS ----------

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

@app.route("/api/vaca/<int:id>")
def api_vaca(id):
    # EJEMPLO: luego conectamos a tu base de datos
    datos = {
        1: {"temperatura": 38.4, "ritmo": 72, "actividad": "Moviéndose", "ubicacion": "19.4321,-99.1338", "estado": "Normal"},
        2: {"temperatura": 40.1, "ritmo": 101, "actividad": "Inquieta", "ubicacion": "19.4329,-99.1321", "estado": "Alerta"},
        3: {"temperatura": 41.3, "ritmo": 120, "actividad": "Alta actividad", "ubicacion": "19.4315,-99.1340", "estado": "Crítico"},
    }
    return datos.get(id, {})



# ---------- EJECUCIÓN ----------
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8080)

