let vacas = [];
let vacaEditando = null;

// ===============================
// CARGAR VACAS DESDE LA BD
// ===============================
async function cargarVacas() {
    const res = await fetch("/api/vacas");
    vacas = await res.json();
    renderTabla();
}

//CARGAR VACAS
async function cargarIdsDetectados() {
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
}


// ===============================
// RENDER TABLA
// ===============================
function renderTabla() {
    const tabla = document.getElementById("tablaVacas");
    tabla.innerHTML = "";

    vacas.forEach((v, index) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${v.id_esp32}</td>
            <td>${v.nombre}</td>
            <td>${v.raza}</td>
            <td>${v.edad} años</td>
            <td>${estadoBadge(v.estado)}</td>
            <td>
                <button onclick="editarVaca(${index})">Editar</button>
                <button onclick="mostrarHistorial('${v.id_esp32}')">Historial</button>
                <button onclick="borrarVaca(${v.id})">Borrar</button>
            </td>
        `;

        tabla.appendChild(tr);
    });
}

function estadoBadge(estado) {
    if (estado === "saludable") 
        return `<span class="badge badge-ok">Saludable</span>`;
    if (estado === "advertencia") 
        return `<span class="badge badge-warn">Advertencia</span>`;
    return `<span class="badge badge-danger">Crítico</span>`;
}

// ===============================
// MODAL NUEVA VACA
// ===============================
document.getElementById("btnNuevaVaca").addEventListener("click", () => {
    vacaEditando = null;

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
// GUARDAR VACA
// ===============================
document.getElementById("btnGuardarVaca").addEventListener("click", async () => {

    const data = {
        id: vacaEditando ? vacas[vacaEditando].id : null,
        id_esp32: document.getElementById("selectIdVaca").value,
        nombre: document.getElementById("inputNombre").value,
        raza: document.getElementById("inputRaza").value,
        edad: document.getElementById("inputEdad").value,
        peso: document.getElementById("inputPeso").value,
        notas: document.getElementById("inputNotas").value
    };

    await fetch("/api/vacas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    document.getElementById("modalVaca").classList.add("hidden");

    cargarVacas();
});

// ===============================
// EDITAR
// ===============================
function editarVaca(index) {
    vacaEditando = index;
    const v = vacas[index];

    document.getElementById("modalTitulo").textContent = "Editar vaca";

    document.getElementById("selectIdVaca").value = v.id_esp32;
    document.getElementById("inputNombre").value = v.nombre;
    document.getElementById("inputRaza").value = v.raza;
    document.getElementById("inputEdad").value = v.edad;
    document.getElementById("inputPeso").value = v.peso;
    document.getElementById("inputNotas").value = v.notas;

    document.getElementById("modalVaca").classList.remove("hidden");
}

// ===============================
// BORRAR
// ===============================
async function borrarVaca(id) {
    if (!confirm("¿Eliminar vaca?")) return;

    await fetch(`/api/vacas/${id}`, { method: "DELETE" });

    cargarVacas();
}

// ===============================
// HISTORIAL DESDE BD
// ===============================
async function mostrarHistorial(idEsp32) {
    const res = await fetch(`/api/vacas/${idEsp32}/historial`);
    const datos = await res.json();

    const lista = document.getElementById("listaHistorial");
    lista.innerHTML = "";

    datos.forEach(d => {
        const li = document.createElement("li");
        li.textContent =
            `${d.fecha} | Temp: ${d.temp_ambiente} °C | Ritmo: ${d.ritmo_cardiaco}`;
        lista.appendChild(li);
    });

    document.getElementById("modalHistorial").classList.remove("hidden");
}

document.getElementById("btnCerrarHistorial").addEventListener("click", () => {
    document.getElementById("modalHistorial").classList.add("hidden");
});

// ===============================
cargarVacas();
cargarIdsDetectados();
