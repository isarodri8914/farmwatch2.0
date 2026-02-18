let cowData = [];

async function fetchData() {
    try {
        const response = await fetch("/api/datos");
        cowData = await response.json();

        // Formatear fecha
        cowData = cowData.map(d => ({
            vaca: d.id_vaca,
            temp: d.temperatura,
            ritmo: d.ritmo,
            ubicacion: d.ubicacion,
            fecha: new Date(d.fecha).toLocaleString()
        }));

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
`🐄 Vaca #${row.vaca}

Temperatura: ${row.temp} °C
Ritmo cardiaco: ${row.ritmo} bpm
Ubicación: ${row.ubicacion}
Fecha: ${row.fecha}`
    );
}

document.getElementById("search-input").addEventListener("input", function () {
    const value = this.value.toLowerCase();

    const filtered = cowData.filter(d =>
        d.vaca.toString().includes(value) ||
        d.temp.toString().includes(value) ||
        d.ritmo.toString().includes(value) ||
        d.fecha.toLowerCase().includes(value)
    );

    renderTable(filtered);
});

document.getElementById("cow-filter").addEventListener("change", function () {
    const value = this.value;

    if (value === "all") {
        renderTable(cowData);
    } else {
        renderTable(cowData.filter(d => d.vaca.toString() === value));
    }
});

document.getElementById("export-excel").addEventListener("click", () => {
    let csvContent = "Vaca,Temperatura,Ritmo,Ubicación,Fecha\n";

    cowData.forEach(row => {
        csvContent += `${row.vaca},${row.temp},${row.ritmo},${row.ubicacion},${row.fecha}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "datos_vacas.csv";
    link.click();
});

document.getElementById("export-pdf").addEventListener("click", () => {
    const pdfContent = cowData.map(row =>
`Vaca: ${row.vaca}
Temp: ${row.temp} °C
Ritmo: ${row.ritmo} bpm
Ubicación: ${row.ubicacion}
Fecha: ${row.fecha}

`
    ).join("");

    const blob = new Blob([pdfContent], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "datos_vacas.txt";
    link.click();
});

// Cargar datos al iniciar
fetchData();
