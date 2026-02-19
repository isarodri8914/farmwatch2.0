from flask import Flask, render_template, request, jsonify
import os
import pymysql

app = Flask(__name__)

def get_connection():
    return pymysql.connect(
        unix_socket=f"/cloudsql/{os.environ['INSTANCE_CONNECTION_NAME']}",
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.environ["DB_NAME"]
    )
    
    #API PARA DATOS 

@app.route("/api/datos")
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
def historial_vaca(id_esp32):
    try:
        conn = get_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("""
             SELECT temp_ambiente, ritmo_cardiaco, fecha
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
@app.route("/api/ultima-lectura")
def ultima_lectura():
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
            LIMIT 1
        """)

        data = cursor.fetchone()

        cursor.close()
        conn.close()

        if not data:
            return jsonify({"error": "No hay datos"}), 404

        return jsonify(data)

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



# ---------- EJECUCIÓN ----------
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8080)

