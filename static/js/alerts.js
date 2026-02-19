document.addEventListener("DOMContentLoaded", () => {

    const listaSistema = document.getElementById("listaSistema");
    const listaVacas = document.getElementById("listaVacas");
    const listaSensores = document.getElementById("listaSensores");

    cargarAlertas();

    async function cargarAlertas() {

        const res = await fetch("/api/alertas");
        const data = await res.json();

        listaSistema.innerHTML = "";
        listaVacas.innerHTML = "";
        listaSensores.innerHTML = "";

        // ======================
        // SISTEMA
        // ======================
        if (data.sistema.length === 0) {
            listaSistema.appendChild(crearAlerta("Sin alertas del sistema", "ok"));
        } else {
            data.sistema.forEach(a => {
                listaSistema.appendChild(crearAlerta(a.mensaje, a.nivel));
            });
        }

        // ======================
        // VACAS
        // ======================
        if (data.vacas.length === 0) {
            listaVacas.appendChild(crearAlerta("Sin alertas de salud", "ok"));
        } else {
            data.vacas.forEach(a => {
                listaVacas.appendChild(crearAlerta(a.mensaje, a.nivel));
            });
        }

        // ======================
        // SENSORES
        // ======================
        if (data.sensores.length === 0) {
            listaSensores.appendChild(crearAlerta("Todos los sensores funcionando", "ok"));
        } else {
            data.sensores.forEach(a => {
                listaSensores.appendChild(crearAlerta(a.mensaje, a.nivel));
            });
        }
    }
});

function crearAlerta(texto, nivel) {
    const li = document.createElement("li");
    li.className = `alert-item ${nivel}`;

    li.innerHTML = `
        <p class="alert-text">${texto}</p>
        <p class="alert-time">${new Date().toLocaleString()}</p>
    `;

    return li;
}
