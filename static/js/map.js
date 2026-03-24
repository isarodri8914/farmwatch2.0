document.addEventListener("DOMContentLoaded", () => {
    // Inicialización del mapa principal
    const map = L.map("map", { zoomControl: true }).setView([20.9754, -89.6169], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const cowList = document.getElementById("cowList");
    const cowSearch = document.getElementById("cowSearch");

    let vacas = []; // Persistencia: guarda los últimos datos recibidos
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
            console.error("Error de red, usando caché local.");
            if (vacas.length > 0) renderCowList(vacas);
        }
    }

    function renderCowList(vacasFiltradas) {
        cowList.innerHTML = "";
        vacasFiltradas.forEach(v => {
            const li = document.createElement("li");
            li.textContent = v.name || `Vaca ${v.id}`;
            // Diferenciación visual si está offline
            if (v.status === 'offline') li.style.opacity = "0.6";
            li.addEventListener("click", () => openCowModal(v));
            cowList.appendChild(li);
        });
    }

    function renderMarkers(vacas) {
        vacas.forEach(v => {
            if (!v.lat || !v.lng) return;
            const color = v.status === "ok" ? "#10b981" : (v.status === "alert" ? "#f97316" : "#9ca3af");
            const marker = L.circleMarker([v.lat, v.lng], {
                radius: 11, color: color, fillColor: color, fillOpacity: 0.75
            }).addTo(map);
            marker.on("click", () => openCowModal(v));
        });
    }

    function openCowModal(vaca) {
        // 1. Centrar mapa principal en la vaca seleccionada
        if (vaca.lat && vaca.lng) map.setView([vaca.lat, vaca.lng], 16);

        // 2. Mostrar el modal
        document.getElementById("cowModal").style.display = "flex";
        document.getElementById("modalName").textContent = vaca.name || `Vaca ${vaca.id}`;

        // 3. Cargar datos inmediatos (Últimos conocidos)
        updateUI(vaca);

        // 4. Mapa pequeño del modal
        if (currentModalMap) currentModalMap.remove();
        currentModalMap = L.map("modalMiniMap", { zoomControl: false }).setView([vaca.lat || 20.9754, vaca.lng || -89.6169], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(currentModalMap);
        L.circleMarker([vaca.lat || 20.9754, vaca.lng || -89.6169], { radius: 8, color: "#3b82f6" }).addTo(currentModalMap);

        createMiniCharts();

        // 5. Iniciar ciclo de actualización en tiempo real
        if (currentInterval) clearInterval(currentInterval);
        currentInterval = setInterval(() => refreshCowData(vaca.id), 3000);
    }

    function updateUI(data) {
        // Muestra datos de la API o del objeto local, evita el "--" si ya existía información
        document.getElementById("m_temp").textContent = data.temp || data.temperatura || "--";
        document.getElementById("m_hr").textContent = data.hr || data.ritmo || "--";
        document.getElementById("m_act").textContent = data.actividad || "Normal";
        document.getElementById("m_state").textContent = data.status || data.estado || "OK";
    }

    async function refreshCowData(id) {
        try {
            const res = await fetch(`/api/dashboard`); 
            const data = await res.json();
            const vacaActualizada = data.cows.find(c => c.id === id);

            if (vacaActualizada) {
                updateUI(vacaActualizada);
                updateCharts(vacaActualizada);
            }
        } catch (err) {
            console.log("Servidor inaccesible. Manteniendo datos previos.");
        }
    }

    function updateCharts(vaca) {
        const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        chartTemp.data.labels.push(now);
        chartTemp.data.datasets[0].data.push(vaca.temp || 37);
        chartHR.data.labels.push(now);
        chartHR.data.datasets[0].data.push(vaca.hr || 80);

        if (chartTemp.data.labels.length > 10) {
            chartTemp.data.labels.shift();
            chartTemp.data.datasets[0].data.shift();
            chartHR.data.labels.shift();
            chartHR.data.datasets[0].data.shift();
        }
        chartTemp.update();
        chartHR.update();
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
                backgroundColor: color + '25',
                borderWidth: 3,
                pointRadius: 2
            }] 
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false,     // ← Muy importante
            plugins: { 
                legend: { display: false } 
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { color: '#f0f0f0' }
                },
                x: { 
                    grid: { color: '#f0f0f0' }
                }
            }
        }
    });

    chartTemp = new Chart(document.getElementById("chartTemp"), config("Temperatura", "#ef4444"));
    chartHR = new Chart(document.getElementById("chartHR"), config("Ritmo Cardíaco", "#3b82f6"));
}

    function closeCowModal() {
        document.getElementById("cowModal").style.display = "none";
        clearInterval(currentInterval);
    }

    document.getElementById("closeModal").onclick = closeCowModal;
    
    // Cerrar al hacer clic fuera del modal
    window.onclick = (event) => {
        if (event.target == document.getElementById("cowModal")) closeCowModal();
    };

    loadVacas();
});