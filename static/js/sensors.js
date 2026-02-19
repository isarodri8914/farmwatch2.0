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
        const res = await fetch("/api/ultima-lectura");

        if (!res.ok) return null;

        return await res.json();

    } catch (error) {
        console.error("Error obteniendo datos:", error);
        return null;
    }
}

// ==========================
// EVALUAR SENSORES
// ==========================
function evaluateSensors(data) {

    if (!data) {
        return [
            { name: "ESP32", type: "Microcontrolador", icon: "⚡", status: "Offline" }
        ];
    }

    return [
        {
            name: "MAX30100",
            type: "Ritmo cardíaco y oxígeno",
            icon: "❤️",
            status: (data.ritmo_cardiaco > 0 || data.oxigeno > 0)
                ? "Activo"
                : "Sin señal"
        },
        {
            name: "MLX90614",
            type: "Temperatura corporal",
            icon: "🌡️",
            status: (data.temp_objeto > 0 || data.temp_ambiente > 0)
                ? "Activo"
                : "Sin señal"
        },
        {
            name: "MPU6050",
            type: "Acelerómetro / Giroscopio",
            icon: "📐",
            status: (data.gyro_x != 0 || data.gyro_y != 0 || data.gyro_z != 0)
                ? "Activo"
                : "Sin señal"
        },
        {
            name: "GPS NEO6MV2",
            type: "Geolocalización",
            icon: "📍",
            status: (data.latitud != 0 && data.longitud != 0)
                ? "Activo"
                : "Sin señal"
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
