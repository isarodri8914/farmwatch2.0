const cowData = [
    { vaca: "101", temp: 38.7, ritmo: 82, ubicacion: "21.1453, -100.9332", fecha: "2025-12-02 | 14:22" },
    { vaca: "104", temp: 39.2, ritmo: 95, ubicacion: "21.1479, -100.9401", fecha: "2025-12-02 | 14:18" },
    { vaca: "109", temp: 37.9, ritmo: 74, ubicacion: "21.1510, -100.9385", fecha: "2025-12-02 | 14:14" },
];

function renderTable(data) {
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";
    data.forEach(row => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${row.vaca}</td>
            <td>${row.temp} °C</td>
            <td>${row.ritmo} bpm</td>
            <td>${row.ubicacion}</td>
            <td>${row.fecha}</td>
        `;

        tr.addEventListener("click", () => openCowDetails(row));
        tbody.appendChild(tr);
    });
}

function openCowDetails(row) {
    alert(
        `🐄 Vaca #${row.vaca}\n\n` +
        `Temperatura: ${row.temp} °C\n` +
        `Ritmo cardiaco: ${row.ritmo} bpm\n` +
        `Ubicación: ${row.ubicacion}\n` +
        `Fecha: ${row.fecha}`
    );
}

document.getElementById("search-input").addEventListener("input", function () {
    const value = this.value.toLowerCase();
    const filtered = cowData.filter(d =>
        d.vaca.includes(value) ||
        d.temp.toString().includes(value) ||
        d.ritmo.toString().includes(value) ||
        d.fecha.toLowerCase().includes(value)
    );
    renderTable(filtered);
});

document.getElementById("cow-filter").addEventListener("change", function () {
    const value = this.value;
    if (value === "all") renderTable(cowData);
    else renderTable(cowData.filter(d => d.vaca === value));
});

document.getElementById("export-excel").addEventListener("click", () => {
    let csvContent = "Vaca,Temperatura,Ritmo,Ubicación,Fecha\n";
    cowData.forEach(row => {
        csvContent += `${row.vaca},${row.temp},${row.ritmo},${row.ubicacion},${row.fecha}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "datos_vacas.csv";
    link.click();
});

document.getElementById("export-pdf").addEventListener("click", () => {
    const pdfContent = cowData.map(row =>
        `Vaca: ${row.vaca}\nTemp: ${row.temp} °C\nRitmo: ${row.ritmo} bpm\nUbicación: ${row.ubicacion}\nFecha: ${row.fecha}\n\n`
    ).join("");

    const blob = new Blob([pdfContent], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "datos_vacas.pdf";
    link.click();
});

renderTable(cowData);
