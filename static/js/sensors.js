let currentField = null;

// ==========================
// MODAL EDITAR UMBRALES
// ==========================
function openEditModal(title, fieldId) {
    currentField = fieldId;

    document.getElementById("modalTitle").innerText = "Editar " + title;
    document.getElementById("newValue").value = "";
    
    const modal = document.getElementById("editModal");
    modal.classList.add("show");
}

function closeModal() {
    const modal = document.getElementById("editModal");
    modal.classList.remove("show");
}

async function saveValue() {
    let newValue = document.getElementById("newValue").value.trim();

    if (newValue === "" || isNaN(newValue)) {
        alert("Ingresa un valor numérico válido");
        return;
    }

    const valor = parseFloat(newValue);

    // Mapear el campo actual a la clave de BD
    let clave;
    if (currentField === "tempMaxValue") clave = "temp_max";
    else if (currentField === "tempMinValue") clave = "temp_min";
    else if (currentField === "hrMaxValue") clave = "hr_max";
    else return;

    try {
        const res = await fetch(`/api/config/umbral/${clave}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ valor })
        });

        if (!res.ok) {
            const err = await res.json();
            alert("Error al guardar: " + (err.error || "Desconocido"));
            return;
        }

        // Actualizar visualmente
        const unidad = clave.includes("temp") ? " °C" : " bpm";
        document.getElementById(currentField).innerText = valor + unidad;
        
        closeModal();
        alert("Umbral actualizado correctamente");
        
    } catch (err) {
        console.error(err);
        alert("Error de conexión al guardar");
    }
}

// Cerrar modal al hacer clic fuera del contenido
document.getElementById("editModal").addEventListener("click", function(e) {
    if (e.target === this) {
        closeModal();
    }
});

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

    const mpuCongelado = sensorEstaCongelado(gyroX) && 
                         sensorEstaCongelado(gyroY) && 
                         sensorEstaCongelado(gyroZ);

    // ===== MAX30100 =====
    const ritmos = datos.map(d => d.ritmo_cardiaco);
    const oxigenos = datos.map(d => d.oxigeno);

    const maxCongelado = sensorEstaCongelado(ritmos) && 
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
            status: (ultima.temp_objeto > 0 || ultima.temp_ambiente > 0) ? "Activo" : "Sin señal"
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
            status: (ultima.latitud == 0 && ultima.longitud == 0) ? "Sin señal" : "Activo"
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
// CARGAR UMBRALES
// ==========================
async function loadUmbrales() {
    try {
        const res = await fetch("/api/config/umbral");
        if (!res.ok) return;

        const umbrales = await res.json();

        if (umbrales.temp_max !== undefined) {
            document.getElementById("tempMaxValue").innerText = umbrales.temp_max + " °C";
        }
        if (umbrales.temp_min !== undefined) {
            document.getElementById("tempMinValue").innerText = umbrales.temp_min + " °C";
        }
        if (umbrales.hr_max !== undefined) {
            document.getElementById("hrMaxValue").innerText = umbrales.hr_max + " bpm";
        }
    } catch (err) {
        console.error("Error cargando umbrales:", err);
    }
}

// ==========================
// INICIO
// ==========================
loadUmbrales();
loadSensors();
setInterval(loadSensors, 5000);