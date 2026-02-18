let vacas = [];

async function cargarVacas() {
    const res = await fetch("/api/vacas");
    vacas = await res.json();
    renderTabla();
}

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

async function guardarVaca() {
    const data = {
        id: vacaEditando ? vacaEditando.id : null,
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

    location.reload();
}

async function borrarVaca(id) {
    if (!confirm("¿Eliminar vaca?")) return;

    await fetch(`/api/vacas/${id}`, { method: "DELETE" });
    location.reload();
}

async function mostrarHistorial(idEsp32) {
    const res = await fetch(`/api/vacas/${idEsp32}/historial`);
    const datos = await res.json();

    const lista = document.getElementById("listaHistorial");
    lista.innerHTML = "";

    datos.forEach(d => {
        const li = document.createElement("li");
        li.textContent = `${d.fecha} | Temp: ${d.temp_ambiente} °C | Ritmo: ${d.ritmo_cardiaco}`;
        lista.appendChild(li);
    });

    document.getElementById("modalHistorial").classList.remove("hidden");
}

document.getElementById("btnGuardarVaca").addEventListener("click", guardarVaca);

cargarVacas();
