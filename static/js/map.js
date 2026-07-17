document.addEventListener("DOMContentLoaded", () => {
    // Inicialización del mapa principal
    const map = L.map("map", { zoomControl: true }).setView([20.9754, -89.6169], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const cowList = document.getElementById("cowList");
    const cowSearch = document.getElementById("cowSearch");
    const modalEl = document.getElementById("cowModal");

    let vacas = [];           // último snapshot recibido del servidor
    let markersById = {};     // un marcador por vaca (se actualiza, no se duplica)
    let activeCowId = null;   // vaca que tiene el modal abierto (o null)
    let activeMiniMarker = null;
    let currentModalMap = null;
    let chartTemp = null;
    let chartHR = null;

    function colorForStatus(status) {
        return status === "ok" ? "#10b981" : (status === "alert" ? "#f97316" : "#9ca3af");
    }

    // ==================== CARGA + REFRESCO (un solo ciclo) ====================
    // Antes esta pantalla pedía datos por dos caminos separados: uno cada
    // carga inicial para el mapa/lista, y otro cada 3s mientras el modal
    // estaba abierto. Duplicaba peticiones al servidor. Ahora un solo poll
    // cada 15s (igual que el dashboard) alimenta mapa, lista y modal.
    async function loadVacas() {
        try {
            const res = await fetch("/api/dashboard");
            const data = await res.json();
            if (!data.cows) return;

            vacas = data.cows;

            applySidebarFilter();
            renderMarkers(vacas);

            if (activeCowId !== null) {
                const activeVaca = vacas.find(v => String(v.id) === String(activeCowId));
                if (activeVaca) {
                    updateUI(activeVaca);
                    updateCharts(activeVaca);
                    if (activeMiniMarker && activeVaca.lat && activeVaca.lng) {
                        activeMiniMarker.setLatLng([activeVaca.lat, activeVaca.lng]);
                        currentModalMap.panTo([activeVaca.lat, activeVaca.lng]);
                    }
                }
            }
        } catch (err) {
            console.warn("Error de red, se mantiene la última info conocida.");
        }
    }

    // ==================== LISTA LATERAL ====================
    function applySidebarFilter() {
        const term = cowSearch.value.toLowerCase().trim();
        const filtered = !term
            ? vacas
            : vacas.filter(v =>
                (v.name || `Vaca ${v.id}`).toLowerCase().includes(term) ||
                String(v.id).toLowerCase().includes(term)
              );
        renderCowList(filtered);
    }

    function renderCowList(list) {
        cowList.innerHTML = "";

        if (!list.length) {
            const li = document.createElement("li");
            li.className = "empty-item";
            li.textContent = vacas.length ? "No se encontraron vacas con ese nombre." : "Aún no hay vacas registradas.";
            cowList.appendChild(li);
            return;
        }

        list.forEach(v => {
            const li = document.createElement("li");
            li.className = "cow-item" + (String(v.id) === String(activeCowId) ? " active" : "");
            const color = colorForStatus(v.status);
            li.innerHTML = `<span class="status-dot" style="background:${color}"></span><span>${v.name || "Vaca " + v.id}</span>`;
            li.addEventListener("click", () => openCowModal(v));
            cowList.appendChild(li);
        });
    }

    cowSearch.addEventListener("input", applySidebarFilter);

    // ==================== MARCADORES (sin duplicar) ====================
    function renderMarkers(list) {
        const currentIds = new Set(list.map(v => String(v.id)));

        // Quitar marcadores de vacas que ya no vienen en la respuesta
        Object.keys(markersById).forEach(id => {
            if (!currentIds.has(id)) {
                map.removeLayer(markersById[id]);
                delete markersById[id];
            }
        });

        list.forEach(v => {
            if (!v.lat || !v.lng) return;
            const color = colorForStatus(v.status);
            const key = String(v.id);

            if (markersById[key]) {
                markersById[key].setLatLng([v.lat, v.lng]);
                markersById[key].setStyle({ color, fillColor: color });
            } else {
                const marker = L.circleMarker([v.lat, v.lng], {
                    radius: 11, color, fillColor: color, fillOpacity: 0.75, weight: 2
                }).addTo(map);
                marker.on("click", () => openCowModal(v));
                markersById[key] = marker;
            }
        });
    }

    // ==================== MODAL ====================
    function openCowModal(vaca) {
        activeCowId = vaca.id;
        applySidebarFilter(); // repinta la lista para marcar esta vaca como "activa"

        if (vaca.lat && vaca.lng) map.setView([vaca.lat, vaca.lng], 16);

        modalEl.classList.add("show");
        document.getElementById("modalName").textContent = vaca.name || `Vaca ${vaca.id}`;

        updateUI(vaca);

        // Mapa pequeño del modal
        if (currentModalMap) {
            currentModalMap.remove();
            currentModalMap = null;
        }
        const lat = vaca.lat || 20.9754;
        const lng = vaca.lng || -89.6169;
        currentModalMap = L.map("modalMiniMap", { zoomControl: false, scrollWheelZoom: false }).setView([lat, lng], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(currentModalMap);
        activeMiniMarker = L.circleMarker([lat, lng], { radius: 8, color: colorForStatus(vaca.status), fillColor: colorForStatus(vaca.status), fillOpacity: 0.8 }).addTo(currentModalMap);
        // Sin esto, Leaflet a veces dibuja el mapa pequeño mal la primera vez
        // porque el modal todavía no tenía su tamaño final en el DOM.
        setTimeout(() => currentModalMap && currentModalMap.invalidateSize(), 50);

        createMiniCharts();
    }

    function updateUI(data) {
        document.getElementById("m_temp").textContent = data.temp ?? data.temperatura ?? "--";
        document.getElementById("m_hr").textContent = data.hr ?? data.ritmo ?? "--";
        document.getElementById("m_act").textContent = data.actividad || "Normal";
        document.getElementById("m_loc").textContent = (data.lat && data.lng)
            ? `${Number(data.lat).toFixed(4)}, ${Number(data.lng).toFixed(4)}`
            : "Sin señal GPS";

        const badge = document.getElementById("m_state_badge");
        const status = data.status || "offline";
        const labels = { ok: "Normal", alert: "Alerta", offline: "Offline" };
        badge.textContent = labels[status] || "--";
        badge.className = "state-badge " + status;
    }

    function updateCharts(vaca) {
        if (!chartTemp || !chartHR) return;
        const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        chartTemp.data.labels.push(now);
        chartTemp.data.datasets[0].data.push(vaca.temp ?? 37);
        chartHR.data.labels.push(now);
        chartHR.data.datasets[0].data.push(vaca.hr ?? 0);

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
                maintainAspectRatio: false,
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
        modalEl.classList.remove("show");
        activeCowId = null;
        applySidebarFilter(); // quita el resaltado de "activa" en la lista
    }

    document.getElementById("closeModal").addEventListener("click", closeCowModal);

    // Cerrar al hacer clic fuera del modal o con Escape
    modalEl.addEventListener("click", (event) => {
        if (event.target === modalEl) closeCowModal();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modalEl.classList.contains("show")) closeCowModal();
    });

    // ==================== INICIO ====================
    loadVacas();
    setInterval(loadVacas, 15000);
});