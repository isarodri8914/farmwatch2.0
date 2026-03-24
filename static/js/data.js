let cowData = [];

// Cargar datos
async function fetchData() {
    try {
        const response = await fetch("/api/datos");
        cowData = await response.json();
        renderTable(cowData);
    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

function renderTable(data) {
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    data.forEach(row => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td><strong>${row.id_vaca}</strong></td>
            <td>${row.temp_ambiente ?? 0} °C</td>
            <td>${row.temp_objeto ?? 0} °C</td>
            <td>${row.ritmo_cardiaco ?? 0} bpm</td>
            <td>${row.oxigeno ?? 0} %</td>
            <td>${row.gyro_x ?? 0}</td>
            <td>${row.gyro_y ?? 0}</td>
            <td>${row.gyro_z ?? 0}</td>
            <td>${row.latitud ?? 0}, ${row.longitud ?? 0}</td>
            <td>${row.fecha}</td>
        `;

        tbody.appendChild(tr);
    });
}

// Buscador en tiempo real
document.getElementById("search-input").addEventListener("input", function () {
    const value = this.value.toLowerCase().trim();

    const filtered = cowData.filter(d => 
        (d.id_vaca && d.id_vaca.toLowerCase().includes(value)) ||
        (d.fecha && d.fecha.toLowerCase().includes(value)) ||
        (d.temp_objeto && String(d.temp_objeto).includes(value)) ||
        (d.ritmo_cardiaco && String(d.ritmo_cardiaco).includes(value))
    );

    renderTable(filtered);
});

// Filtro por vaca
document.getElementById("cow-filter").addEventListener("change", function () {
    const value = this.value;

    if (value === "all") {
        renderTable(cowData);
    } else {
        renderTable(cowData.filter(d => d.id_vaca === value));
    }
});

// Cargar datos al iniciar + refresco automático
fetchData();
setInterval(fetchData, 10000);

// ========================================
// EXPORTAR A EXCEL
// ========================================
document.getElementById("export-excel").addEventListener("click", () => {
    if (!cowData.length) {
        alert("No hay datos para exportar");
        return;
    }

    const dataExport = cowData.map(d => ({
        "Vaca": d.id_vaca,
        "Temp Ambiente (°C)": d.temp_ambiente,
        "Temp Objeto (°C)": d.temp_objeto,
        "Ritmo Cardíaco (bpm)": d.ritmo_cardiaco,
        "Oxígeno (%)": d.oxigeno,
        "Gyro X": d.gyro_x,
        "Gyro Y": d.gyro_y,
        "Gyro Z": d.gyro_z,
        "Latitud": d.latitud,
        "Longitud": d.longitud,
        "Fecha": d.fecha
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial_Vacas");

    XLSX.writeFile(workbook, `historial_vacas_${new Date().toISOString().slice(0,10)}.xlsx`);
});

// ========================================
// EXPORTAR A PDF
// ========================================
document.getElementById("export-pdf").addEventListener("click", function () {
    if (!cowData.length) {
        alert("No hay datos para exportar");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("landscape");

    doc.setFontSize(20);
    doc.text("Historial de Datos de Vacas", 14, 18);

    const columns = [
        "Vaca", "Temp Amb", "Temp Obj", "Ritmo", "Oxígeno", 
        "Gyro X", "Gyro Y", "Gyro Z", "Ubicación", "Fecha"
    ];

    const rows = cowData.map(d => [
        d.id_vaca,
        d.temp_ambiente ?? 0,
        d.temp_objeto ?? 0,
        d.ritmo_cardiaco ?? 0,
        d.oxigeno ?? 0,
        d.gyro_x ?? 0,
        d.gyro_y ?? 0,
        d.gyro_z ?? 0,
        `${d.latitud ?? 0}, ${d.longitud ?? 0}`,
        d.fecha
    ]);

    doc.autoTable({
        head: [columns],
        body: rows,
        startY: 28,
        theme: "grid",
        styles: { fontSize: 9 },
        headStyles: { 
            fillColor: [15, 23, 42],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`historial_vacas_${new Date().toISOString().slice(0,10)}.pdf`);
});