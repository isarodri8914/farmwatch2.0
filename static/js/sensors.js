let currentField = null;

// ==========================
// MODAL EDITAR UMBRALES
// ==========================
function openEditModal(title, fieldId) {
    currentField = fieldId;

    document.getElementById("modalTitle").innerText = "Editar " + title;
    document.getElementById("newValue").value = "";
    document.getElementById("editModal").style.display = "flex";
}

function saveValue() {
    let newValue = document.getElementById("newValue").value;

    if (newValue.trim() === "") {
        alert("Ingresa un valor válido");
        return;
    }

    document.getElementById(currentField).innerText = newValue;
    closeModal();
}

function closeModal() {
    document.getElementById("editModal").style.display = "none";
}

// ==========================
// MAPEAR ESTADO VISUAL
// ==========================
function mapStatus(status) {
    switch (status) {
        case "Activo": return "status-ok";
        case "Sin señal": return "status-danger";
        case "Offline": return "status-offline";
        default: return "";
    }
}

// ==========================
// OBTENER ÚLTIMO DATO
// ==========================
async function getLastSensorData() {
    try {
        const res = await fetch("/api/sensores/ultimos");

        if (!res.ok) return null;

        return await res.json();

    } catch (error) {
        console.error("Error obteniendo datos:", error);
        return null;
    }
}

function sensorEstaCongelado(valores) {
    if (valores.length < 3) return false;

    return valores.every(v => v === valores[0]);
}

function evaluateSensors(datos) {

    if (!datos || datos.length === 0) {
        return [
            { name: "ESP32", icon: "⚡", status: "Offline" }
        ];
    }

    const ultima = datos[0];

    const now = new Date();
    const last = new Date(ultima.fecha);
    const diffSeconds = (now - last) / 1000;

    if (diffSeconds > 30) {
        return [
            { name: "ESP32", icon: "⚡", status: "Offline" }
        ];
    }

    // ===== MPU6050 =====
    const gyroX = datos.map(d => d.gyro_x);
    const gyroY = datos.map(d => d.gyro_y);
    const gyroZ = datos.map(d => d.gyro_z);

    const mpuCongelado =
        sensorEstaCongelado(gyroX) &&
        sensorEstaCongelado(gyroY) &&
        sensorEstaCongelado(gyroZ);

    // ===== MAX30100 =====
    const ritmos = datos.map(d => d.ritmo_cardiaco);
    const oxigenos = datos.map(d => d.oxigeno);

    const maxCongelado =
        sensorEstaCongelado(ritmos) &&
        sensorEstaCongelado(oxigenos);

    return [

        {
            name: "MAX30100",
            type: "Ritmo cardíaco y oxígeno",
            icon: "❤️",
            status: maxCongelado ? "Sin señal" : "Activo"
        },

        {
            name: "MLX90614",
            type: "Temperatura corporal",
            icon: "🌡️",
            status: (ultima.temp_objeto > 0 || ultima.temp_ambiente > 0)
                ? "Activo"
                : "Sin señal"
        },

        {
            name: "MPU6050",
            type: "Acelerómetro / Giroscopio",
            icon: "📐",
            status: mpuCongelado ? "Sin señal" : "Activo"
        },

        {
            name: "GPS NEO6MV2",
            type: "Geolocalización",
            icon: "📍",
            status: (ultima.latitud == 0 && ultima.longitud == 0)
                ? "Sin señal"
                : "Activo"
        },

        {
            name: "ESP32",
            type: "Microcontrolador",
            icon: "⚡",
            status: "Activo"
        }
    ];
}



// ==========================
// CARGAR SENSORES DINÁMICAMENTE
// ==========================
async function loadSensors() {

    const data = await getLastSensorData();
    const grid = document.getElementById("sensor-grid");
    grid.innerHTML = "";

    const sensors = evaluateSensors(data);

    sensors.forEach(s => {
        grid.innerHTML += `
            <div class="sensor-card ${mapStatus(s.status)}">
                <div class="sensor-header">
                    <div class="sensor-name">${s.name}</div>
                    <div class="sensor-icon">${s.icon}</div>
                </div>

                <p>${s.type}</p>

                <span class="sensor-status ${mapStatus(s.status)}">
                    ${s.status}
                </span>
            </div>
        `;
    });
}

// ==========================
// AUTO REFRESH
// ==========================
loadSensors();
setInterval(loadSensors, 5000);
