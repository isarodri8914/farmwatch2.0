document.addEventListener("DOMContentLoaded", () => {

  let map;
  let markers = [];
  let tempChart = null;
  let hrChart = null;
  let cowDonut = null;
  let sensorDonut = null;

  function initMap() {
    map = L.map("map", { scrollWheelZoom: false, zoomControl: true })
      .setView([20.97, -89.62], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
  }

  // ────────────────────────────────────────────────
  // Gráficas con corrección de Labels y Alineación
  // ────────────────────────────────────────────────
  async function updateCharts(selectedCow = "all") {
    try {
      const res = await fetch("/api/datos");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const datos = await res.json();

      if (!Array.isArray(datos) || datos.length === 0) {
        console.warn("No hay datos en la API");
        return;
      }

      // 1. Obtener todas las etiquetas de tiempo únicas y ordenadas (Eje X)
      const todasLasFechas = [...new Set(datos.map(d => d.fecha))].sort((a, b) => new Date(a) - new Date(b));
      const globalLabels = todasLasFechas.map(f => 
        new Date(f).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );

      // 2. Agrupar datos por vaca
      const grouped = {};
      datos.forEach(d => {
        const id = d.id_vaca || "Desconocida";
        if (!grouped[id]) grouped[id] = [];
        grouped[id].push(d);
      });

      let filteredIds = (selectedCow !== "all") ? [selectedCow] : Object.keys(grouped);
      const colors = ["#ef4444", "#3b82f6", "#10b981", "#f97316", "#a855f7"];

      // 3. Preparar Datasets (Temperatura)
      const tempDatasets = filteredIds.map((id, index) => {
        const vacaData = grouped[id] || [];
        // Mapear datos a la línea de tiempo global (pone null si no hay dato en esa hora)
        const alignedTemps = todasLasFechas.map(fecha => {
          const registro = vacaData.find(d => d.fecha === fecha);
          return registro ? Number(registro.temp_objeto) : null;
        });

        return {
          label: `Vaca ${id}`,
          data: alignedTemps,
          borderColor: colors[index % colors.length],
          backgroundColor: `${colors[index % colors.length]}26`, // 15% opacidad
          tension: 0.3,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 8
        };
      });

      // 4. Preparar Datasets (Ritmo Cardíaco)
      const hrDatasets = filteredIds.map((id, index) => {
        const vacaData = grouped[id] || [];
        const alignedHR = todasLasFechas.map(fecha => {
          const registro = vacaData.find(d => d.fecha === fecha);
          return registro ? Number(registro.ritmo_cardiaco) : null;
        });

        return {
          label: `Vaca ${id}`,
          data: alignedHR,
          borderColor: colors[index % colors.length],
          backgroundColor: `${colors[index % colors.length]}26`,
          tension: 0.3,
          fill: true,
          pointRadius: 5,
          pointHoverRadius: 8
        };
      });

      // Renderizar Gráfica Temperatura
      if (tempChart) tempChart.destroy();
      tempChart = new Chart(document.getElementById("tempChart"), {
        type: "line",
        data: { labels: globalLabels, datasets: tempDatasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { suggestedMin: 34, suggestedMax: 42, title: { display: true, text: "°C" } }
          }
        }
      });

      // Renderizar Gráfica Ritmo Cardíaco
      if (hrChart) hrChart.destroy();
      hrChart = new Chart(document.getElementById("hrChart"), {
        type: "line",
        data: { labels: globalLabels, datasets: hrDatasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { suggestedMin: 40, suggestedMax: 120, title: { display: true, text: "bpm" } }
          }
        }
      });

      // Añadir líneas de umbral después de crear las gráficas
      await addThresholdLines();

    } catch (err) {
      console.error("Error en updateCharts:", err);
    }
  }

  async function addThresholdLines() {
    try {
      const res = await fetch("/api/config/umbral");
      if (!res.ok) return;
      const umbrales = await res.json();
      const len = tempChart.data.labels.length;

      if (umbrales.temp_max && tempChart) {
        tempChart.data.datasets.push({
          label: `Máx (${umbrales.temp_max}°C)`,
          data: Array(len).fill(umbrales.temp_max),
          borderColor: "#dc2626",
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        });
        tempChart.update();
      }
      // Repetir lógica similar para HR si es necesario...
    } catch (e) { console.warn("Umbrales no cargados"); }
  }

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
      options: { responsive: true, cutout: "70%" }
    });
    
    // Simplificado: Solo un donut funcional de ejemplo, puedes replicar para sensorDonut
  }

  async function loadDashboard() {
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (!data.cows) return;

      // Actualizar Contadores
      document.getElementById("stat-total").textContent = data.cows.length;
      document.getElementById("stat-alerts").textContent = data.cows.filter(c => c.status === "alert").length;

      // Mapa
      markers.forEach(m => map.removeLayer(m));
      markers = [];
      data.cows.forEach(cow => {
        if (!cow.lat || !cow.lng) return;
        const color = cow.status === "ok" ? "#10b981" : "#f97316";
        const marker = L.circleMarker([cow.lat, cow.lng], {
          radius: 10, color: color, fillColor: color, fillOpacity: 0.8
        }).addTo(map);
        markers.push(marker);
      });

      updateDonuts(data.cows);
      // Solo actualizamos las gráficas si el selector está en "all" o carga inicial
      const currentSelect = document.getElementById("cowSelect")?.value || "all";
      await updateCharts(currentSelect);

    } catch (err) { console.error("Error Dashboard:", err); }
  }

  function initCowSelect() {
    const select = document.getElementById("cowSelect");
    if (!select) return;
    select.addEventListener("change", (e) => updateCharts(e.target.value));
  }

  initMap();
  initCowSelect();
  loadDashboard();
  setInterval(loadDashboard, 30000); // 30 segundos para no saturar
});