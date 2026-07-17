// dashboard-help.js
// Contenido explicativo en lenguaje simple para personas sin conocimientos técnicos.
// Se activa con los botones "?" repartidos por el dashboard.

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("helpOverlay");
  const titleEl = document.getElementById("helpTitle");
  const bodyEl = document.getElementById("helpBody");
  const closeBtn = document.getElementById("helpClose");

  if (!overlay) return; // el modal no existe en esta página

  const HELP_CONTENT = {
    total: {
      title: "Vacas totales",
      html: `<p>Es el número de vacas que tienen un collar/sensor dado de alta en el sistema y que están enviando datos ahora mismo.</p>
             <p>Si este número baja de un momento a otro sin que hayas retirado vacas, revisa la pestaña <strong>Vacas</strong> para confirmar que ninguna se quedó sin registrar.</p>`
    },
    alerts: {
      title: "Vacas en alerta",
      html: `<p>Cuenta cuántas vacas tienen ahora mismo <strong>temperatura</strong> o <strong>ritmo cardíaco</strong> fuera de lo normal (por encima de los límites configurados).</p>
             <p>Una vaca en alerta no significa que esté enferma, pero sí que vale la pena revisarla en persona: fiebre, estrés por calor o esfuerzo físico intenso pueden causar esto.</p>`
    },
    offline: {
      title: "Sensores offline",
      html: `<p>Son collares que dejaron de enviar información hace más de 30 segundos. No es que la vaca esté "mal", es el equipo el que perdió conexión.</p>
             <p>Causas comunes: la vaca está fuera del rango de la red, el sensor se descargó, o hay un cable/conexión suelta.</p>`
    },
    battery: {
      title: "Batería baja",
      html: `<p>Indica cuántos sensores tienen poca energía restante y necesitarán carga o cambio de batería pronto, antes de que dejen de transmitir por completo.</p>`
    },
    sync: {
      title: "Última sincronización",
      html: `<p>Es la hora del dato más reciente que llegó de cualquier sensor. El dashboard se actualiza solo cada 15 segundos, así que esta hora debería estar siempre muy cerca de la hora actual.</p>
             <p>Si se queda "congelada" (no avanza), puede ser que los sensores o la conexión a internet del rancho tengan un problema.</p>`
    },
    system: {
      title: "Estado del sistema",
      html: `<p><strong>Cloud SQL:</strong> es la base de datos donde se guarda toda la información. Si dice OK, está funcionando bien.</p>
             <p><strong>API:</strong> es el "traductor" que conecta los sensores, la base de datos y esta pantalla. Si falla, el dashboard no podrá mostrar datos nuevos.</p>
             <p><strong>Sensores online:</strong> cuántos collares están transmitiendo correctamente en este momento, de cuántos existen en total.</p>`
    },
    temp: {
      title: "Gráfico de temperatura",
      html: `<p>Muestra la temperatura corporal de cada vaca a lo largo de las últimas horas (medida en la piel/cuerpo, no la temperatura ambiente).</p>
             <p>La línea punteada roja marca el <strong>límite máximo saludable</strong> configurado. Si la línea de una vaca sube por encima de esa marca, puede indicar fiebre, estrés por calor o inicio de una infección.</p>`
    },
    hr: {
      title: "Gráfico de ritmo cardíaco",
      html: `<p>Muestra los latidos por minuto (bpm) de cada vaca. Sube de forma normal cuando la vaca camina, pasta o hay calor; debería bajar cuando descansa.</p>
             <p>La línea punteada naranja marca el <strong>límite máximo</strong> configurado. Un ritmo muy por encima de ese límite de forma sostenida (no solo un pico momentáneo) puede indicar dolor, estrés o un problema de salud.</p>`
    },
    gasto: {
      title: "Movimiento e Gasto Calórico — cómo se calcula",
      html: `
        <p>Esta gráfica combina dos ideas para saber, de un vistazo, <strong>qué tan activa está la vaca</strong> y <strong>cuánta energía extra está usando comparado con cuando descansa</strong>.</p>

        <p class="help-section-label">Intensidad (línea sólida)</p>
        <p>Se calcula con el sensor de movimiento (giroscopio) de los 3 ejes X, Y, Z. Cuanto más se mueve la vaca, más alto es este número. En reposo debería estar cerca de 0.</p>

        <p class="help-section-label">Gasto Calórico (línea punteada)</p>
        <p>Es un <strong>índice relativo</strong>, no calorías exactas. Compara el esfuerzo actual de la vaca contra su propio "estado de reposo" (el ritmo cardíaco en reposo configurado, hoy en <strong>60 bpm</strong> por defecto).</p>
        <div class="help-badges">
          <span class="help-badge"><span class="help-dot" style="background:#10b981;"></span> ≈ 100% → esfuerzo similar al reposo (normal)</span>
          <span class="help-badge"><span class="help-dot" style="background:#f97316;"></span> Muy por encima de 100% → la vaca está gastando bastante más energía de lo normal (movimiento, calor, estrés)</span>
          <span class="help-badge"><span class="help-dot" style="background:#94a3b8;"></span> Muy por debajo → reposo profundo, o una lectura de sensor que conviene revisar</span>
        </div>
        <p>La fórmula usa 4 datos del collar: ritmo cardíaco, movimiento, temperatura corporal y oxígeno en sangre, cada uno con distinto peso, y lo compara contra el reposo. Por eso puede subir o bajar aunque la vaca no se esté moviendo mucho: por ejemplo, si tiene fiebre o el oxígeno baja, el índice también sube.</p>
        <p><strong>Qué hacer:</strong> no te fijes en un solo pico aislado (es normal), sino en tendencias sostenidas durante varios minutos. Si ves subidas grandes y repetidas en una vaca en particular, revísala en persona.</p>
      `
    },
    cowdonut: {
      title: "Estado del hato",
      html: `<p>Reparte a todas las vacas en 3 grupos según su estado más reciente:</p>
             <div class="help-badges">
               <span class="help-badge"><span class="help-dot" style="background:#10b981;"></span> Normal — todo dentro de rango</span>
               <span class="help-badge"><span class="help-dot" style="background:#f97316;"></span> Alerta — temperatura o ritmo fuera de rango</span>
               <span class="help-badge"><span class="help-dot" style="background:#9ca3af;"></span> Offline — sin datos recientes</span>
             </div>`
    },
    sensordonut: {
      title: "Estado de sensores",
      html: `<p>Compara cuántos collares están funcionando con normalidad ("Online") contra cuántos tienen algún problema o dejaron de responder ("Problema/Offline"). Es un resumen rápido de la salud del equipo, no de las vacas.</p>`
    },
    behavior: {
      title: "Estado de actividad actual",
      html: `<p>Traduce el nivel de movimiento de cada vaca a una palabra fácil de entender:</p>
             <div class="help-badges">
               <span class="help-badge"><span class="help-dot" style="background:#94a3b8;"></span> Reposo — casi sin movimiento</span>
               <span class="help-badge"><span class="help-dot" style="background:#22c55e;"></span> Rumia/Descanso — movimiento suave y constante</span>
               <span class="help-badge"><span class="help-dot" style="background:#eab308;"></span> Pastoreo — caminando/comiendo</span>
               <span class="help-badge"><span class="help-dot" style="background:#ef4444;"></span> Actividad Alta — movimiento intenso</span>
             </div>
             <p>Se calcula con la misma medida de movimiento (giroscopio) usada en la gráfica de Gasto Calórico.</p>`
    },
    alertlist: {
      title: "Alertas recientes",
      html: `<p>Lista, en orden, las últimas veces que una vaca superó alguno de los límites configurados (temperatura o ritmo cardíaco). Sirve para revisar rápido "qué pasó y cuándo" sin tener que abrir los reportes completos.</p>`
    },
    map: {
      title: "Mapa del hato",
      html: `<p>Ubica a cada vaca según el GPS de su collar. El color del punto sigue el mismo código que el resto del dashboard: verde = normal, naranja = alerta, gris = offline.</p>
             <p>Toca un punto para ver su temperatura, ritmo cardíaco y comportamiento actual.</p>`
    }
  };

  function openHelp(key) {
    const content = HELP_CONTENT[key];
    if (!content) return;
    titleEl.textContent = content.title;
    bodyEl.innerHTML = content.html;
    overlay.classList.add("open");
  }

  function closeHelp() {
    overlay.classList.remove("open");
  }

  document.querySelectorAll("[data-help]").forEach(btn => {
    btn.addEventListener("click", () => openHelp(btn.getAttribute("data-help")));
  });

  closeBtn.addEventListener("click", closeHelp);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeHelp();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeHelp();
  });
});