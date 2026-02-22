// static/js/dashboard.js
document.addEventListener("DOMContentLoaded", () => {

  let map;
  let markers = [];
  let tempChart = null;
  let hrChart = null;
  let cowDonut = null;
  let sensorDonut = null;
  let allData = [];  // Para guardar los datos recientes y reutilizar en filtros

  // Inicializar mapa centrado en Mérida, Yucatán
  function initMap() {
    map = L.map("map", { scrollWheelZoom: false, zoomControl: true })
      .setView([20.97, -89.62], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
  }

  // Gráficas de líneas (con separación por vaca y límite de datos)
  async function updateCharts(selectedCow = "all") {
    try {
      const res = await fetch("/api/datos");
      if (!res.ok) throw new Error("Error al cargar /api/datos");
      const datos = await res.json();

      if (!Array.isArray(datos) || datos.length === 0) {
        document.querySelector(".chart-row").innerHTML = "<p style='text-align:center; padding:3rem; color:#666;'>Sin datos recientes</p>";
        return;
      }

      const now = new Date();
      const twelveHoursAgo = new Date(now - 12 * 60 * 60 * 1000);

      // Filtrar recientes y agrupar por vaca
      const grouped = {};
      datos.forEach(d => {
        if (d.fecha && new Date(d.fecha) >= twelveHoursAgo) {
          const id = d.id_vaca;
          if (!grouped[id]) grouped[id] = [];
          grouped[id].push(d);
        }
      });

      // Ordenar cada grupo por fecha y limitar a últimos 10
      Object.keys(grouped).forEach(id => {
        grouped[id].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
        grouped[id] = grouped[id].slice(-10);  // últimos 10 (cambia a -5 si quieres menos)
      });

      allData = grouped;  // Guardar para filtrado

      // Filtrar si se seleccionó una vaca específica
      let filteredGroups = grouped;
      if (selectedCow !== "all" && grouped[selectedCow]) {
        filteredGroups = { [selectedCow]: grouped[selectedCow] };
      }

      if (Object.keys(filteredGroups).length === 0) {
        document.querySelector(".chart-row").innerHTML = "<p style='text-align:center; padding:3rem; color:#666;'>No hay datos para la vaca seleccionada</p>";
        return;
      }

      // Colores por vaca (genera colores automáticos)
      const colors = ["#ef4444", "#3b82f6", "#10b981", "#f97316", "#a855f7"];  // rojo, azul, verde, naranja, púrpura
      let colorIndex = 0;

      // Preparar datasets para temperatura
      const tempDatasets = [];
      Object.keys(filteredGroups).forEach(id => {
        const group = filteredGroups[id];
        const labels = group.map(d => new Date(d.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        const temps = group.map(d => Number(d.temp_objeto) || null);

        tempDatasets.push({
          label: `Vaca ${id}`,
          data: temps,
          borderColor: colors[colorIndex % colors.length],
          backgroundColor: `rgba(${parseInt(colors[colorIndex % colors.length].slice(1,3),16)}, ${parseInt(colors[colorIndex % colors.length].slice(3,5),16)}, ${parseInt(colors[colorIndex % colors.length].slice(5,7),16)}, 0.15)`,
          tension: 0.3,
          fill: true,
          pointRadius: 4
        });
        colorIndex++;
      });

      // Temperatura
      if (tempChart) tempChart.destroy();
      tempChart = new Chart(document.getElementById("tempChart"), {
        type: "line",
        data: { datasets: tempDatasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.dataset.label || "";
                  const value = context.parsed.y;
                  const time = context.label;
                  return `${label}: ${value} °C a las ${time}`;
                }
              }
            }
          },
          scales: {
            y: { suggestedMin: 30, suggestedMax: 42, title: { display: true, text: "°C" } },
            x: { title: { display: true, text: "Hora" } }
          }
        }
      });

      // Repite para ritmo cardíaco (datasets similares)
      const hrDatasets = [];
      colorIndex = 0;  // reset color
      Object.keys(filteredGroups).forEach(id => {
        const group = filteredGroups[id];
        const hrs = group.map(d => Number(d.ritmo_cardiaco) || null);

        hrDatasets.push({
          label: `Vaca ${id}`,
          data: hrs,
          borderColor: colors[colorIndex % colors.length],
          backgroundColor: `rgba(${parseInt(colors[colorIndex % colors.length].slice(1,3),16)}, ${parseInt(colors[colorIndex % colors.length].slice(3,5),16)}, ${parseInt(colors[colorIndex % colors.length].slice(5,7),16)}, 0.15)`,
          tension: 0.3,
          fill: true,
          pointRadius: 4
        });
        colorIndex++;
      });

      if (hrChart) hrChart.destroy();
      hrChart = new Chart(document.getElementById("hrChart"), {
        type: "line",
        data: { datasets: hrDatasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top" },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.dataset.label || "";
                  const value = context.parsed.y;
                  const time = context.label;
                  return `${label}: ${value} bpm a las ${time}`;
                }
              }
            }
          },
          scales: {
            y: { suggestedMin: 40, suggestedMax: 120, title: { display: true, text: "bpm" } },
            x: { title: { display: true, text: "Hora" } }
          }
        }
      });

    } catch (err) {
      console.error("Error al cargar/gráficar datos:", err);
    }
  }

  // ... (el resto del código sigue igual: updateDonuts, loadDashboard, initMap, setInterval)

  // En loadDashboard, llama a updateCharts
  async function loadDashboard() {
    // ... (código actual para tarjetas, alertas, mapa) ...

    await updateCharts();  // ← llama sin filtro inicial (muestra todas)
  }

  // Agregar dropdown para seleccionar vaca (opcional, pero útil si hay muchas)
  // Agrega esto después de initMap()
  function initCowSelect() {
    const select = document.createElement("select");
    select.id = "cowSelect";
    select.style.margin = "1rem 0";
    select.style.display = "block";
    select.innerHTML = '<option value="all">Todas las vacas</option>';  // default

    // Insertar antes de las gráficas
    document.querySelector(".chart-row").prepend(select);

    select.addEventListener("change", (e) => {
      updateCharts(e.target.value);
    });
  }

  // Llama en el inicio
  initCowSelect();

  // Al cargar datos en loadDashboard, actualiza el select con vacas disponibles
  // Dentro de loadDashboard, después de procesar cows
  const select = document.getElementById("cowSelect");
  select.innerHTML = '<option value="all">Todas las vacas</option>';
  cows.forEach(c => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.name || `Vaca ${c.id}`;
    select.appendChild(option);
  });

  // ... (fin de loadDashboard)

  initMap();
  loadDashboard();
  setInterval(loadDashboard, 12000);
});