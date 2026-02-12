// ========================
//  DATOS TEMPORALES (Mockup)
// ========================
let vacas = [
    {
        idEsp32: "vaca 1",
        nombre: "Margarita",
        raza: "Holstein",
        edad: 3,
        peso: 540,
        notas: "Vaca tranquila",
        estado: "saludable",
        historial: [
            "Temperatura normal 37.8 °C",
            "Chequeo cardiaco OK"
        ]
    },
    {
        idEsp32: "vaca 2",
        nombre: "Lola",
        raza: "Jersey",
        edad: 4,
        peso: 490,
        notas: "Produce buena leche",
        estado: "advertencia",
        historial: [
            "Temperatura elevada 39.4 °C",
            "Ritmo cardiaco alto"
        ]
    }
];

// ========================
//  ELEMENTOS DOM
// ========================
const tabla = document.getElementById("tablaVacas");

const modal = document.getElementById("modalVaca");
const modalTitulo = document.getElementById("modalTitulo");
const btnNueva = document.getElementById("btnNuevaVaca");
const btnGuardar = document.getElementById("btnGuardarVaca");
const btnCancelar = document.getElementById("btnCancelar");

const idSelect = document.getElementById("selectIdVaca");
const inputNombre = document.getElementById("inputNombre");
const inputRaza = document.getElementById("inputRaza");
const inputEdad = document.getElementById("inputEdad");
const inputPeso = document.getElementById("inputPeso");
const inputNotas = document.getElementById("inputNotas");

// Historial
const modalHistorial = document.getElementById("modalHistorial");
const listaHistorial = document.getElementById("listaHistorial");
const btnCerrarHistorial = document.getElementById("btnCerrarHistorial");

// Estado de edición
let vacaEditando = null;

// ========================
//   RENDERIZAR TABLA
// ========================
function renderTabla() {
    tabla.innerHTML = "";

    vacas.forEach((v, index) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${v.idEsp32}</td>
            <td>${v.nombre}</td>
            <td>${v.raza}</td>
            <td>${v.edad} años</td>
            <td>${estadoBadge(v.estado)}</td>
            <td>
                <button class="btn-secondary" onclick="editarVaca(${index})">Editar</button>
                <button class="btn-primary" onclick="mostrarHistorial(${index})">Historial</button>
                <button class="btn-secondary" onclick="eliminarVaca(${index})">Borrar</button>
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

// ========================
//   NUEVA VACA
// ========================
btnNueva.addEventListener("click", () => {
    vacaEditando = null;
    modalTitulo.textContent = "Nueva vaca";

    idSelect.value = "";
    inputNombre.value = "";
    inputRaza.value = "";
    inputEdad.value = "";
    inputPeso.value = "";
    inputNotas.value = "";

    modal.classList.remove("hidden");
});

// ========================
//   GUARDAR VACA
// ========================
btnGuardar.addEventListener("click", () => {
    const nueva = {
        idEsp32: idSelect.value,
        nombre: inputNombre.value,
        raza: inputRaza.value,
        edad: inputEdad.value,
        peso: inputPeso.value,
        notas: inputNotas.value,
        estado: "saludable",
        historial: []
    };

    if (vacaEditando !== null) {
        vacas[vacaEditando] = nueva;
    } else {
        vacas.push(nueva);
    }

    modal.classList.add("hidden");
    renderTabla();
});

// ========================
//   EDITAR
// ========================
function editarVaca(i) {
    vacaEditando = i;
    const v = vacas[i];

    modalTitulo.textContent = "Editar vaca";
    idSelect.value = v.idEsp32;
    inputNombre.value = v.nombre;
    inputRaza.value = v.raza;
    inputEdad.value = v.edad;
    inputPeso.value = v.peso;
    inputNotas.value = v.notas;

    modal.classList.remove("hidden");
}

// ========================
//   ELIMINAR
// ========================
function eliminarVaca(i) {
    if (confirm("¿Deseas eliminar esta vaca?")) {
        vacas.splice(i, 1);
        renderTabla();
    }
}

// ========================
//   HISTORIAL
// ========================
function mostrarHistorial(i) {
    listaHistorial.innerHTML = "";
    vacas[i].historial.forEach(h => {
        const li = document.createElement("li");
        li.textContent = h;
        listaHistorial.appendChild(li);
    });

    modalHistorial.classList.remove("hidden");
}

btnCerrarHistorial.addEventListener("click", () => {
    modalHistorial.classList.add("hidden");
});

// ========================
btnCancelar.addEventListener("click", () => {
    modal.classList.add("hidden");
});

// ========================
renderTabla();
