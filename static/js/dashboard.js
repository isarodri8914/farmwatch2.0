// static/js/dashboard.js
document.addEventListener("DOMContentLoaded", () => {

  let map;
  let markers = [];
  let tempChart = null;
  let hrChart = null;
  let cowDonut = null;
  let sensorDonut = null;

  // ────────────────────────────────────────────────
  // Inicializar mapa centrado en Mérida, Yucatán
  // ────────────────────────────────────────────────
  function initMap() {
    map = L.map("map", {
      scrollWheelZoom: false,
      zoomControl: true
    }).setView([20.97, -89.62], 11);  // Mérida + algo de alrededores

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
  }

  // ────────────────────────────────────────────────
  // Gráficas de líneas (últimas 12 h)
  // ────────────────────────────────────────────────
  async function updateCharts() {
    try {
      const res = await fetch("/api/datos");
      if (!res.ok) throw new Error("Error al cargar /api/datos");
      const datos = await res.json();

      if (!Array.isArray(datos) || datos.length === 0) {
        document.querySelector(".chart-row").innerHTML = "<p style='text-align:center;padding:2rem;'>Sin datos recientes</p>";
        return;
      }

      const now = new Date();
      const twelveHoursAgo = new Date(now - 12 * 60 * 60 * 1000);

      // Filtrar y ordenar (más antiguo → más reciente)
      const recent = datos
        .filter(d => d.fecha && new Date(d.fecha) >= twelveHoursAgo)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      if (recent.length === 0) {
        document.querySelector(".chart-row").innerHTML = "<p style='text-align:center;padding:2rem;'>No hay datos en las últimas 12 horas</p>";
        return;
      }

      // Promedios (para mostrar en tarjetas si quieres, pero ya tienes canvas)
      const avgTemp = (recent.reduce((s, d) => s + (Number(d.temp_objeto) || 0), 0) / recent.length).toFixed(1);
      const avgHr   = (recent.reduce((s, d) => s + (Number(d.ritmo_cardiaco) || 0), 0) / recent.length).toFixed(0);

      // Puedes mostrarlos en algún lugar si agregas <span id="avgTemp">...</span> en HTML
      // document.getElementById("avgTemp").textContent = avgTemp;

      const labels = recent.map(d => {
        const date = new Date(d.fecha);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      });

      const temps = recent.map(d => Number(d.temp_objeto) || null);
      const hrs   = recent.map(d => Number(d.ritmo_cardiaco) || null);

      // Temperatura
      if (tempChart) tempChart.destroy();
      tempChart = new Chart(document.getElementById("tempChart"), {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Temperatura objeto (°C)",
            data: temps,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            tension: 0.3,
            fill: true,
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
          scales: { y: { suggestedMin: 30, suggestedMax: 42 } }
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
            pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
          scales: { y: { suggestedMin: 40, suggestedMax: 120 } }
        }
      });

    } catch (err) {
      console.error("Error al cargar/gráficar datos:", err);
    }
  }

  // ────────────────────────────────────────────────
  // Donuts (estado hato y sensores)
  // ────────────────────────────────────────────────
  function updateDonuts(cows) {
    const statusCount = {
      ok: cows.filter(c => c.status === "ok").length,
      alert: cows.filter(c => c.status === "alert").length,
      offline: cows.filter(c => c.status === "offline").length
    };

    const sensorOk = statusCount.ok;
    const sensorTotal = cows.length;

    // Donut hato (vacas)
    if (cowDonut) cowDonut.destroy();
    cowDonut = new Chart(document.getElementById("cowDonut"), {
      type: "doughnut",
      data: {
        labels: ["Normal", "Alerta", "Offline"],
        datasets: [{
          data: [statusCount.ok, statusCount.alert, statusCount.offline],
          backgroundColor: ["#10b981", "#f97316", "#9ca3af"],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        cutout: "65%",
        plugins: {
          legend: { position: "bottom" },
          tooltip: { enabled: true }
        }
      }
    });

    // Donut sensores (similar, pero puedes diferenciar si tienes más info)
    if (sensorDonut) sensorDonut.destroy();
    sensorDonut = new Chart(document.getElementById("sensorDonut"), {
      type: "doughnut",
      data: {
        labels: ["Online", "Offline / Problema"],
        datasets: [{
          data: [sensorOk, sensorTotal - sensorOk],
          backgroundColor: ["#10b981", "#ef4444"],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        cutout: "65%",
        plugins: {
          legend: { position: "bottom" }
        }
      }
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

      // Tarjetas resumen
      document.getElementById("stat-total").textContent   = cows.length;
      document.getElementById("stat-alerts").textContent  = cows.filter(c => c.status === "alert").length;
      document.getElementById("stat-offline").textContent = cows.filter(c => c.status === "offline").length;

      // "Última sync" → preferimos last_sync si lo agregaste al backend
      document.getElementById("stat-updated").textContent = data.last_sync || data.last_update || "--:--:--";

      document.getElementById("sys-sensors").textContent =
        cows.filter(c => c.status === "ok").length + " / " + cows.length;

      // Alertas recientes
      const alertsList = document.getElementById("alertsList");
      alertsList.innerHTML = "";
      (data.alerts || []).forEach(a => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${a.cow}</strong> — ${a.text} <small>(${a.time})</small>`;
        alertsList.appendChild(li);
      });

      // Mapa: limpiar y agregar nuevos marcadores
      markers.forEach(m => map.removeLayer(m));
      markers = [];

      cows.forEach(cow => {
        if (!cow.lat || !cow.lng) return;

        const color = cow.status === "ok" ? "#10b981" :
                      cow.status === "alert" ? "#f97316" : "#9ca3af";

        const marker = L.circleMarker([cow.lat, cow.lng], {
          radius: 11,
          color: color,
          fillColor: color,
          fillOpacity: 0.75,
          weight: 2
        }).addTo(map);

        marker.bindPopup(`
          <b>${cow.name || "Vaca " + cow.id}</b><br>
          Temp: ${cow.temp ?? "—"} °C<br>
          Ritmo: ${cow.hr ?? "—"} bpm<br>
          Estado: <strong>${cow.status}</strong>
        `);

        markers.push(marker);
      });

      // Ajustar vista solo la primera vez o si hay muchos cambios (evita saltos molestos)
      if (markers.length > 0 && !map._fitBoundsOnce) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
        map._fitBoundsOnce = true;  // bandera para no repetir
      }

      // Actualizar gráficas y donuts
      await updateCharts();
      updateDonuts(cows);

    } catch (err) {
      console.error("Error cargando dashboard:", err);
    }
  }

  // Inicio
  initMap();
  loadDashboard();

  // Refrescar cada 10–15 segundos (menos agresivo que 5s)
  setInterval(loadDashboard, 12000);

});