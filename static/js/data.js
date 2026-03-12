let cowData = [];

async function fetchData() {
    try {
        const response = await fetch("/api/datos");
        cowData = await response.json();

        // No convertimos fecha, la dejamos tal cual viene de MySQL
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
            <td>${row.id_vaca}</td>
            <td>${row.temp_ambiente ?? 0} °C</td>
            <td>${row.temp_objeto ?? 0} °C</td>
            <td>${row.ritmo_cardiaco ?? 0} bpm</td>
            <td>${row.oxigeno ?? 0}</td>
            <td>${row.gyro_x ?? 0}</td>
            <td>${row.gyro_y ?? 0}</td>
            <td>${row.gyro_z ?? 0}</td>
            <td>${row.latitud ?? 0}, ${row.longitud ?? 0}</td>
            <td>${row.fecha}</td>
        `;

        tbody.appendChild(tr);
    });
}

document.getElementById("search-input").addEventListener("input", function () {
    const value = this.value.toLowerCase();

    const filtered = cowData.filter(d =>
        d.id_vaca.toLowerCase().includes(value) ||
        d.fecha.toLowerCase().includes(value)
    );

    renderTable(filtered);
});

document.getElementById("cow-filter").addEventListener("change", function () {
    const value = this.value;

    if (value === "all") {
        renderTable(cowData);
    } else {
        renderTable(cowData.filter(d => d.id_vaca === value));
    }
});

// Cargar datos al iniciar
fetchData();
setInterval(fetchData, 10000);

// ========================================
// EXPORTAR A CSV / EXCEL
// ========================================

document.getElementById("export-excel").addEventListener("click", () => {

    if (!cowData.length) {
        alert("No hay datos para exportar");
        return;
    }

    const dataExport = cowData.map(d => ({
        Vaca: d.id_vaca,
        "Temp Ambiente": d.temp_ambiente,
        "Temp Objeto": d.temp_objeto,
        "Ritmo Cardiaco": d.ritmo_cardiaco,
        Oxigeno: d.oxigeno,
        "Gyro X": d.gyro_x,
        "Gyro Y": d.gyro_y,
        "Gyro Z": d.gyro_z,
        Latitud: d.latitud,
        Longitud: d.longitud,
        Fecha: d.fecha
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos Vacas");

    XLSX.writeFile(workbook, "historial_vacas.xlsx");
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

    doc.setFontSize(18);
    doc.text("Historial de Datos de Vacas", 14, 15);

    const columns = [
        "Vaca",
        "Temp Amb",
        "Temp Obj",
        "Ritmo",
        "Oxígeno",
        "Gyro X",
        "Gyro Y",
        "Gyro Z",
        "Ubicación",
        "Fecha"
    ];

    const rows = cowData.map(d => [
        d.id_vaca,
        d.temp_ambiente,
        d.temp_objeto,
        d.ritmo_cardiaco,
        d.oxigeno,
        d.gyro_x,
        d.gyro_y,
        d.gyro_z,
        `${d.latitud}, ${d.longitud}`,
        d.fecha
    ]);

    doc.autoTable({
        head: [columns],
        body: rows,
        startY: 25,
        theme: "grid",
        styles: {
            fontSize: 8
        },
        headStyles: {
            fillColor: [0, 102, 153]
        }
    });

    doc.save("historial_vacas.pdf");
});