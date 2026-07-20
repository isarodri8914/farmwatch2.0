let map;
let ruta;
let marcadores = [];
let tempChart;
let hrChart;
let reporteActual = null;

let currentPage = 1;
const PAGE_SIZE = 10;

document.addEventListener("DOMContentLoaded", function () {

    document.getElementById("generar").onclick = generarInforme;
    document.getElementById("exportPDF").onclick = exportPDF;
    document.getElementById("exportExcel").onclick = exportExcel;

    document.getElementById("page-prev").onclick = () => { currentPage--; renderTablaPagina(); };
    document.getElementById("page-next").onclick = () => { currentPage++; renderTablaPagina(); };

    document.querySelectorAll(".quick-btn").forEach(btn => {
        btn.addEventListener("click", () => aplicarRangoRapido(btn.dataset.range));
    });

    cargarVacas();
});

// ==================== RANGOS RÁPIDOS ====================
function formatoFecha(d) {
    return d.toISOString().slice(0, 10);
}

function aplicarRangoRapido(range) {
    const hoy = new Date();
    const inicioInput = document.getElementById("inicio");
    const finInput = document.getElementById("fin");

    if (range === "all") {
        inicioInput.value = "";
        finInput.value = "";
    } else if (range === "today") {
        inicioInput.value = formatoFecha(hoy);
        finInput.value = formatoFecha(hoy);
    } else {
        const dias = Number(range);
        const desde = new Date();
        desde.setDate(hoy.getDate() - dias);
        inicioInput.value = formatoFecha(desde);
        finInput.value = formatoFecha(hoy);
    }

    generarInforme();
}

// ==================== GENERAR INFORME ====================
function mostrarError(msg) {
    const banner = document.getElementById("errorBanner");
    banner.textContent = msg;
    banner.style.display = "block";
}

function ocultarError() {
    document.getElementById("errorBanner").style.display = "none";
}

async function generarInforme() {
    const vaca = document.getElementById("vaca").value;
    const inicio = document.getElementById("inicio").value;
    const fin = document.getElementById("fin").value;

    if (inicio && fin && inicio > fin) {
        mostrarError("La fecha de inicio no puede ser posterior a la fecha de fin.");
        return;
    }

    ocultarError();

    const btn = document.getElementById("generar");
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando...";

    try {
        const res = await fetch(`/api/reporte?vaca=${vaca}&inicio=${inicio}&fin=${fin}`);
        let data;

        try {
            data = await res.json();
        } catch (err) {
            const text = await res.text();
            console.error("Respuesta NO JSON:", text);
            throw new Error("El servidor no devolvió una respuesta válida.");
        }

        if (data.error) {
            mostrarError(data.error);
            return;
        }

        reporteActual = data;
        currentPage = 1;

        document.getElementById("emptyState").style.display = "none";
        document.getElementById("resultsSection").style.display = "block";
        document.getElementById("exportPDF").disabled = false;
        document.getElementById("exportExcel").disabled = false;

        mostrarAnalisis(data);
        crearGraficas(data.datos);
        crearMapa(data.datos);
        renderTablaPagina();

    } catch (e) {
        console.error("Error generando informe", e);
        mostrarError("No se pudo generar el informe. Intenta de nuevo en unos segundos.");
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

// ==================== RESUMEN + SALUD + MOVIMIENTO + SISTEMA ====================
function mostrarAnalisis(data) {
    const est = data.estadisticas || {};

    document.getElementById("analisis").textContent =
        `Se analizaron los datos del periodo seleccionado. Temperatura promedio: ${Number(est.temp_avg).toFixed(1)} °C ` +
        `(máx. ${Number(est.temp_max).toFixed(1)} °C). Ritmo cardíaco promedio: ${Number(est.hr_avg).toFixed(0)} bpm ` +
        `(máx. ${Number(est.hr_max).toFixed(0)} bpm).`;

    document.getElementById("temp_avg").textContent = Number(est.temp_avg).toFixed(1);
    document.getElementById("temp_max").textContent = Number(est.temp_max).toFixed(1);
    document.getElementById("hr_avg").textContent = Number(est.hr_avg).toFixed(0);
    document.getElementById("hr_max").textContent = Number(est.hr_max).toFixed(0);

    const score = Number(est.score) || 0;
    const isOk = score >= 70;
    const badge = document.getElementById("healthBadge");
    badge.className = "health-badge " + (isOk ? "ok" : "warn");
    document.getElementById("healthScore").textContent = `${score}/100`;
    document.getElementById("healthLabel").textContent = est.estado || "--";

    // ---- Movimiento ----
    if (data.movimiento) {
        document.getElementById("distancia_km").textContent = Number(data.movimiento.distancia_km || 0).toFixed(2);

        const zonasList = document.getElementById("zonasList");
        zonasList.innerHTML = "";
        const zonas = data.movimiento.zonas_frecuentes || [];

        if (!zonas.length) {
            zonasList.innerHTML = `<li>No hay suficientes lecturas de GPS en este periodo.</li>`;
        } else {
            zonas.forEach(([coords, count]) => {
                const li = document.createElement("li");
                li.textContent = `${coords} — ${count} lectura${count === 1 ? "" : "s"}`;
                zonasList.appendChild(li);
            });
        }
    }

    // ---- Sistema ----
    if (data.sistema) {
        const sis = data.sistema;
        const estadoEl = document.getElementById("sistemaEstado");
        estadoEl.textContent = `Estado general: ${sis.estado}`;
        estadoEl.className = "system-status " + (sis.estado === "Estable" ? "ok" : "warn");

        document.getElementById("totalRegistros").textContent = sis.total_registros ?? "--";

        const sensores = [
            { label: "MAX30100", value: sis.max30100 },
            { label: "MLX90614", value: sis.mlx90614 },
            { label: "MPU6050", value: sis.mpu6050 },
            { label: "GPS", value: sis.gps }
        ];

        const barsEl = document.getElementById("sensorBars");
        barsEl.innerHTML = sensores.map(s => {
            const pct = Math.max(0, Math.min(100, Number(s.value) || 0));
            const cls = pct >= 70 ? "" : (pct >= 50 ? "warn" : "danger");
            return `
                <div class="sensor-bar-row">
                    <span>${s.label}</span>
                    <div class="sensor-bar-track"><div class="sensor-bar-fill ${cls}" style="width:${pct}%;"></div></div>
                    <span>${pct.toFixed(0)}%</span>
                </div>
            `;
        }).join("");
    }
}

// ==================== GRÁFICAS ====================
function crearGraficas(datos) {
    const datosLimitados = datos.slice(-30);

    const labels = datosLimitados.map(d => d.fecha);
    const temps = datosLimitados.map(d => d.temp_objeto);
    const hr = datosLimitados.map(d => d.ritmo_cardiaco);

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 8 } } }
    };

    if (tempChart) tempChart.destroy();
    tempChart = new Chart(document.getElementById("tempChart"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Temperatura",
                data: temps,
                borderColor: "#ef4444",
                backgroundColor: "#ef444420",
                fill: true,
                tension: 0.3
            }]
        },
        options: commonOptions
    });

    if (hrChart) hrChart.destroy();
    hrChart = new Chart(document.getElementById("hrChart"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Ritmo cardíaco",
                data: hr,
                borderColor: "#3b82f6",
                backgroundColor: "#3b82f620",
                fill: true,
                tension: 0.3
            }]
        },
        options: commonOptions
    });
}

