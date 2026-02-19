document.addEventListener("DOMContentLoaded", () => {

    const listaSistema = document.getElementById("listaSistema");
    const listaVacas = document.getElementById("listaVacas");
    const listaSensores = document.getElementById("listaSensores");

    fetch("/api/estado-sistema")
        .then(res => res.json())
        .then(data => {

            // =============================
            // ⚠️ ESTADO CLOUD SQL
            // =============================
            if (!data.sql_conectado) {

                listaSistema.appendChild(
                    crearAlerta("❌ Cloud SQL desconectado", "critical")
                );

                listaSistema.appendChild(
                    crearAlerta("⚠️ No se pueden obtener datos del sistema", "warning")
                );

                // Sensores offline
                listaSensores.appendChild(
                    crearAlerta("📡 Todos los sensores fuera de línea", "critical")
                );

                // Vacas sin datos
                listaVacas.appendChild(
                    crearAlerta("🐄 No hay datos disponibles de las vacas", "critical")
                );

                return;
            }

            // =============================
            // SI HAY CONEXIÓN
            // =============================

            listaSistema.appendChild(
                crearAlerta("✅ Cloud SQL conectada correctamente", "success")
            );

            // Sensores
            data.sensores.forEach(sensor => {
                if (sensor.estado !== "activo") {
                    listaSensores.appendChild(
                        crearAlerta(`📡 Sensor ${sensor.id} fuera de línea`, "warning")
                    );
                }
            });

            // Vacas
            data.vacas.forEach(vaca => {

                if (vaca.temperatura > 40) {
                    listaVacas.appendChild(
                        crearAlerta(`🐄 Vaca ${vaca.id} con temperatura alta (${vaca.temperatura}°C)`, "critical")
                    );
                }

                if (vaca.ritmo > 120) {
                    listaVacas.appendChild(
                        crearAlerta(`🐄 Vaca ${vaca.id} con ritmo cardíaco elevado (${vaca.ritmo} BPM)`, "warning")
                    );
                }

            });

        })
        .catch(error => {

            listaSistema.appendChild(
                crearAlerta("❌ Error crítico al consultar el backend", "critical")
            );

            listaSistema.appendChild(
                crearAlerta("⚠️ El servidor no responde", "warning")
            );
        });
});

function crearAlerta(texto, nivel) {
    const li = document.createElement("li");
    li.className = `alert-item ${nivel}`;

    const hora = new Date().toLocaleString();

    li.innerHTML = `
        <p class="alert-text">${texto}</p>
        <p class="alert-time">${hora}</p>
    `;

    return li;
}
