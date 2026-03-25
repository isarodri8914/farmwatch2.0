document.addEventListener("DOMContentLoaded", () => {
    
    let map;
    let markers = [];
    let tempChart = null;
    let hrChart = null;
    let cowDonut = null;
    let sensorDonut = null;
    let lastSync = null; 
    let gyroChart = null;

  function initMap() {
    map = L.map("map", { scrollWheelZoom: false, zoomControl: true })
      .setView([20.97, -89.62], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
  }

  // Clasificador lógico de comportamiento (Para el reporte de ingeniería)
    function obtenerEstadoVaca(magnitud) {
        if (!magnitud || magnitud < 0.3) return "Reposo";
        if (magnitud < 1.8) return "Rumia/Descanso";
        if (magnitud < 4.5) return "Pastoreo";
        return "Actividad Alta";
    }
  // Gráficas con leyenda interactiva (clic para ocultar/mostrar vaca)
async function updateCharts() {
        try {
            const res = await fetch("/api/datos", { credentials: "same-origin" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const datos = await res.json();

            if (!Array.isArray(datos) || datos.length === 0) return;

            // 1. Agrupar y ordenar
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

            // 2. Eje X único
            const allLabels = [...new Set(datos.map(d => 
                new Date(d.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            ))].sort();

            const colors = ["#ef4444", "#3b82f6", "#10b981", "#f97316", "#a855f7"];
            
            const tempDatasets = [];
            const hrDatasets = [];
            const actividadDatasets = [];
            let colorIndex = 0;

            Object.keys(grouped).forEach(id => {
                const group = grouped[id];
                const color = colors[colorIndex % colors.length];

                const rowData = allLabels.map(label => {
                    return group.find(d => new Date(d.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) === label) || null;
                });

                // Datasets básicos
                tempDatasets.push({
                    label: `Vaca ${id}`,
                    data: rowData.map(d => d ? Number(d.temp_objeto) : null),
                    borderColor: color,
                    tension: 0.3, fill: false
                });

                hrDatasets.push({
                    label: `Vaca ${id}`,
                    data: rowData.map(d => d ? Number(d.ritmo_cardiaco) : null),
                    borderColor: color,
                    tension: 0.3, fill: false
                });

                // --- MATEMÁTICA PARA EL GIROSCOPIO (CADA 15 SEG) ---
                let energiaAcumulada = 0;
                const magnitudes = [];
                const acumuladoArr = [];

                rowData.forEach(d => {
                    if (d) {
                        // Norma del vector (Pitágoras 3D)
                        const mag = Math.sqrt(Math.pow(d.gyro_x, 2) + Math.pow(d.gyro_y, 2) + Math.pow(d.gyro_z, 2));
                        magnitudes.push(mag.toFixed(2));
                        
                        // Integral aproximada: Energía = Intensidad * Delta_Tiempo (15s)
                        energiaAcumulada += (mag * 15); 
                        acumuladoArr.push(energiaAcumulada.toFixed(2));
                    } else {
                        magnitudes.push(null);
                        acumuladoArr.push(energiaAcumulada > 0 ? energiaAcumulada.toFixed(2) : null);
                    }
                });

                // Dataset de Intensidad (Lo que hace en ese bloque de 15s)
                actividadDatasets.push({
                    label: `Intensidad Vaca ${id}`,
                    data: magnitudes,
                    borderColor: color,
                    backgroundColor: `${color}20`,
                    fill: true,
                    stepped: true, // REPRESENTACIÓN CORRECTA DE TIEMPO DISCRETO
                    yAxisID: 'y'
                });

                // Dataset de Energía (Déficit Calórico Acumulado)
                actividadDatasets.push({
                    label: `Gasto Acumulado Vaca ${id}`,
                    data: acumuladoArr,
                    borderColor: color,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    yAxisID: 'y1' // Eje secundario a la derecha
                });

                colorIndex++;
            });

            // Renderizado de gráficas
            const commonOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { ticks: { maxRotation: 45 } } }
            };

            if (tempChart) tempChart.destroy();
            tempChart = new Chart(document.getElementById("tempChart"), {
                type: "line",
                data: { labels: allLabels, datasets: tempDatasets },
                options: commonOptions
            });

            if (hrChart) hrChart.destroy();
            hrChart = new Chart(document.getElementById("hrChart"), {
                type: "line",
                data: { labels: allLabels, datasets: hrDatasets },
                options: commonOptions
            });

            if (gyroChart) gyroChart.destroy();
            gyroChart = new Chart(document.getElementById("gyroChart"), {
                type: "line",
                data: { labels: allLabels, datasets: actividadDatasets },
                options: {
                    ...commonOptions,
                    plugins: { 
                        title: { display: true, text: 'ANÁLISIS METABÓLICO (INTENSIDAD VS ENERGÍA TOTAL)' } 
                    },
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            title: { display: true, text: 'Nivel de Esfuerzo' } 
                        },
                        y1: { 
                            position: 'right', 
                            title: { display: true, text: 'Energía Acumulada (Suma Riemann)' },
                            grid: { drawOnChartArea: false }
                        }
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
      const res = await fetch("/api/config/umbral", {
  credentials: "same-origin"
});
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
      const res = await fetch("/api/dashboard", {
        credentials: "same-origin"
      });
      if (!res.ok) throw new Error("Error en /api/dashboard");
      const data = await res.json();

      if (!data.cows) return;

      // 🔹 EVITA ACTUALIZAR SI NO HAY DATOS NUEVOS
      if (lastSync && data.last_sync === lastSync) {
        return;
      }

      lastSync = data.last_sync;
      const cows = data.cows;

      // Actualizar estadísticas superiores
      document.getElementById("stat-total").textContent = cows.length;
      document.getElementById("stat-alerts").textContent = cows.filter(c => c.status === "alert").length;
      document.getElementById("stat-offline").textContent = cows.filter(c => c.status === "offline").length;
      document.getElementById("stat-updated").textContent = data.last_sync || data.last_update || "--:--:--";

      document.getElementById("sys-sensors").textContent = 
        cows.filter(c => c.status === "ok").length + " / " + cows.length;

      // Actualizar lista de alertas recientes
      const alertsList = document.getElementById("alertsList");
      alertsList.innerHTML = "";
      (data.alerts || []).forEach(a => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${a.cow}</strong> — ${a.text} <small>(${a.time})</small>`;
        alertsList.appendChild(li);
      });

      // Limpiar marcadores antiguos del mapa
      markers.forEach(m => map.removeLayer(m));
      markers = [];

      // Dibujar vacas en el mapa con su nuevo estado de comportamiento
      cows.forEach(cow => {
        if (!cow.lat || !cow.lng) return;

        // --- CÁLCULO DE COMPORTAMIENTO (Uso de la función antes transparente) ---
        // Si tu API no manda 'actividad', calculamos la norma si vienen gyro_x, y, z
        const intensidad = cow.actividad || 
                           (cow.gyro_x ? Math.sqrt(Math.pow(cow.gyro_x,2) + Math.pow(cow.gyro_y,2) + Math.pow(cow.gyro_z,2)) : 0);
        
        const comportamiento = obtenerEstadoVaca(intensidad); 
        // -----------------------------------------------------------------------

        const color = cow.status === "ok" ? "#10b981" : cow.status === "alert" ? "#f97316" : "#9ca3af";
        
        const marker = L.circleMarker([cow.lat, cow.lng], {
          radius: 11,
          color: color,
          fillColor: color,
          fillOpacity: 0.75,
          weight: 2
        }).addTo(map);

        // Popup actualizado con Comportamiento detectado
        marker.bindPopup(`
          <div style="font-family: sans-serif;">
            <b style="font-size: 1.1rem;">${cow.name || "Vaca " + cow.id}</b><br>
            <hr style="margin: 5px 0;">
            <b>Comportamiento:</b> <span style="color: #2563eb;">${comportamiento}</span><br>
            <b>Temp:</b> ${cow.temp ?? "--"} °C<br>
            <b>Ritmo:</b> ${cow.hr ?? "--"} bpm<br>
            <b>Estado Vital:</b> <span style="color: ${color};">${cow.status.toUpperCase()}</span>
          </div>
        `);
        markers.push(marker);
      });

      // Ajustar zoom para ver todas las vacas
// ... (código anterior del mapa) ...
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
      }

      // --- NUEVO: LISTA DE ESTADOS EN TIEMPO REAL ---
      const behaviorList = document.getElementById("behaviorList");
      if (behaviorList) {
          behaviorList.innerHTML = ""; // Limpiar lista previa
          cows.forEach(cow => {
              // Calculamos la misma intensidad que en el mapa
              const intensidad = cow.actividad || 
                                 (cow.gyro_x ? Math.sqrt(Math.pow(cow.gyro_x,2) + Math.pow(cow.gyro_y,2) + Math.pow(cow.gyro_z,2)) : 0);
              
              const comportamiento = obtenerEstadoVaca(intensidad);
              
              // Definir colores rápidos para las etiquetas
              const bg = comportamiento === "Reposo" ? "#e2e8f0" : 
                         comportamiento === "Rumia/Descanso" ? "#dcfce7" : 
                         comportamiento === "Pastoreo" ? "#fef9c3" : "#fee2e2";
              
              const colorText = comportamiento === "Reposo" ? "#475569" : 
                                comportamiento === "Rumia/Descanso" ? "#166534" : 
                                comportamiento === "Pastoreo" ? "#854d0e" : "#991b1b";

              const item = document.createElement("div");
              item.style = `background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;`;
              item.innerHTML = `
                  <div style="font-weight: 600; font-size: 0.85rem; color: #64748b;">Vaca ${cow.id}</div>
                  <div style="background: ${bg}; color: ${colorText}; font-size: 0.75rem; font-weight: bold; padding: 4px 8px; border-radius: 12px; margin-top: 5px; display: inline-block;">
                    ${comportamiento}
                  </div>
              `;
              behaviorList.appendChild(item);
          });
      }
      // ----------------------------------------------

      updateDonuts(cows);
      await updateCharts();

    } catch (err) {
      console.error("Error en loadDashboard:", err);
    }
  }

  // --- INICIO DEL CICLO DEL DASHBOARD ---
  initMap();
  loadDashboard();
  
  // Refrescar cada 15 segundos (coincidiendo con tu frecuencia de datos)
  setInterval(loadDashboard, 15000); 
});