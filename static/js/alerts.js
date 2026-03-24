document.addEventListener("DOMContentLoaded", () => {

    const listaSistema = document.getElementById("listaSistema");
    const listaVacas = document.getElementById("listaVacas");
    const listaSensores = document.getElementById("listaSensores");

    function limpiarListas() {
        listaSistema.innerHTML = "";
        listaVacas.innerHTML = "";
        listaSensores.innerHTML = "";
    }

    function crearAlerta(texto, nivel) {
        const li = document.createElement("li");
        li.className = `alert-item ${nivel}`;

        const hora = new Date().toLocaleString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        li.innerHTML = `
            <p class="alert-text">${texto}</p>
            <p class="alert-time">${hora}</p>
        `;

        return li;
    }

    function cargarEstado() {

        fetch("/api/estado-sistema")
            .then(res => res.json())
            .then(data => {

                limpiarListas();

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

                    listaSensores.appendChild(
                        crearAlerta("📡 Todos los sensores fuera de línea", "critical")
                    );

                    listaVacas.appendChild(
                        crearAlerta("🐄 No hay datos disponibles de las vacas", "critical")
                    );

                    return;
                }

                // =============================
                // ✅ SI HAY CONEXIÓN
                // =============================

                listaSistema.appendChild(
                    crearAlerta("✅ Cloud SQL conectada correctamente", "success")
                );

                let hayAlertaSensores = false;
                let hayAlertaVacas = false;

                // Sensores
                data.sensores.forEach(sensor => {
                    if (sensor.estado !== "activo") {
                        hayAlertaSensores = true;
                        listaSensores.appendChild(
                            crearAlerta(`📡 Sensor ${sensor.id} fuera de línea`, "warning")
                        );
                    }
                });

                if (!hayAlertaSensores) {
                    listaSensores.appendChild(
                        crearAlerta("✅ Todos los sensores operando correctamente", "success")
                    );
                }

                // Vacas
                data.vacas.forEach(vaca => {

                    if (vaca.temperatura > 40) {
                        hayAlertaVacas = true;
                        listaVacas.appendChild(
                            crearAlerta(`🐄 Vaca ${vaca.id} con temperatura alta (${vaca.temperatura}°C)`, "critical")
                        );
                    }

                    if (vaca.ritmo > 120) {
                        hayAlertaVacas = true;
                        listaVacas.appendChild(
                            crearAlerta(`🐄 Vaca ${vaca.id} con ritmo cardíaco elevado (${vaca.ritmo} BPM)`, "warning")
                        );
                    }

                });

                if (!hayAlertaVacas) {
                    listaVacas.appendChild(
                        crearAlerta("✅ Todas las vacas en estado normal", "success")
                    );
                }

            })
            .catch(error => {

                limpiarListas();

                listaSistema.appendChild(
                    crearAlerta("❌ Error crítico al consultar el backend", "critical")
                );

                listaSistema.appendChild(
                    crearAlerta("⚠️ El servidor no responde", "warning")
                );
            });
    }

    // 🔥 Ejecuta inmediatamente y cada 5 segundos
    cargarEstado();
    setInterval(cargarEstado, 5000);
});