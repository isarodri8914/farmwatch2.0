let vacas = [];              // perfiles registrados (tabla `vacas`)
let estadoPorId = {};         // id_esp32 -> "ok" | "alert" | "offline", calculado con sensores reales
let vacaEditando = null;
let vacaHistorialActual = null;

const tablaBody = document.getElementById("tablaVacas");
const searchInput = document.getElementById("searchCow");
const cowCountEl = document.getElementById("cowCount");
const errorBanner = document.getElementById("errorBanner");
const formError = document.getElementById("formError");

// ===============================
// CARGAR VACAS DESDE LA BD + ESTADO REAL DESDE SENSORES
// ===============================
async function cargarVacas() {
    try {
        const res = await fetch("/api/vacas");
        vacas = await res.json();

        await cargarEstados();
        renderTabla(vacas);
    } catch (e) {
        console.error("Error cargando vacas", e);
        mostrarError("No se pudo cargar la lista de vacas. Revisa tu conexión.");
    }
}

// El endpoint /api/vacas solo trae el perfil (nombre, raza, edad...), no trae
// salud. El estado real (ok/alert/offline) se calcula en /api/dashboard a
// partir de la última lectura de cada sensor — por eso se combinan aquí.
// Antes esta pantalla leía un campo "estado" que no existe en la tabla
// `vacas`, así que SIEMPRE mostraba "Crítico" sin importar la vaca.
async function cargarEstados() {
    try {
        const res = await fetch("/api/dashboard");
        const data = await res.json();
        estadoPorId = {};
        (data.cows || []).forEach(c => {
            estadoPorId[String(c.id)] = c.status;
        });
    } catch (e) {
        console.warn("No se pudo obtener el estado de salud desde el dashboard.", e);
        estadoPorId = {};
    }
}

// CARGAR IDs DE SENSORES DETECTADOS (para el selector del formulario)
async function cargarIdsDetectados() {
    try {
        const res = await fetch("/api/vacas/detectadas");
        const ids = await res.json();

        const select = document.getElementById("selectIdVaca");
        select.innerHTML = '<option value="">-- Selecciona una vaca detectada --</option>';

        ids.forEach(obj => {
            const option = document.createElement("option");
            option.value = obj.id_vaca;
            option.textContent = obj.id_vaca;
            select.appendChild(option);
        });
    } catch (e) {
        console.error("Error cargando IDs detectados", e);
    }
}

// ===============================
// ERRORES
// ===============================
function mostrarError(msg) {
    errorBanner.textContent = msg;
    errorBanner.style.display = "block";
}
function ocultarError() {
    errorBanner.style.display = "none";
}
function mostrarErrorForm(msg) {
    formError.textContent = msg;
    formError.style.display = "block";
}
function ocultarErrorForm() {
    formError.style.display = "none";
}

