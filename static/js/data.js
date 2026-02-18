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
