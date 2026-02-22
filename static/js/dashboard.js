document.addEventListener("DOMContentLoaded", () => {

  let map;
  let markers = [];
  let tempChart = null;
  let hrChart = null;
  let cowDonut = null;
  let sensorDonut = null;
  let allData = [];

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
  // Gráficas avanzadas (por vaca, últimos 10, tooltips claros)
  // ────────────────────────────────────────────────
async function updateCharts() {
  try {
    const res = await fetch("/api/datos");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const datos = await res.json();

    if (!datos.length) {
      document.querySelector(".chart-row").innerHTML += "<p style='text-align:center; padding:2rem;'>Sin datos</p>";
      return;
    }

    const sorted = datos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const recent = sorted.slice(-20); // últimos 20 para no saturar

    const labels = recent.map(d => new Date(d.fecha).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}));
    const temps = recent.map(d => Number(d.temp_objeto) || null);
    const hrs   = recent.map(d => Number(d.ritmo_cardiaco) || null);

    if (tempChart) tempChart.destroy();
    tempChart = new Chart(document.getElementById("tempChart"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Temperatura (°C)",
          data: temps,
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.15)",
          tension: 0.3,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: "#ef4444"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
        scales: { y: { suggestedMin: 30, suggestedMax: 45 } }
      }
    });

    if (hrChart) hrChart.destroy();
    hrChart = new Chart(document.getElementById("hrChart"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Ritmo cardíaco (bpm)",
          data: hrs,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.15)",
          tension: 0.3,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: "#3b82f6"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
        scales: { y: { suggestedMin: 40, suggestedMax: 140 } }
      }
    });

    await addThresholdLines();

  } catch (err) {
    console.error(err);
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
  // Carga principal
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

      // Actualizar dropdown con vacas
      const select = document.getElementById("cowSelect");
      if (select) {
        select.innerHTML = '<option value="all">Todas las vacas</option>';
        cows.forEach(c => {
          const opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.name || `Vaca ${c.id}`;
          select.appendChild(opt);
        });
      }

    } catch (err) {
      console.error("Error en loadDashboard:", err);
    }
  }

  // ────────────────────────────────────────────────
  // Dropdown de vacas
  // ────────────────────────────────────────────────
function initCowSelect() {
  const chartRow = document.querySelector(".chart-row");
  if (!chartRow) return;

  const container = document.createElement("div");
  container.style.textAlign = "center";
  container.style.margin = "1.5rem 0 1rem 0";

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

  select.addEventListener("change", e => updateCharts(e.target.value));
}

  // Inicio
  initMap();
  initCowSelect();
  loadDashboard();
  setInterval(loadDashboard, 15000);  // cada 15s para no saturar
});