// ===============================
// RENDER TABLA (con buscador)
// ===============================
function renderTabla(lista) {
    tablaBody.innerHTML = "";
    cowCountEl.textContent = `${lista.length} vaca${lista.length === 1 ? "" : "s"} registrada${lista.length === 1 ? "" : "s"}`;

    if (!lista.length) {
        tablaBody.innerHTML = `<tr class="empty-row"><td colspan="7">
            ${vacas.length ? "No se encontraron vacas con ese criterio de búsqueda." : "Aún no hay vacas registradas. Usa \u201c+ Nueva Vaca\u201d para empezar."}
        </td></tr>`;
        return;
    }

    lista.forEach((v) => {
        // Se busca el índice real dentro de `vacas` (no del filtro) para
        // que editar/borrar siempre apunten a la vaca correcta.
        const index = vacas.indexOf(v);
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${v.id_esp32}</td>
            <td title="${(v.notas || "").replace(/"/g, '&quot;')}">${v.nombre}</td>
            <td>${v.raza || "--"}</td>
            <td>${v.edad ? v.edad + " años" : "--"}</td>
            <td>${v.peso ? v.peso + " kg" : "--"}</td>
            <td>${estadoBadge(estadoPorId[String(v.id_esp32)])}</td>
            <td class="actions-cell">
                <div class="action-buttons">
                    <button class="btn-action edit" onclick="editarVaca(${index})">✏️ Editar</button>
                    <button class="btn-action history" onclick="mostrarHistorial('${v.id_esp32}')">📖 Última lectura</button>
                    <button class="btn-action delete" onclick="borrarVaca(${v.id})">🗑️ Borrar</button>
                </div>
            </td>
        `;

        tablaBody.appendChild(tr);
    });
}

function estadoBadge(status) {
    if (status === "ok") return `<span class="badge badge-ok">Saludable</span>`;
    if (status === "alert") return `<span class="badge badge-alert">En alerta</span>`;
    return `<span class="badge badge-offline">Sin datos recientes</span>`;
}

// ===============================
// BUSCADOR
// ===============================
searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase().trim();
    if (!term) {
        renderTabla(vacas);
        return;
    }
    const filtradas = vacas.filter(v =>
        (v.nombre || "").toLowerCase().includes(term) ||
        (v.raza || "").toLowerCase().includes(term) ||
        String(v.id_esp32 || "").toLowerCase().includes(term)
    );
    renderTabla(filtradas);
});

// ===============================
// MODAL NUEVA VACA
// ===============================
document.getElementById("btnNuevaVaca").addEventListener("click", () => {
    vacaEditando = null;
    ocultarErrorForm();

    document.getElementById("modalTitulo").textContent = "Nueva vaca";

    document.getElementById("selectIdVaca").value = "";
    document.getElementById("inputNombre").value = "";
    document.getElementById("inputRaza").value = "";
    document.getElementById("inputEdad").value = "";
    document.getElementById("inputPeso").value = "";
    document.getElementById("inputNotas").value = "";

    document.getElementById("modalVaca").classList.remove("hidden");
});

// ===============================
// CANCELAR MODAL
// ===============================
document.getElementById("btnCancelar").addEventListener("click", () => {
    document.getElementById("modalVaca").classList.add("hidden");
});

// ===============================
// GUARDAR VACA (con validación + estado de carga)
// ===============================
document.getElementById("btnGuardarVaca").addEventListener("click", async () => {
    ocultarErrorForm();

    const idEsp32 = document.getElementById("selectIdVaca").value;
    const nombre = document.getElementById("inputNombre").value.trim();

    if (!idEsp32) {
        mostrarErrorForm("Selecciona el identificador del sensor (ESP32).");
        return;
    }
    if (!nombre) {
        mostrarErrorForm("El nombre es obligatorio.");
        return;
    }

    const data = {
        id: vacaEditando !== null ? vacas[vacaEditando].id : null,
        id_esp32: idEsp32,
        nombre: nombre,
        raza: document.getElementById("inputRaza").value.trim(),
        edad: document.getElementById("inputEdad").value,
        peso: document.getElementById("inputPeso").value,
        notas: document.getElementById("inputNotas").value.trim()
    };

    const btn = document.getElementById("btnGuardarVaca");
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
        const res = await fetch("/api/vacas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (!res.ok || result.error) {
            mostrarErrorForm(result.error || "No se pudo guardar la vaca.");
            return;
        }

        document.getElementById("modalVaca").classList.add("hidden");
        ocultarError();
        cargarVacas();
    } catch (e) {
        console.error("Error guardando vaca", e);
        mostrarErrorForm("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
});

// ===============================
// EDITAR
// ===============================
function editarVaca(index) {
    vacaEditando = index;
    ocultarErrorForm();
    const v = vacas[index];

    document.getElementById("modalTitulo").textContent = "Editar vaca";

    document.getElementById("selectIdVaca").value = v.id_esp32;
    document.getElementById("inputNombre").value = v.nombre || "";
    document.getElementById("inputRaza").value = v.raza || "";
    document.getElementById("inputEdad").value = v.edad || "";
    document.getElementById("inputPeso").value = v.peso || "";
    document.getElementById("inputNotas").value = v.notas || "";

    document.getElementById("modalVaca").classList.remove("hidden");
}

// ===============================
// BORRAR
// ===============================
async function borrarVaca(id) {
    if (!confirm("¿Eliminar esta vaca? Esta acción no se puede deshacer.")) return;

    try {
        const res = await fetch(`/api/vacas/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete failed");
        ocultarError();
        cargarVacas();
    } catch (e) {
        console.error("Error borrando vaca", e);
        mostrarError("No se pudo eliminar la vaca. Intenta de nuevo.");
    }
}

// ===============================
// ÚLTIMA LECTURA (el endpoint solo trae el dato más reciente, no un historial completo)
// ===============================
async function mostrarHistorial(idEsp32) {
    vacaHistorialActual = idEsp32;
    document.getElementById("btnVerReporte").href = `/reports?vaca=${encodeURIComponent(idEsp32)}`;

    const lista = document.getElementById("listaHistorial");
    lista.innerHTML = "<li>Cargando...</li>";
    document.getElementById("modalHistorial").classList.remove("hidden");

    try {
        const res = await fetch(`/api/vacas/${idEsp32}/historial`);
        const dato = await res.json();

        lista.innerHTML = "";

        if (!dato || dato.error || !dato.fecha) {
            lista.innerHTML = "<li>Todavía no hay lecturas de sensores para esta vaca.</li>";
            return;
        }

        const li = document.createElement("li");
        li.innerHTML = `
            <strong>${new Date(dato.fecha).toLocaleString()}</strong><br>
            🌡 Temp Amb: ${dato.temp_ambiente ?? "--"} °C<br>
            🌡 Temp Obj: ${dato.temp_objeto ?? "--"} °C<br>
            ❤️ Ritmo: ${dato.ritmo_cardiaco ?? "--"} bpm<br>
            🫁 Oxígeno: ${dato.oxigeno ?? "--"} %<br>
            📐 Gyro: X:${dato.gyro_x ?? "--"} Y:${dato.gyro_y ?? "--"} Z:${dato.gyro_z ?? "--"}<br>
            📍 Ubicación: ${dato.latitud ?? "--"}, ${dato.longitud ?? "--"}
        `;
        lista.appendChild(li);
    } catch (e) {
        console.error("Error cargando última lectura", e);
        lista.innerHTML = "<li>No se pudo cargar la información. Intenta de nuevo.</li>";
    }
}

document.getElementById("btnCerrarHistorial").addEventListener("click", () => {
    document.getElementById("modalHistorial").classList.add("hidden");
});

// ===============================
// INICIO + REFRESCO DEL ESTADO DE SALUD
// ===============================
cargarVacas();
cargarIdsDetectados();

// El estado (ok/alert/offline) viene de sensores en vivo, así que conviene
// refrescarlo aunque el usuario no recargue la página.
setInterval(async () => {
    await cargarEstados();
    searchInput.dispatchEvent(new Event("input"));
    if (!searchInput.value.trim()) renderTabla(vacas);
}, 20000);