// ==================== MAPA ====================
function crearMapa(datos) {
    if (!map) {
        map = L.map("map").setView([20.97, -89.62], 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap"
        }).addTo(map);
    }

    marcadores.forEach(m => map.removeLayer(m));
    marcadores = [];

    if (ruta) {
        map.removeLayer(ruta);
        ruta = null;
    }

    const puntos = [];

    datos.forEach(d => {
        if (d.latitud && d.longitud && d.latitud != 0 && d.longitud != 0) {
            const punto = [d.latitud, d.longitud];
            puntos.push(punto);

            const marker = L.circleMarker(punto, {
                radius: 4, color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.7, weight: 1
            }).addTo(map);
            marcadores.push(marker);
        }
    });

    if (puntos.length > 1) {
        ruta = L.polyline(puntos, { color: "#ef4444", weight: 3 }).addTo(map);
        map.fitBounds(puntos, { padding: [20, 20] });
    } else if (puntos.length === 1) {
        map.setView(puntos[0], 15);
    }

    setTimeout(() => map.invalidateSize(), 50);
}

// ==================== TABLA PAGINADA ====================
function renderTablaPagina() {
    if (!reporteActual || !reporteActual.datos) return;

    const datos = reporteActual.datos;
    const pages = Math.max(1, Math.ceil(datos.length / PAGE_SIZE));
    if (currentPage > pages) currentPage = pages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageSlice = datos.slice(start, start + PAGE_SIZE);

    const tbody = document.querySelector("#tabla tbody");
    tbody.innerHTML = "";

    if (!pageSlice.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No hay registros para mostrar.</td></tr>`;
    } else {
        pageSlice.forEach(d => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${d.fecha ?? ""}</td>
                <td>${d.temp_objeto ?? "--"}</td>
                <td>${d.ritmo_cardiaco ?? "--"}</td>
                <td>${d.latitud ?? "--"}</td>
                <td>${d.longitud ?? "--"}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById("page-info").textContent = `Página ${currentPage} de ${pages}`;
    document.getElementById("page-prev").disabled = currentPage <= 1;
    document.getElementById("page-next").disabled = currentPage >= pages;
    document.getElementById("tableCount").textContent = `${datos.length} registro${datos.length === 1 ? "" : "s"} en total`;
}

// ==================== EXPORTAR EXCEL ====================
function exportExcel() {
    if (!reporteActual || !reporteActual.datos.length) {
        mostrarError("Primero genera un informe con datos.");
        return;
    }

    const dataExport = reporteActual.datos.map(d => ({
        "Fecha": d.fecha,
        "Temperatura (°C)": d.temp_objeto,
        "Ritmo cardíaco (bpm)": d.ritmo_cardiaco,
        "Oxígeno (%)": d.oxigeno,
        "Latitud": d.latitud,
        "Longitud": d.longitud
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Informe");
    XLSX.writeFile(workbook, `informe_farmwatch_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ==================== EXPORTAR PDF ====================
async function exportPDF() {
    if (!reporteActual) {
        mostrarError("Primero genera un informe.");
        return;
    }

    const btn = document.getElementById("exportPDF");
    const textoOriginal = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando PDF...";

    try {
        const doc = new window.jspdf.jsPDF();
        let y = 20;

        doc.setFontSize(18);
        doc.text("FarmWatch - Informe de Monitoreo", 20, y);
        y += 10;

        doc.setFontSize(12);
        const analisis = doc.splitTextToSize(document.getElementById("analisis").textContent, 170);
        doc.text("Resumen:", 20, y);
        y += 8;
        doc.text(analisis, 20, y);
        y += analisis.length * 6 + 5;

        const est = reporteActual.estadisticas || {};
        doc.text("Estadísticas:", 20, y); y += 8;
        doc.text(`Temp. promedio: ${Number(est.temp_avg).toFixed(1)} °C`, 20, y); y += 6;
        doc.text(`Temp. máxima: ${Number(est.temp_max).toFixed(1)} °C`, 20, y); y += 6;
        doc.text(`Ritmo promedio: ${Number(est.hr_avg).toFixed(0)} bpm`, 20, y); y += 6;
        doc.text(`Ritmo máximo: ${Number(est.hr_max).toFixed(0)} bpm`, 20, y); y += 6;
        doc.text(`Índice de salud: ${est.score}/100 (${est.estado})`, 20, y);
        y += 10;

        const tempCanvas = document.getElementById("tempChart");
        const tempImg = tempCanvas.toDataURL("image/png");
        doc.text("Gráfica de temperatura", 20, y);
        y += 5;
        doc.addImage(tempImg, "PNG", 20, y, 170, 60);

        doc.addPage();
        y = 20;

        const hrCanvas = document.getElementById("hrChart");
        const hrImg = hrCanvas.toDataURL("image/png");
        doc.text("Gráfica de ritmo cardíaco", 20, y);
        y += 5;
        doc.addImage(hrImg, "PNG", 20, y, 170, 60);

        doc.addPage();
        y = 20;

        const mapElement = document.getElementById("map");
        await new Promise(r => setTimeout(r, 800));
        const canvasMapa = await html2canvas(mapElement, { useCORS: true, scale: 2 });
        const mapaImg = canvasMapa.toDataURL("image/png");

        doc.text("Ruta recorrida del animal", 20, 20);
        doc.addImage(mapaImg, "PNG", 20, 30, 170, 100);

        // La tabla del PDF usa TODOS los registros del informe, no solo la
        // página que se esté viendo en pantalla.
        const rows = reporteActual.datos.map(d => [
            d.fecha ?? "",
            d.temp_objeto ?? "",
            d.ritmo_cardiaco ?? "",
            d.latitud ?? "",
            d.longitud ?? ""
        ]);

        doc.autoTable({
            startY: 140,
            head: [["Fecha", "Temp", "Ritmo", "Lat", "Lng"]],
            body: rows,
            styles: { fontSize: 8 }
        });

        doc.save(`informe_farmwatch_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
        console.error("Error exportando PDF", e);
        mostrarError("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
        btn.disabled = false;
        btn.textContent = textoOriginal;
    }
}

// ==================== CARGAR VACAS ====================
async function cargarVacas() {
    try {
        const res = await fetch("/api/vacasnew");
        const vacas = await res.json();
        const select = document.getElementById("vaca");

        vacas.forEach(v => {
            const option = document.createElement("option");
            option.value = v;
            option.textContent = `#${v}`;
            select.appendChild(option);
        });

        // Si se llegó desde "Vacas" con /reports?vaca=ID, se preselecciona
        // esa vaca y se genera el informe de una vez (todo el historial).
        const params = new URLSearchParams(window.location.search);
        const vacaParam = params.get("vaca");
        if (vacaParam && [...select.options].some(o => o.value === vacaParam)) {
            select.value = vacaParam;
            generarInforme();
        }
    } catch (e) {
        console.error("Error cargando vacas", e);
    }
}