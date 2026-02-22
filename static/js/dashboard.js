document.addEventListener("DOMContentLoaded", () => {

  let map;
  let markers = [];
  let tempChart = null;
  let hrChart = null;
  let cowDonut = null;
  let sensorDonut = null;

  // ────────────────────────────────────────────────
  // Inicializar mapa centrado en Mérida
  // ────────────────────────────────────────────────
  function initMap() {
    map = L.map("map", { scrollWheelZoom: false, zoomControl: true })
      .setView([20.97, -89.62], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
  }

  // ────────────────────────────────────────────────
  // Gráficas grandes, una debajo de la otra, con puntos visibles
  // ────────────────────────────────────────────────
  async function updateCharts() {
    try {
      const res = await fetch("/api/datos");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const datos = await res.json();

      if (!Array.isArray(datos) || datos.length === 0) {
        document.querySelector(".chart-row").innerHTML += "<p style='text-align:center; padding:3rem; color:#666;'>Sin datos disponibles</p>";
        return;
      }

      // Tomar los últimos 20 datos (suficiente para ver tendencia sin saturar)
      const sorted = datos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      const recent = sorted.slice(-20);

      const labels = recent.map(d => new Date(d.fecha).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
      const temps = recent.map(d => Number(d.temp_objeto) || null);
      const hrs   = recent.map(d => Number(d.ritmo_cardiaco) || null);

      // Temperatura
      if (tempChart) tempChart.destroy();
      tempChart = new Chart(document.getElementById("tempChart"), {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Temperatura (°C)",
            data: temps,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            tension: 0.3,
            fill: true,
            pointRadius: 6,
            pointBackgroundColor: "#ef4444",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointHoverRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { font: { size: 14 } } },
            tooltip: { mode: "index", intersect: false }
          },
          scales: {
            y: { suggestedMin: 30, suggestedMax: 45, title: { display: true, text: "°C" } },
            x: { title: { display: true, text: "Hora" } }
          }
        }
      });

      // Ritmo cardíaco
      if (hrChart) hrChart.destroy();
      hrChart = new Chart(document.getElementById("hrChart"), {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Ritmo cardíaco (bpm)",
            data: hrs,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.15)",
            tension: 0.3,
            fill: true,
            pointRadius: 6,
            pointBackgroundColor: "#3b82f6",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointHoverRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { font: { size: 14 } } },
            tooltip: { mode: "index", intersect: false }
          },
          scales: {
            y: { suggestedMin: 40, suggestedMax: 140, title: { display: true, text: "bpm" } },
            x: { title: { display: true, text: "Hora" } }
          }
        }
      });

      // Líneas de umbrales
      await addThresholdLines();

    } catch (err) {
      console.error("Error cargando gráficas:", err);
    }
  }

  // ────────────────────────────────────────────────
  // Líneas de umbrales (tu función, ya integrada)
  // ────────────────────────────────────────────────
  async function addThresholdLines() {
    try {
      const res = await fetch("/api/config/umbral");
      if (!res.ok) return;
      const umbrales = await res.json();

      if (umbrales.temp_max && tempChart) {
        tempChart.data.datasets.push({
          label: `Umbral Máx (${umbrales.temp_max} °C)`,
          data: Array(tempChart.data.labels.length).fill(umbrales.temp_max),
          borderColor: "#dc2626",
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        });
        tempChart.update();
      }

      if (umbrales.temp_min && tempChart) {
        tempChart.data.datasets.push({
          label: `Umbral Mín (${umbrales.temp_min} °C)`,
          data: Array(tempChart.data.labels.length).fill(umbrales.temp_min),
          borderColor: "#60a5fa",
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        });
        tempChart.update();
      }

      if (umbrales.hr_max && hrChart) {
        hrChart.data.datasets.push({
          label: `Umbral Máx (${umbrales.hr_max} bpm)`,
          data: Array(hrChart.data.labels.length).fill(umbrales.hr_max),
          borderColor: "#f97316",
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        });
        hrChart.update();
      }
    } catch (err) {
      console.warn("Umbrales no cargados:", err);
    }
  }

  // ────────────────────────────────────────────────
  // Donuts de estado
  // ────────────────────────────────────────────────
  function updateDonuts(cows) {
    const statusCount = {
      ok: cows.filter(c => c.status === "ok").length,
      alert: cows.filter(c => c.status === "alert").length,
      offline: cows.filter(c => c.status === "offline").length
    };

    if (cowDonut) cowDonut.destroy();
    cowDonut = new Chart(document.getElementById("cowDonut"), {
      type: "doughnut",
      data: {
        labels: ["Normal", "Alerta", "Offline"],
        datasets: [{
          data: [statusCount.ok, statusCount.alert, statusCount.offline],
          backgroundColor: ["#10b981", "#f97316", "#9ca3af"]
        }]
      },
      options: { responsive: true, cutout: "65%", plugins: { legend: { position: "bottom" } } }
    });

    if (sensorDonut) sensorDonut.destroy();
    sensorDonut = new Chart(document.getElementById("sensorDonut"), {
      type: "doughnut",
      data: {
        labels: ["Online", "Problema/Offline"],
        datasets: [{
          data: [statusCount.ok, cows.length - statusCount.ok],
          backgroundColor: ["#10b981", "#ef4444"]
        }]
      },
      options: { responsive: true, cutout: "65%", plugins: { legend: { position: "bottom" } } }
    });
  }

  // ────────────────────────────────────────────────
  // Carga principal del dashboard
  // ────────────────────────────────────────────────
  async function loadDashboard() {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Error en /api/dashboard");
      const data = await res.json();

      if (!data.cows) return;

      const cows = data.cows;

      document.getElementById("stat-total").textContent = cows.length;
      document.getElementById("stat-alerts").textContent = cows.filter(c => c.status === "alert").length;
      document.getElementById("stat-offline").textContent = cows.filter(c => c.status === "offline").length;
      document.getElementById("stat-updated").textContent = data.last_sync || data.last_update || "--:--:--";

      document.getElementById("sys-sensors").textContent = 
        cows.filter(c => c.status === "ok").length + " / " + cows.length;

      // Alertas
      const alertsList = document.getElementById("alertsList");
      alertsList.innerHTML = "";
      (data.alerts || []).forEach(a => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${a.cow}</strong> — ${a.text} <small>(${a.time})</small>`;
        alertsList.appendChild(li);
      });

      // Mapa
      markers.forEach(m => map.removeLayer(m));
      markers = [];

      cows.forEach(cow => {
        if (!cow.lat || !cow.lng) return;
        const color = cow.status === "ok" ? "#10b981" : cow.status === "alert" ? "#f97316" : "#9ca3af";
        const marker = L.circleMarker([cow.lat, cow.lng], {
          radius: 11,
          color: color,
          fillColor: color,
          fillOpacity: 0.75,
          weight: 2
        }).addTo(map);

        marker.bindPopup(`<b>${cow.name || "Vaca " + cow.id}</b><br>Temp: ${cow.temp ?? "--"} °C<br>Ritmo: ${cow.hr ?? "--"} bpm<br>Estado: <strong>${cow.status}</strong>`);
        markers.push(marker);
      });

      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
      }

      // Actualizar gráficas y donuts
      updateDonuts(cows);
      await updateCharts();

    } catch (err) {
      console.error("Error en loadDashboard:", err);
    }
  }

  // ────────────────────────────────────────────────
  // Selector pequeño y profesional arriba de las gráficas
  // ────────────────────────────────────────────────
  function initCowSelect() {
    const chartRow = document.querySelector(".chart-row");
    if (!chartRow) return;

    const container = document.createElement("div");
    container.className = "filter-container";
    container.style.textAlign = "center";
    container.style.margin = "1rem 0 1.5rem 0";

    const label = document.createElement("label");
    label.textContent = "Mostrar: ";
    label.style.marginRight = "8px";
    label.style.fontWeight = "500";
    label.style.color = "#374151";

    const select = document.createElement("select");
    select.id = "cowSelect";
    select.innerHTML = '<option value="all">Todas las vacas</option>';

    container.appendChild(label);
    container.appendChild(select);
    chartRow.prepend(container);

    // Evento de cambio (por ahora no filtra, pero lo dejamos preparado)
    select.addEventListener("change", e => {
      console.log("Filtro seleccionado:", e.target.value);
      // Aquí puedes llamar a updateCharts(e.target.value) cuando implementes el filtro por vaca
    });
  }

  // Inicio
  initMap();
  initCowSelect();
  loadDashboard();
  setInterval(loadDashboard, 15000);  // refresco cada 15 segundos
});