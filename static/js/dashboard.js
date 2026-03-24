document.addEventListener("DOMContentLoaded", () => {

  let map;
  let markers = [];
  let tempChart = null;
  let hrChart = null;
  let cowDonut = null;
  let sensorDonut = null;
  let lastSync = null;

  // Estilo común para textos en modo oscuro
  const chartTextColor = 'rgba(255, 255, 255, 0.8)';
  const chartGridColor = 'rgba(255, 255, 255, 0.05)';

  function initMap() {
    map = L.map("map", { scrollWheelZoom: false, zoomControl: true })
      .setView([20.97, -89.62], 11);

    // Tip: Puedes considerar usar un proveedor de mapas oscuros como CartoDB.DarkMatter
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);
  }

  async function updateCharts() {
    try {
      const res = await fetch("/api/datos", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const datos = await res.json();

      if (!Array.isArray(datos) || datos.length === 0) return;

      const grouped = {};
      datos.forEach(d => {
        if (d.fecha && d.id_vaca) {
          const id = d.id_vaca;
          if (!grouped[id]) grouped[id] = [];
          grouped[id].push(d);
        }
      });

      Object.keys(grouped).forEach(id => {
        grouped[id].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      });

      const allLabels = [...new Set(datos.map(d => new Date(d.fecha).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})))].sort();

      // Colores estilo Neón
      const colors = ["#00f2ff", "#7000ff", "#00ff88", "#ff0055", "#ffb300"];
      
      const createDataset = (label, data, colorIndex) => ({
        label: label,
        data: data,
        borderColor: colors[colorIndex % colors.length],
        backgroundColor: 'transparent',
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: colors[colorIndex % colors.length],
        borderWidth: 3,
        shadowBlur: 10, // Efecto neón (requiere plugin o canvas shadow)
        fill: false
      });

      // --- GRÁFICA DE TEMPERATURA ---
      const tempDatasets = Object.keys(grouped).map((id, idx) => {
        const group = grouped[id];
        const temps = allLabels.map(label => {
          const match = group.find(d => new Date(d.fecha).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) === label);
          return match ? Number(match.temp_objeto) : null;
        });
        return createDataset(`Vaca ${id}`, temps, idx);
      });

      if (tempChart) tempChart.destroy();
      tempChart = new Chart(document.getElementById("tempChart"), {
        type: "line",
        data: { labels: allLabels, datasets: tempDatasets },
        options: getChartOptions("°C", 30, 45)
      });

      // --- GRÁFICA DE RITMO CARDÍACO ---
      const hrDatasets = Object.keys(grouped).map((id, idx) => {
        const group = grouped[id];
        const hrs = allLabels.map(label => {
          const match = group.find(d => new Date(d.fecha).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) === label);
          return match ? Number(match.ritmo_cardiaco) : null;
        });
        return createDataset(`Vaca ${id}`, hrs, idx);
      });

      if (hrChart) hrChart.destroy();
      hrChart = new Chart(document.getElementById("hrChart"), {
        type: "line",
        data: { labels: allLabels, datasets: hrDatasets },
        options: getChartOptions("bpm", 40, 140)
      });

      await addThresholdLines();

    } catch (err) {
      console.error("Error en updateCharts:", err);
    }
  }

  // Función auxiliar para mantener opciones coherentes
  function getChartOptions(unit, min, max) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { color: chartTextColor, font: { family: 'Inter', size: 12 } }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1
        }
      },
      scales: {
        y: {
          suggestedMin: min,
          suggestedMax: max,
          grid: { color: chartGridColor },
          ticks: { color: chartTextColor },
          title: { display: true, text: unit, color: chartTextColor }
        },
        x: {
          grid: { display: false },
          ticks: { color: chartTextColor },
          title: { display: true, text: "Hora", color: chartTextColor }
        }
      }
    };
  }

  // Umbrales actualizados con colores neón
  async function addThresholdLines() {
    try {
      const res = await fetch("/api/config/umbral", { credentials: "same-origin" });
      if (!res.ok) return;
      const u = await res.json();

      const lineStyle = (label, val, color) => ({
        label: label,
        data: Array(tempChart.data.labels.length).fill(val),
        borderColor: color,
        borderDash: [10, 5],
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      });

      if (u.temp_max && tempChart) {
        tempChart.data.datasets.push(lineStyle(`Máx ${u.temp_max}°C`, u.temp_max, "#ff4d4d"));
        tempChart.update();
      }
      if (u.hr_max && hrChart) {
        hrChart.data.datasets.push(lineStyle(`Máx ${u.hr_max}bpm`, u.hr_max, "#ffb732"));
        hrChart.update();
      }
    } catch (e) { console.warn(e); }
  }

  function updateDonuts(cows) {
    const count = {
      ok: cows.filter(c => c.status === "ok").length,
      alert: cows.filter(c => c.status === "alert").length,
      offline: cows.filter(c => c.status === "offline").length
    };

    const donutOptions = {
      responsive: true,
      cutout: "75%",
      plugins: {
        legend: { position: "bottom", labels: { color: chartTextColor } }
      }
    };

    if (cowDonut) cowDonut.destroy();
    cowDonut = new Chart(document.getElementById("cowDonut"), {
      type: "doughnut",
      data: {
        labels: ["Normal", "Alerta", "Offline"],
        datasets: [{
          data: [count.ok, count.alert, count.offline],
          backgroundColor: ["#00ff88", "#ffb300", "#64748b"],
          borderWidth: 0
        }]
      },
      options: donutOptions
    });

    if (sensorDonut) sensorDonut.destroy();
    sensorDonut = new Chart(document.getElementById("sensorDonut"), {
      type: "doughnut",
      data: {
        labels: ["Online", "Offline"],
        datasets: [{
          data: [count.ok, cows.length - count.ok],
          backgroundColor: ["#00f2ff", "#ff4d4d"],
          borderWidth: 0
        }]
      },
      options: donutOptions
    });
  }

  async function loadDashboard() {
    try {
      const res = await fetch("/api/dashboard", { credentials: "same-origin" });
      const data = await res.json();
      if (!data.cows || (lastSync && data.last_sync === lastSync)) return;

      lastSync = data.last_sync;
      const cows = data.cows;

      document.getElementById("stat-total").textContent = cows.length;
      document.getElementById("stat-alerts").textContent = cows.filter(c => c.status === "alert").length;
      document.getElementById("stat-offline").textContent = cows.filter(c => c.status === "offline").length;
      document.getElementById("stat-updated").textContent = data.last_sync || "--:--:--";
      document.getElementById("sys-sensors").textContent = `${cows.filter(c => c.status === "ok").length} / ${cows.length}`;

      const alertsList = document.getElementById("alertsList");
      alertsList.innerHTML = "";
      (data.alerts || []).forEach(a => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${a.cow}</strong> — ${a.text} <small style="color:rgba(255,255,255,0.4)">(${a.time})</small>`;
        alertsList.appendChild(li);
      });

      markers.forEach(m => map.removeLayer(m));
      markers = [];

      cows.forEach(cow => {
        if (!cow.lat || !cow.lng) return;
        const color = cow.status === "ok" ? "#00ff88" : cow.status === "alert" ? "#ffb300" : "#64748b";
        const marker = L.circleMarker([cow.lat, cow.lng], {
          radius: 10,
          color: "#fff",
          fillColor: color,
          fillOpacity: 0.9,
          weight: 2
        }).addTo(map);

        marker.bindPopup(`<div style="color:#333"><b>${cow.name || "Vaca "+cow.id}</b><br>Temp: ${cow.temp ?? "--"} °C<br>Estado: ${cow.status}</div>`);
        markers.push(marker);
      });

      if (markers.length > 0) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));

      updateDonuts(cows);
      await updateCharts();

    } catch (err) { console.error(err); }
  }

  initMap();
  loadDashboard();
  setInterval(loadDashboard, 15000);
});