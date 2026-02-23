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
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
  }

  // Gráficas con leyenda interactiva (clic para ocultar/mostrar vaca)
  async function updateCharts() {
    try {
      const res = await fetch("/api/datos");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const datos = await res.json();

      if (!Array.isArray(datos) || datos.length === 0) {
        document.querySelector(".chart-row").innerHTML += "<p style='text-align:center; padding:3rem; color:#666;'>Sin datos disponibles</p>";
        return;
      }

      // Agrupar por vaca
      const grouped = {};
      datos.forEach(d => {
        if (d.fecha && d.id_vaca) {
          const id = d.id_vaca;
          if (!grouped[id]) grouped[id] = [];
          grouped[id].push(d);
        }
      });

      // Ordenar cada grupo por fecha
      Object.keys(grouped).forEach(id => {
        grouped[id].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      });

      if (Object.keys(grouped).length === 0) {
        document.querySelector(".chart-row").innerHTML += "<p style='text-align:center; padding:3rem; color:#666;'>No hay datos con vacas</p>";
        return;
      }

      // --- CORRECCIÓN: Generar etiquetas globales para el eje X ---
      const allLabels = [...new Set(datos.map(d => new Date(d.fecha).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})))].sort();

      const colors = ["#ef4444", "#3b82f6", "#10b981", "#f97316", "#a855f7"];
      let colorIndex = 0;

      // Datasets temperatura
      const tempDatasets = [];
      Object.keys(grouped).forEach(id => {
        const group = grouped[id];
        // Alineamos los datos con las etiquetas globales
        const temps = allLabels.map(label => {
            const match = group.find(d => new Date(d.fecha).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) === label);
            return match ? Number(match.temp_objeto) : null;
        });

        tempDatasets.push({
          label: `Vaca ${id}`,
          data: temps,
          borderColor: colors[colorIndex % colors.length],
          backgroundColor: `rgba(${parseInt(colors[colorIndex % colors.length].slice(1,3),16)}, ${parseInt(colors[colorIndex % colors.length].slice(3,5),16)}, ${parseInt(colors[colorIndex % colors.length].slice(5,7),16)}, 0.15)`,
          tension: 0.3,
          fill: true,
          pointRadius: 6,
          pointBackgroundColor: colors[colorIndex % colors.length],
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointHoverRadius: 9
        });
        colorIndex++;
      });

      if (tempChart) tempChart.destroy();
      tempChart = new Chart(document.getElementById("tempChart"), {
        type: "line",
        data: { labels: allLabels, datasets: tempDatasets }, // Se agregaron las labels aquí
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: { font: { size: 13 } },
              onClick: (e, legendItem, legend) => {
                const index = legendItem.datasetIndex;
                const ci = legend.chart;
                const meta = ci.getDatasetMeta(index);
                meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
                ci.update();
              }
            },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y ?? '--'} °C a las ${ctx.label}`
              }
            }
          },
          scales: {
            y: { suggestedMin: 30, suggestedMax: 45, title: { display: true, text: "°C" } },
            x: { title: { display: true, text: "Hora" } }
          }
        }
      });

      // Datasets ritmo cardíaco
      const hrDatasets = [];
      colorIndex = 0;
      Object.keys(grouped).forEach(id => {
        const group = grouped[id];
        const hrs = allLabels.map(label => {
            const match = group.find(d => new Date(d.fecha).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) === label);
            return match ? Number(match.ritmo_cardiaco) : null;
        });

        hrDatasets.push({
          label: `Vaca ${id}`,
          data: hrs,
          borderColor: colors[colorIndex % colors.length],
          backgroundColor: `rgba(${parseInt(colors[colorIndex % colors.length].slice(1,3),16)}, ${parseInt(colors[colorIndex % colors.length].slice(3,5),16)}, ${parseInt(colors[colorIndex % colors.length].slice(5,7),16)}, 0.15)`,
          tension: 0.3,
          fill: true,
          pointRadius: 6,
          pointBackgroundColor: colors[colorIndex % colors.length],
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointHoverRadius: 9
        });
        colorIndex++;
      });

      if (hrChart) hrChart.destroy();
      hrChart = new Chart(document.getElementById("hrChart"), {
        type: "line",
        data: { labels: allLabels, datasets: hrDatasets }, // Se agregaron las labels aquí
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: { font: { size: 13 } },
              onClick: (e, legendItem, legend) => {
                const index = legendItem.datasetIndex;
                const ci = legend.chart;
                const meta = ci.getDatasetMeta(index);
                meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
                ci.update();
              }
            },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y ?? '--'} bpm a las ${ctx.label}`
              }
            }
          },
          scales: {
            y: { suggestedMin: 40, suggestedMax: 140, title: { display: true, text: "bpm" } },
            x: { title: { display: true, text: "Hora" } }
          }
        }
      });

      await addThresholdLines();

    } catch (err) {
      console.error("Error en updateCharts:", err);
    }
  }

  // Umbrales (sin cambios)
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

  // Donuts (sin cambios)
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

  // Carga principal
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

      const alertsList = document.getElementById("alertsList");
      alertsList.innerHTML = "";
      (data.alerts || []).forEach(a => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${a.cow}</strong> — ${a.text} <small>(${a.time})</small>`;
        alertsList.appendChild(li);
      });

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

      updateDonuts(cows);
      await updateCharts();

    } catch (err) {
      console.error("Error en loadDashboard:", err);
    }
  }

  // Inicio
  initMap();
  loadDashboard();
  setInterval(loadDashboard, 15000);
});