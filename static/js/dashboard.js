document.addEventListener("DOMContentLoaded", () => {
    
    let map;
    let markers = [];
    let tempChart = null;
    let hrChart = null;
    let cowDonut = null;
    let sensorDonut = null;
    let lastSync = null; 
    let gyroChart = null;

    // Valor de respaldo si no hay un BPM de reposo configurado en la BD (clave "hr_reposo")
    const HR_REPOSO_DEFAULT = 60;

function initMap() {
    // Añadimos maxZoom: 16 para que NUNCA se acerque más de lo que se ve en tu segunda imagen
    map = L.map("map", { 
        scrollWheelZoom: false, 
        zoomControl: true,
        maxZoom: 16  // <--- AGREGA ESTO
    }).setView([20.97, -89.62], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap',
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

    // Trae los umbrales/config guardados en la BD (tabla `configuracion`)
    async function obtenerUmbrales() {
        try {
            const res = await fetch("/api/config/umbral", { credentials: "same-origin" });
            if (!res.ok) return {};
            return await res.json();
        } catch (err) {
            console.warn("Umbrales no cargados:", err);
            return {};
        }
    }

    // FÓRMULA DE GASTO CALÓRICO (índice relativo al reposo, no calorías exactas)
    // Gasto Calórico = ( (0.15*BPM + 0.35*A + 0.08*(T-38.5) - 0.05*(98-SpO2)) / (0.15*BPM_reposo) ) * 100
    function calcularGastoCalorico(bpm, actividad, temp, spo2, bpmReposo) {
        if (bpm === null || bpm === undefined || !bpmReposo) return null;
        if (temp === null || temp === undefined) temp = 38.5;
        if (spo2 === null || spo2 === undefined) spo2 = 98;
        if (actividad === null || actividad === undefined) actividad = 0;

        const numerador = 0.15 * bpm + 0.35 * actividad + 0.08 * (temp - 38.5) - 0.05 * (98 - spo2);
        const denominador = 0.15 * bpmReposo;

        if (denominador === 0) return null;

        return (numerador / denominador) * 100;
    }

  // Gráficas con leyenda interactiva (clic para ocultar/mostrar vaca)
async function updateCharts() {
        try {
            const [res, umbrales] = await Promise.all([
                fetch("/api/datos", { credentials: "same-origin" }),
                obtenerUmbrales()
            ]);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const datos = await res.json();

            if (!Array.isArray(datos) || datos.length === 0) return;

            const bpmReposo = Number(umbrales.hr_reposo) || HR_REPOSO_DEFAULT;

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

                // --- INTENSIDAD DE MOVIMIENTO (magnitud del giroscopio) ---
                const magnitudes = [];
                // --- GASTO CALÓRICO (índice relativo al reposo, por lectura) ---
                const gastoArr = [];

                rowData.forEach(d => {
                    if (d) {
                        // Norma del vector (Pitágoras 3D) = variable "A" (actividad) de la fórmula
                        const mag = Math.sqrt(Math.pow(d.gyro_x, 2) + Math.pow(d.gyro_y, 2) + Math.pow(d.gyro_z, 2));
                        magnitudes.push(mag.toFixed(2));

                        const gasto = calcularGastoCalorico(
                            Number(d.ritmo_cardiaco),
                            mag,
                            Number(d.temp_objeto),
                            Number(d.oxigeno),
                            bpmReposo
                        );
                        gastoArr.push(gasto !== null ? gasto.toFixed(2) : null);
                    } else {
                        magnitudes.push(null);
                        gastoArr.push(null);
                    }
                });

                // Dataset de Intensidad (movimiento en ese bloque de 15s)
                actividadDatasets.push({
                    label: `Intensidad Vaca ${id}`,
                    data: magnitudes,
                    borderColor: color,
                    backgroundColor: `${color}20`,
                    fill: true,
                    stepped: true, // REPRESENTACIÓN CORRECTA DE TIEMPO DISCRETO
                    yAxisID: 'y'
                });

                // Dataset de Gasto Calórico (índice relativo al BPM de reposo)
                actividadDatasets.push({
                    label: `Gasto Calórico Vaca ${id}`,
                    data: gastoArr,
                    borderColor: color,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    yAxisID: 'y1' // Eje secundario a la derecha
                });

                colorIndex++;
            });

            // Línea de referencia: 100% = mismo esfuerzo que en reposo.
            // Ayuda a leer el gráfico de un vistazo sin tener que hacer cuentas.
            actividadDatasets.push({
                label: "Referencia: nivel de reposo (100%)",
                data: Array(allLabels.length).fill(100),
                borderColor: "#16a34a",
                borderDash: [2, 3],
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false,
                yAxisID: 'y1'
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
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        y: { title: { display: true, text: 'Temperatura (°C)' } }
                    }
                }
            });

            if (hrChart) hrChart.destroy();
            hrChart = new Chart(document.getElementById("hrChart"), {
                type: "line",
                data: { labels: allLabels, datasets: hrDatasets },
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        y: { title: { display: true, text: 'Ritmo cardíaco (bpm)' } }
                    }
                }
            });

            if (gyroChart) gyroChart.destroy();
            gyroChart = new Chart(document.getElementById("gyroChart"), {
                type: "line",
                data: { labels: allLabels, datasets: actividadDatasets },
                options: {
                    ...commonOptions,
                    plugins: { 
                        title: { display: true, text: `GASTO CALÓRICO VS INTENSIDAD DE MOVIMIENTO (BPM reposo: ${bpmReposo})` } 
                    },
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            title: { display: true, text: 'Nivel de Esfuerzo (Intensidad)' } 
                        },
                        y1: { 
                            position: 'right', 
                            title: { display: true, text: 'Gasto Calórico (% vs. reposo)' },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });

            addThresholdLines(umbrales);
        } catch (err) {
            console.error("Error en updateCharts:", err);
        }
    }

  // Umbrales (ahora recibe los umbrales ya cargados, evita una segunda petición)
  function addThresholdLines(umbrales) {
    try {
      if (!umbrales) return;

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
      console.warn("No se pudieron dibujar los umbrales:", err);
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
      if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(10));
      }

      // --- LISTA DE ESTADOS EN TIEMPO REAL ---
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

  // ==================== EXPANDIR GRÁFICO ====================
  // Los gráficos pequeños se actualizan solos cada 15s (tempChart, hrChart,
  // gyroChart se reasignan en updateCharts). Al expandir, clonamos los datos
  // y opciones del gráfico que esté vigente EN ESE MOMENTO y los dibujamos
  // más grandes en el modal — así siempre se ve la info más reciente.
  let expandChart = null;
  const expandOverlay = document.getElementById("expandOverlay");
  const expandCanvas = document.getElementById("expandCanvas");
  const expandTitleEl = document.getElementById("expandTitle");
  const expandCloseBtn = document.getElementById("expandClose");

  const EXPAND_TITLES = {
    temp: "Temperatura promedio (12 h)",
    hr: "Ritmo cardíaco (12 h)",
    gyro: "Análisis de Movimiento (Giroscopio)"
  };

  function getChartByKey(key) {
    if (key === "temp") return tempChart;
    if (key === "hr") return hrChart;
    if (key === "gyro") return gyroChart;
    return null;
  }

  function openExpand(key) {
    const sourceChart = getChartByKey(key);
    if (!sourceChart) return; // el gráfico aún no cargó datos

    if (expandChart) {
      expandChart.destroy();
      expandChart = null;
    }

    expandTitleEl.textContent = EXPAND_TITLES[key] || "Gráfico";

    const clonedData = JSON.parse(JSON.stringify(sourceChart.config.data));
    const clonedOptions = JSON.parse(JSON.stringify(sourceChart.config.options || {}));
    clonedOptions.responsive = true;
    clonedOptions.maintainAspectRatio = false;

    expandChart = new Chart(expandCanvas, {
      type: sourceChart.config.type,
      data: clonedData,
      options: clonedOptions
    });

    expandOverlay.classList.add("open");
  }

  function closeExpand() {
    expandOverlay.classList.remove("open");
    if (expandChart) {
      expandChart.destroy();
      expandChart = null;
    }
  }

  document.querySelectorAll("[data-expand]").forEach(btn => {
    btn.addEventListener("click", () => openExpand(btn.getAttribute("data-expand")));
  });

  if (expandCloseBtn) expandCloseBtn.addEventListener("click", closeExpand);
  if (expandOverlay) {
    expandOverlay.addEventListener("click", (e) => {
      if (e.target === expandOverlay) closeExpand();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeExpand();
  });

  // --- INICIO DEL CICLO DEL DASHBOARD ---
  initMap();
  loadDashboard();
  
  // Refrescar cada 15 segundos (coincidiendo con tu frecuencia de datos)
  setInterval(loadDashboard, 15000); 
});