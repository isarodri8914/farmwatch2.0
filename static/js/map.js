document.addEventListener("DOMContentLoaded", () => {
    const vacas = [
        { id: 1, nombre: "Vaca 1", lat: 19.4321, lng: -99.1338 },
        { id: 2, nombre: "Vaca 2", lat: 19.4329, lng: -99.1321 },
        { id: 3, nombre: "Vaca 3", lat: 19.4315, lng: -99.1340 }
    ];

    const cowList = document.getElementById("cowList");

    // Render vaca list
    vacas.forEach(v => {
        const li = document.createElement("li");
        li.textContent = v.nombre;
        li.onclick = () => openCowModal(v.id, v.nombre);
        cowList.appendChild(li);
    });

    // SEARCH FILTRO
    document.getElementById("cowSearch").addEventListener("input", function () {
        const text = this.value.toLowerCase();
        document.querySelectorAll("#cowList li").forEach(li => {
            li.style.display = li.textContent.toLowerCase().includes(text) ? "block" : "none";
        });
    });

    // MAPA
    const map = L.map("map").setView([19.4326, -99.1332], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    vacas.forEach(v => {
        L.marker([v.lat, v.lng])
            .addTo(map)
            .on("click", () => openCowModal(v.id, v.nombre));
    });
});


/*------------- MODAL + GRÁFICAS -------------*/
let interval;
let chartTemp, chartHR;

function openCowModal(id, name) {
    document.getElementById("modalName").textContent = name;
    document.getElementById("cowModal").style.display = "block";

    createCharts(); // crear mini gráficas

    updateCowData(id); // cargar primera vez

    interval = setInterval(() => updateCowData(id), 3000);
}

function closeCowModal() {
    document.getElementById("cowModal").style.display = "none";
    clearInterval(interval);
}

document.getElementById("closeModal").onclick = closeCowModal;

async function updateCowData(id) {
    const res = await fetch(`/api/vaca/${id}`);
    const data = await res.json();

    document.getElementById("m_temp").textContent = data.temperatura;
    document.getElementById("m_hr").textContent = data.ritmo;
    document.getElementById("m_act").textContent = data.actividad;
    document.getElementById("m_loc").textContent = data.ubicacion;
    document.getElementById("m_state").textContent = data.estado;

    // actualizar gráficas
    chartTemp.data.datasets[0].data.push(data.temperatura);
    chartHR.data.datasets[0].data.push(data.ritmo);

    chartTemp.update();
    chartHR.update();
}

function createCharts() {
    const ctx1 = document.getElementById("chartTemp");
    const ctx2 = document.getElementById("chartHR");

    chartTemp = new Chart(ctx1, {
        type: "line",
        data: { labels: [], datasets: [{ label: "Temp °C", data: [] }] },
        options: { responsive: true, scales: { y: { beginAtZero: false } } }
    });

    chartHR = new Chart(ctx2, {
        type: "line",
        data: { labels: [], datasets: [{ label: "Ritmo BPM", data: [] }] },
        options: { responsive: true, scales: { y: { beginAtZero: false } } }
    });
}
