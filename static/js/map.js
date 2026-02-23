document.addEventListener("DOMContentLoaded", () => {
  // Mapa principal fijo en Mérida
  const map = L.map("map", { zoomControl: true }).setView([20.9754, -89.6169], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  const cowList = document.getElementById("cowList");
  const cowSearch = document.getElementById("cowSearch");

  let vacas = [];
  let currentInterval = null;
  let currentModalMap = null;
  let chartTemp = null;
  let chartHR = null;

  // Cargar vacas desde API
  async function loadVacas() {
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      vacas = data.cows || [];

      renderCowList(vacas);
      renderMarkers(vacas);
    } catch (err) {
      console.error("Error cargando vacas:", err);
      cowList.innerHTML = "<li>Error al cargar</li>";
    }
  }

  function renderCowList(vacasFiltradas) {
    cowList.innerHTML = "";
    vacasFiltradas.forEach(v => {
      const li = document.createElement("li");
      li.textContent = v.name || `Vaca ${v.id}`;
      li.style.cursor = "pointer";
      li.addEventListener("click", () => openCowModal(v));
      cowList.appendChild(li);
    });
  }

  function renderMarkers(vacas) {
    vacas.forEach(v => {
      if (!v.lat || !v.lng) return;

      const color = v.status === "ok" ? "#10b981" : 
                    v.status === "alert" ? "#f97316" : "#9ca3af";

      const marker = L.circleMarker([v.lat, v.lng], {
        radius: 11,
        color: color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 2
      }).addTo(map);

      marker.bindPopup(`
        <b>${v.name || "Vaca " + v.id}</b><br>
        Temp: ${v.temp ?? "--"} °C<br>
        Ritmo: ${v.hr ?? "--"} bpm<br>
        Estado: <strong>${v.status}</strong>
      `);

      marker.on("click", () => openCowModal(v));
    });
  }

  // Búsqueda
  cowSearch.addEventListener("input", function () {
    const text = this.value.toLowerCase();
    const filtradas = vacas.filter(v => 
      (v.name || `Vaca ${v.id}`).toLowerCase().includes(text)
    );
    renderCowList(filtradas);
  });

  // Abrir modal
  function openCowModal(vaca) {
    console.log("Abriendo modal para:", vaca); // Para depurar

    document.getElementById("modalName").textContent = vaca.name || `Vaca ${vaca.id}`;
    document.getElementById("cowModal").style.display = "flex"; // Cambia a flex para centrar

    // Datos iniciales
    document.getElementById("m_temp").textContent = vaca.temp ?? "--";
    document.getElementById("m_hr").textContent = vaca.hr ?? "--";
    document.getElementById("m_act").textContent = "Normal";
    document.getElementById("m_loc").textContent = "Calle 45, Mérida";
    document.getElementById("m_state").textContent = vaca.status || "OK";

    // Crear mini-mapa fijo en Mérida
    if (currentModalMap) currentModalMap.remove();
    currentModalMap = L.map("modalMiniMap", {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      tap: false
    }).setView([20.9754, -89.6169], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(currentModalMap);

    // Pin de la vaca
    L.circleMarker([vaca.lat || 20.9754, vaca.lng || -89.6169], {
      radius: 8,
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.8
    }).addTo(currentModalMap);

    // Crear mini gráficas
    createMiniCharts();

    // Actualizar cada 3s
    if (currentInterval) clearInterval(currentInterval);
    currentInterval = setInterval(() => updateCowData(vaca.id), 3000);

    updateCowData(vaca.id); // Primera carga
  }

  // Cerrar modal
  function closeCowModal() {
    document.getElementById("cowModal").style.display = "none";
    if (currentInterval) clearInterval(currentInterval);
    if (currentModalMap) currentModalMap.remove();
    if (chartTemp) chartTemp.destroy();
    if (chartHR) chartHR.destroy();
  }

  document.getElementById("closeModal").onclick = closeCowModal;

  // Actualizar datos (simulado – cambia por tu endpoint real)
  async function updateCowData(id) {
    try {
      const data = {
        temperatura: (Math.random() * 8 + 36).toFixed(1),
        ritmo: Math.floor(Math.random() * 40 + 60),
        actividad: "Normal",
        ubicacion: "Calle 45, Mérida",
        estado: Math.random() > 0.8 ? "Alerta" : "OK"
      };

      document.getElementById("m_temp").textContent = data.temperatura;
      document.getElementById("m_hr").textContent = data.ritmo;
      document.getElementById("m_act").textContent = data.actividad;
      document.getElementById("m_loc").textContent = data.ubicacion;
      document.getElementById("m_state").textContent = data.estado;

      const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

      chartTemp.data.labels.push(now);
      chartTemp.data.datasets[0].data.push(data.temperatura);

      chartHR.data.labels.push(now);
      chartHR.data.datasets[0].data.push(data.ritmo);

      // Limitar a últimos 15 puntos
      if (chartTemp.data.labels.length > 15) {
        chartTemp.data.labels.shift();
        chartTemp.data.datasets[0].data.shift();
      }
      if (chartHR.data.labels.length > 15) {
        chartHR.data.labels.shift();
        chartHR.data.datasets[0].data.shift();
      }

      chartTemp.update();
      chartHR.update();

    } catch (err) {
      console.error("Error actualizando datos:", err);
    }
  }

  // Crear mini gráficas
  function createMiniCharts() {
    const ctxTemp = document.getElementById("chartTemp");
    const ctxHR = document.getElementById("chartHR");

    if (!ctxTemp || !ctxHR) {
      console.error("No se encuentran los canvas para gráficas");
      return;
    }

    chartTemp = new Chart(ctxTemp, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Temperatura (°C)",
          data: [],
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.2)",
          tension: 0.3,
          fill: true,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { suggestedMin: 30, suggestedMax: 45, ticks: { font: { size: 10 } } },
          x: { ticks: { font: { size: 10 } } }
        }
      }
    });

    chartHR = new Chart(ctxHR, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Ritmo (bpm)",
          data: [],
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.2)",
          tension: 0.3,
          fill: true,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { suggestedMin: 40, suggestedMax: 120, ticks: { font: { size: 10 } } },
          x: { ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  // Carga inicial
  loadVacas();
});