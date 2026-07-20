let currentField = null;

// Umbrales cargados del servidor — se usan también para validar que, por
// ejemplo, la temperatura mínima no termine siendo mayor que la máxima.
let umbralesActuales = { temp_max: null, temp_min: null, hr_max: null, hr_reposo: null };

const CLAVE_POR_CAMPO = {
    tempMaxValue: "temp_max",
    tempMinValue: "temp_min",
    hrMaxValue: "hr_max",
    hrReposoValue: "hr_reposo"
};

// ==========================
// TOAST (reemplaza los alert() de antes)
// ==========================
let toastTimeout = null;
function showToast(msg, tipo = "success") {
    const toast = document.getElementById("toast");
    clearTimeout(toastTimeout);
    toast.textContent = msg;
    toast.className = "toast show " + tipo;
    toastTimeout = setTimeout(() => {
        toast.className = "toast " + tipo;
    }, 2800);
}

// ==========================
// MODAL EDITAR UMBRALES
// ==========================
function openEditModal(title, fieldId) {
    currentField = fieldId;

    document.getElementById("modalTitle").innerText = "Editar " + title;
    document.getElementById("modalError").style.display = "none";

    // Prellenar con el valor actual (antes quedaba vacío y había que
    // recordar/retipear el número desde cero).
    const clave = CLAVE_POR_CAMPO[fieldId];
    const valorActual = umbralesActuales[clave];
    document.getElementById("newValue").value = (valorActual !== null && valorActual !== undefined) ? valorActual : "";

    const modal = document.getElementById("editModal");
    modal.classList.add("show");
    document.getElementById("newValue").focus();
}

function closeModal() {
    const modal = document.getElementById("editModal");
    modal.classList.remove("show");
}

function mostrarErrorModal(msg) {
    const el = document.getElementById("modalError");
    el.textContent = msg;
    el.style.display = "block";
}

async function saveValue() {
    let newValue = document.getElementById("newValue").value.trim();

    if (newValue === "" || isNaN(newValue)) {
        mostrarErrorModal("Ingresa un valor numérico válido.");
        return;
    }

    const valor = parseFloat(newValue);
    const clave = CLAVE_POR_CAMPO[currentField];
    if (!clave) return;

    // Validaciones de sentido común contra los otros umbrales ya cargados.
    if (clave === "temp_max" && umbralesActuales.temp_min !== null && valor <= umbralesActuales.temp_min) {
        mostrarErrorModal(`Debe ser mayor que la temperatura mínima actual (${umbralesActuales.temp_min} °C).`);
        return;
    }
    if (clave === "temp_min" && umbralesActuales.temp_max !== null && valor >= umbralesActuales.temp_max) {
        mostrarErrorModal(`Debe ser menor que la temperatura máxima actual (${umbralesActuales.temp_max} °C).`);
        return;
    }
    if ((clave === "hr_max" || clave === "hr_reposo") && valor <= 0) {
        mostrarErrorModal("Debe ser un valor mayor que cero.");
        return;
    }

    const btn = document.getElementById("btnSaveValue");
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
        const res = await fetch(`/api/config/umbral/${clave}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ valor })
        });

        if (!res.ok) {
            const err = await res.json();
            mostrarErrorModal("Error al guardar: " + (err.error || "Desconocido"));
            return;
        }

        const unidad = clave.includes("temp") ? " °C" : " bpm";
        document.getElementById(currentField).innerText = valor + unidad;
        umbralesActuales[clave] = valor;

        closeModal();
        showToast("Umbral actualizado correctamente", "success");

    } catch (err) {
        console.error(err);
        mostrarErrorModal("Error de conexión al guardar.");
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

// Cerrar modal al hacer clic fuera del contenido, o con Escape
document.getElementById("editModal").addEventListener("click", function (e) {
    if (e.target === this) closeModal();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("editModal").classList.contains("show")) closeModal();
});

// ==========================
// MAPEAR ESTADO VISUAL
// ==========================
// "Sin señal" se trata como advertencia (naranja), no como el mismo nivel
// de gravedad que un fallo total — antes ambos casos se veían igual de
// "peligrosos" en rojo, sin distinguir severidad.
function mapStatus(status) {
    switch (status) {
        case "Activo": return "status-ok";
        case "Sin señal": return "status-warn";
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
                <p>${s.type || ""}</p>
                <span class="sensor-status ${mapStatus(s.status)}">
                    ${s.status}
                </span>
            </div>
        `;
    });

    document.getElementById("lastCheck").textContent =
        "Última verificación: " + new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
            umbralesActuales.temp_max = Number(umbrales.temp_max);
            document.getElementById("tempMaxValue").innerText = umbrales.temp_max + " °C";
        }
        if (umbrales.temp_min !== undefined) {
            umbralesActuales.temp_min = Number(umbrales.temp_min);
            document.getElementById("tempMinValue").innerText = umbrales.temp_min + " °C";
        }
        if (umbrales.hr_max !== undefined) {
            umbralesActuales.hr_max = Number(umbrales.hr_max);
            document.getElementById("hrMaxValue").innerText = umbrales.hr_max + " bpm";
        }
        // hr_reposo alimenta la fórmula de Gasto Calórico del dashboard.
        // Antes solo se podía cambiar mandando un PUT a mano a la API;
        // ahora tiene su fila aquí igual que los demás umbrales.
        if (umbrales.hr_reposo !== undefined) {
            umbralesActuales.hr_reposo = Number(umbrales.hr_reposo);
            document.getElementById("hrReposoValue").innerText = umbrales.hr_reposo + " bpm";
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
// Antes se pedía cada 5s; los sensores solo reportan cada ~15s, así que
// no había información nueva que justificara ese ritmo.
setInterval(loadSensors, 15000);