document.addEventListener("DOMContentLoaded", () => {

    const listaSistema = document.getElementById("listaSistema");
    const listaVacas = document.getElementById("listaVacas");
    const listaSensores = document.getElementById("listaSensores");
    const lastCheckEl = document.getElementById("lastCheck");
    const countCriticalEl = document.getElementById("countCritical");
    const countWarningEl = document.getElementById("countWarning");
    const countOkEl = document.getElementById("countOk");

    // Umbrales por defecto (mismos que dashboard.js) — se sobreescriben con
    // lo que haya guardado en la tabla `configuracion`. Antes esta pantalla
    // tenía 40°C / 120bpm escritos a mano, distintos de los del dashboard
    // (39.5°C / 95bpm), así que una vaca podía verse "en alerta" en el
    // dashboard y "normal" aquí. Ahora usan la misma fuente.
    let umbrales = { temp_max: 39.5, hr_max: 95 };

    // Firmas del último render de cada columna, para no volver a pintar todo
    // (y hacer parpadear la pantalla) cuando no cambió nada real.
    let firmaSistema = null;
    let firmaVacas = null;
    let firmaSensores = null;

    async function obtenerUmbrales() {
        try {
            const res = await fetch("/api/config/umbral");
            if (!res.ok) return;
            const data = await res.json();
            if (data.temp_max) umbrales.temp_max = Number(data.temp_max);
            if (data.hr_max) umbrales.hr_max = Number(data.hr_max);
        } catch (err) {
            console.warn("No se pudieron cargar los umbrales, se usan los valores por defecto.");
        }
    }

    function crearAlerta(texto, nivel) {
        const li = document.createElement("li");
        li.className = `alert-item ${nivel}`;

        const hora = new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        li.innerHTML = `
            <p class="alert-text">${texto}</p>
            <p class="alert-time">Verificado a las ${hora}</p>
        `;

        return li;
    }

    // Vuelve a pintar una columna solo si su contenido realmente cambió.
    function actualizarColumna(ul, items, firmaPrevia) {
        const firmaNueva = items.map(i => i.texto + "|" + i.nivel).join("||");
        if (firmaNueva === firmaPrevia) return firmaPrevia; // nada cambió, no repintar

        ul.innerHTML = "";
        items.forEach(i => ul.appendChild(crearAlerta(i.texto, i.nivel)));
        return firmaNueva;
    }

    function actualizarResumen(items) {
        const critical = items.filter(i => i.nivel === "critical").length;
        const warning = items.filter(i => i.nivel === "warning").length;
        const ok = items.length - critical - warning;

        countCriticalEl.textContent = critical;
        countWarningEl.textContent = warning;
        countOkEl.textContent = ok;
    }

    async function cargarEstado() {
        await obtenerUmbrales();

        try {
            const res = await fetch("/api/estado-sistema");
            const data = await res.json();

            const itemsSistema = [];
            const itemsVacas = [];
            const itemsSensores = [];

            // =============================
            // ⚠️ ESTADO CLOUD SQL
            // =============================
            if (!data.sql_conectado) {
                itemsSistema.push({ texto: "❌ Cloud SQL desconectado", nivel: "critical" });
                itemsSistema.push({ texto: "⚠️ No se pueden obtener datos del sistema", nivel: "warning" });
                itemsSensores.push({ texto: "📡 Todos los sensores fuera de línea", nivel: "critical" });
                itemsVacas.push({ texto: "🐄 No hay datos disponibles de las vacas", nivel: "critical" });

            } else {
                itemsSistema.push({ texto: "✅ Cloud SQL conectada correctamente", nivel: "success" });

                const sensores = data.sensores || [];
                const vacas = data.vacas || [];

                // ---- Sensores ----
                // Antes, si `sensores` venía vacío (sin ninguna lectura aún),
                // el código igual mostraba "✅ Todos los sensores operando
                // correctamente" — un falso positivo. "Sin datos" y "todo
                // bien" no son lo mismo.
                if (sensores.length === 0) {
                    itemsSensores.push({ texto: "ℹ️ Todavía no hay datos de sensores para evaluar", nivel: "info" });
                } else {
                    let hayAlertaSensores = false;
                    sensores.forEach(sensor => {
                        if (sensor.estado !== "activo") {
                            hayAlertaSensores = true;
                            itemsSensores.push({ texto: `📡 Sensor ${sensor.id} fuera de línea`, nivel: "warning" });
                        }
                    });
                    if (!hayAlertaSensores) {
                        itemsSensores.push({ texto: "✅ Todos los sensores operando correctamente", nivel: "success" });
                    }
                }

                // ---- Vacas ----
                if (vacas.length === 0) {
                    itemsVacas.push({ texto: "ℹ️ Todavía no hay lecturas de vacas para evaluar", nivel: "info" });
                } else {
                    let hayAlertaVacas = false;
                    vacas.forEach(vaca => {
                        if (vaca.temperatura > umbrales.temp_max) {
                            hayAlertaVacas = true;
                            itemsVacas.push({
                                texto: `🐄 Vaca ${vaca.id} con temperatura alta (${vaca.temperatura}°C, máx: ${umbrales.temp_max}°C)`,
                                nivel: "critical"
                            });
                        }
                        if (vaca.ritmo > umbrales.hr_max) {
                            hayAlertaVacas = true;
                            itemsVacas.push({
                                texto: `🐄 Vaca ${vaca.id} con ritmo cardíaco elevado (${vaca.ritmo} BPM, máx: ${umbrales.hr_max} BPM)`,
                                nivel: "warning"
                            });
                        }
                    });
                    if (!hayAlertaVacas) {
                        itemsVacas.push({ texto: "✅ Todas las vacas en estado normal", nivel: "success" });
                    }
                }
            }

            firmaSistema = actualizarColumna(listaSistema, itemsSistema, firmaSistema);
            firmaVacas = actualizarColumna(listaVacas, itemsVacas, firmaVacas);
            firmaSensores = actualizarColumna(listaSensores, itemsSensores, firmaSensores);

            actualizarResumen([...itemsSistema, ...itemsVacas, ...itemsSensores]);

            lastCheckEl.textContent = "Última verificación: " + new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        } catch (error) {
            const itemsError = [
                { texto: "❌ Error crítico al consultar el backend", nivel: "critical" },
                { texto: "⚠️ El servidor no responde", nivel: "warning" }
            ];
            firmaSistema = actualizarColumna(listaSistema, itemsError, firmaSistema);
            listaVacas.innerHTML = "";
            listaSensores.innerHTML = "";
            firmaVacas = null;
            firmaSensores = null;
            actualizarResumen(itemsError);
            lastCheckEl.textContent = "No se pudo verificar el estado";
        }
    }

    // Antes se pedía el estado cada 5s — más frecuente que la propia
    // cadencia de los sensores (~15s), así que solo generaba parpadeo y
    // carga extra al servidor sin información nueva real.
    cargarEstado();
    setInterval(cargarEstado, 15000);
});