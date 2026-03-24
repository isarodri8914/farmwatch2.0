let map;
let ruta;
let marcadores = [];
let tempChart;
let hrChart;
let reporteActual = null;

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("generar").onclick = generarInforme;
    document.getElementById("exportPDF").onclick = exportPDF;

    cargarVacas();
});

async function generarInforme() {
    const vaca = document.getElementById("vaca").value;
    const inicio = document.getElementById("inicio").value;
    const fin = document.getElementById("fin").value;

    if (!inicio || !fin) {
        alert("Por favor selecciona una fecha de inicio y fin");
        return;
    }

    try {
        const res = await fetch(`/api/reporte?vaca=${vaca}&inicio=${inicio}&fin=${fin}`);
        
        if (!res.ok) throw new Error("Error del servidor");

        const data = await res.json();
        reporteActual = data;

        if (data.error) {
            alert(data.error);
            return;
        }

        mostrarAnalisis(data);
        crearGraficas(data.datos);
        crearMapa(data.datos);
        crearTabla(data.datos);

    } catch (e) {
        console.error("Error generando informe:", e);
        alert("Error al generar el informe. Inténtalo de nuevo.");
    }
}

function mostrarAnalisis(data) {
    const analisisEl = document.getElementById("analisis");
    analisisEl.innerHTML = data.analisis || "Sin análisis disponible.";

    document.getElementById("temp_avg").innerText = data.estadisticas?.temp_avg?.toFixed(2) || "--";
    document.getElementById("temp_max").innerText = data.estadisticas?.temp_max?.toFixed(2) || "--";
    document.getElementById("hr_avg").innerText = data.estadisticas?.hr_avg?.toFixed(2) || "--";
    document.getElementById("hr_max").innerText = data.estadisticas?.hr_max?.toFixed(2) || "--";
    document.getElementById("estado").innerText = data.estadisticas?.estado || "Sin datos";

    // Distancia recorrida
    if (data.movimiento?.distancia_km) {
        analisisEl.innerHTML += `<br><br><strong>Distancia recorrida:</strong> ${data.movimiento.distancia_km.toFixed(2)} km`;
    }
}

function crearGraficas(datos) {
    if (!datos || datos.length === 0) return;

    // Tomar solo los últimos 30 registros para mejor visualización
    const datosLimitados = datos.slice(-30);

    const labels = datosLimitados.map(d => {
        const fecha = new Date(d.fecha);
        return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    });

    const temps = datosLimitados.map(d => d.temp_objeto || 0);
    const hrs = datosLimitados.map(d => d.ritmo_cardiaco || 0);

    // Destruir gráficos anteriores
    if (tempChart) tempChart.destroy();
    if (hrChart) hrChart.destroy();

    // Gráfica de Temperatura
    tempChart = new Chart(document.getElementById("tempChart"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Temperatura (°C)",
                data: temps,
                borderColor: "#ef4444",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: "top" }
            },
            scales: {
                y: { beginAtZero: false, suggestedMin: 28, suggestedMax: 40 }
            }
        }
    });

    // Gráfica de Ritmo Cardíaco
    hrChart = new Chart(document.getElementById("hrChart"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Ritmo Cardíaco (BPM)",
                data: hrs,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: "top" }
            },
            scales: {
                y: { beginAtZero: false, suggestedMin: 40, suggestedMax: 140 }
            }
        }
    });
}

function crearMapa(datos) {
    if (!map) {
        map = L.map("map").setView([20.97, -89.62], 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap"
        }).addTo(map);
    }

    // Limpiar marcadores y ruta anterior
    marcadores.forEach(m => map.removeLayer(m));
    marcadores = [];
    if (ruta) map.removeLayer(ruta);

    const puntos = [];

    datos.forEach(d => {
        if (d.latitud && d.longitud && d.latitud !== 0 && d.longitud !== 0) {
            const punto = [d.latitud, d.longitud];
            puntos.push(punto);

            const marker = L.marker(punto).addTo(map);
            marcadores.push(marker);
        }
    });

    if (puntos.length > 1) {
        ruta = L.polyline(puntos, { color: "#ef4444", weight: 4, opacity: 0.85 }).addTo(map);
        map.fitBounds(puntos, { padding: [20, 20] });
    } else if (puntos.length === 1) {
        map.setView(puntos[0], 15);
    }
}

function crearTabla(datos) {
    const tbody = document.querySelector("#tabla tbody");
    tbody.innerHTML = "";

    datos.forEach(d => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${d.fecha || '-'}</td>
            <td>${d.temp_objeto || '-'} °C</td>
            <td>${d.ritmo_cardiaco || '-'} BPM</td>
            <td>${d.latitud || '-'}</td>
            <td>${d.longitud || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

/* ==================== EXPORTAR PDF ==================== */
async function exportPDF() {
    if (!reporteActual) {
        alert("Primero genera un informe");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("portrait");

    let y = 20;

    doc.setFontSize(18);
    doc.text("FarmWatch - Informe de Monitoreo", 20, y);
    y += 15;

    // Análisis
    doc.setFontSize(12);
    const analisisText = document.getElementById("analisis").innerText;
    const analisisLines = doc.splitTextToSize(analisisText, 170);
    doc.text("Análisis:", 20, y);
    y += 8;
    doc.text(analisisLines, 20, y);
    y += analisisLines.length * 6 + 10;

    // Estadísticas
    doc.text("Estadísticas:", 20, y);
    y += 8;
    doc.text(`Temperatura promedio: ${document.getElementById("temp_avg").innerText} °C`, 20, y); y += 7;
    doc.text(`Temperatura máxima: ${document.getElementById("temp_max").innerText} °C`, 20, y); y += 7;
    doc.text(`Ritmo promedio: ${document.getElementById("hr_avg").innerText} BPM`, 20, y); y += 7;
    doc.text(`Ritmo máximo: ${document.getElementById("hr_max").innerText} BPM`, 20, y); y += 7;
    doc.text(`Estado: ${document.getElementById("estado").innerText}`, 20, y);
    y += 15;

    // Gráfica Temperatura
    doc.text("Gráfica de Temperatura", 20, y);
    y += 8;
    const tempImg = document.getElementById("tempChart").toDataURL("image/png");
    doc.addImage(tempImg, "PNG", 20, y, 170, 70);
    y += 80;

    // Gráfica Ritmo (nueva página si es necesario)
    if (y > 200) {
        doc.addPage();
        y = 20;
    }

    doc.text("Gráfica de Ritmo Cardíaco", 20, y);
    y += 8;
    const hrImg = document.getElementById("hrChart").toDataURL("image/png");
    doc.addImage(hrImg, "PNG", 20, y, 170, 70);

    doc.save(`informe_farmwatch_${new Date().toISOString().slice(0,10)}.pdf`);
}

async function cargarVacas() {
    try {
        const res = await fetch("/api/vacasnew");
        const vacas = await res.json();

        const select = document.getElementById("vaca");
        vacas.forEach(v => {
            const option = document.createElement("option");
            option.value = v;
            option.textContent = v;
            select.appendChild(option);
        });
    } catch (e) {
        console.error("Error cargando vacas:", e);
    }
}