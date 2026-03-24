document.addEventListener("DOMContentLoaded", () => {
    // Inicialización del mapa principal
    const map = L.map("map", { zoomControl: true }).setView([20.9754, -89.6169], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const cowList = document.getElementById("cowList");
    const cowSearch = document.getElementById("cowSearch");

    let vacas = [];
    let currentInterval = null;
    let currentModalMap = null;
    let chartTemp = null;
    let chartHR = null;

    async function loadVacas() {
        try {
            const res = await fetch("/api/dashboard");
            const data = await res.json();
            if (data.cows) {
                vacas = data.cows;
                renderCowList(vacas);
                renderMarkers(vacas);
            }
        } catch (err) {
            console.error("Error cargando vacas:", err);
        }
    }

    function renderCowList(vacasFiltradas) {
        cowList.innerHTML = "";
        vacasFiltradas.forEach(v => {
            const li = document.createElement("li");
            li.textContent = v.name || `Vaca ${v.id}`;
            if (v.status === 'offline') li.classList.add("offline");
            li.addEventListener("click", () => openCowModal(v));
            cowList.appendChild(li);
        });
    }

    function renderMarkers(vacas) {
        // Limpiar marcadores anteriores si es necesario (mejora futura)
        vacas.forEach(v => {
            if (!v.lat || !v.lng) return;
            const color = v.status === "ok" ? "#10b981" : (v.status === "alert" ? "#f97316" : "#9ca3af");
            const marker = L.circleMarker([v.lat, v.lng], {
                radius: 11,
                color: color,
                fillColor: color,
                fillOpacity: 0.8,
                weight: 2
            }).addTo(map);

            marker.on("click", () => openCowModal(v));
        });
    }

    function openCowModal(vaca) {
        if (vaca.lat && vaca.lng) map.setView([vaca.lat, vaca.lng], 16);

        const modal = document.getElementById("cowModal");
        modal.classList.add("show");

        document.getElementById("modalName").textContent = vaca.name || `Vaca ${vaca.id}`;

        updateUI(vaca);

        // Mini mapa
        if (currentModalMap) currentModalMap.remove();
        currentModalMap = L.map("modalMiniMap", { zoomControl: false })
            .setView([vaca.lat || 20.9754, vaca.lng || -89.6169], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(currentModalMap);
        L.circleMarker([vaca.lat || 20.9754, vaca.lng || -89.6169], {
            radius: 9,
            color: "#3b82f6",
            fillOpacity: 0.9
        }).addTo(currentModalMap);

        createMiniCharts();
        if (currentInterval) clearInterval(currentInterval);
        currentInterval = setInterval(() => refreshCowData(vaca.id), 4000);
    }

    function updateUI(data) {
        document.getElementById("m_temp").textContent = data.temp || data.temperatura || "--";
        document.getElementById("m_hr").textContent = data.hr || data.ritmo || "--";
        document.getElementById("m_act").textContent = data.actividad || "Normal";
        document.getElementById("m_state").textContent = (data.status || data.estado || "OK").toUpperCase();
    }

    async function refreshCowData(id) {
        try {
            const res = await fetch("/api/dashboard");
            const data = await res.json();
            const vacaActualizada = data.cows.find(c => c.id === id);
            if (vacaActualizada) updateUI(vacaActualizada);
        } catch (err) {
            console.log("No se pudo actualizar en tiempo real");
        }
    }

    function createMiniCharts() {
    if (chartTemp) chartTemp.destroy();
    if (chartHR) chartHR.destroy();
    
    const config = (label, color) => ({
        type: 'line',
        data: { 
            labels: [], 
            datasets: [{ 
                label: label, 
                data: [], 
                borderColor: color, 
                tension: 0.4, 
                fill: true, 
                backgroundColor: color + '22',
                borderWidth: 3,
                pointRadius: 0
            }] 
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false,   // ← Importante
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { color: '#f1f5f9' } }
            }
        }
    });

    chartTemp = new Chart(document.getElementById("chartTemp"), config("Temperatura °C", "#ef4444"));
    chartHR  = new Chart(document.getElementById("chartHR"),  config("Ritmo Cardíaco", "#3b82f6"));
}

    function closeCowModal() {
        document.getElementById("cowModal").classList.remove("show");
        if (currentInterval) clearInterval(currentInterval);
    }

    // Eventos del modal
    document.getElementById("closeModal").onclick = closeCowModal;
    window.onclick = (event) => {
        if (event.target === document.getElementById("cowModal")) closeCowModal();
    };

    // Buscador en sidebar
    cowSearch.addEventListener("input", () => {
        const term = cowSearch.value.toLowerCase();
        const filtered = vacas.filter(v => 
            (v.name && v.name.toLowerCase().includes(term)) ||
            String(v.id).includes(term)
        );
        renderCowList(filtered);
    });

    // Carga inicial
    loadVacas();
});