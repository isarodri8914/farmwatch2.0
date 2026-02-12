let currentField = null;

// ========= MODAL PARA EDITAR =========
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

// ========= CERRAR MODALES =========
function closeModal() {
    document.getElementById("editModal").style.display = "none";
}



// ========= LISTA PROFESIONAL DE SENSORES =========
const sensors = [
    { name: "MAX30100", type: "Ritmo cardíaco y oxígeno", icon: "❤️", status: "Activo" },
    { name: "MLX90614", type: "Temperatura corporal", icon: "🌡️", status: "Activo" },
    { name: "MPU6050", type: "Acelerómetro / Giroscopio", icon: "📐", status: "Sin señal" },
    { name: "GPS NEO6MV2", type: "Geolocalización", icon: "📍", status: "Batería baja" },
    { name: "ESP32", type: "Microcontrolador", icon: "⚡", status: "Activo" }
];

function mapStatus(status) {
    switch (status) {
        case "Activo": return "status-ok";
        case "Batería baja": return "status-warn";
        case "Sin señal": return "status-danger";
        case "Offline": return "status-offline";
        default: return "";
    }
}

function loadSensors() {
    const grid = document.getElementById("sensor-grid");
    grid.innerHTML = "";

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

loadSensors();
