/* =============================================
   FARMWATCH — LANDING PAGE JS
   Nav toggle, scroll reveal, animated counters,
   live telemetry ticker, contact form UX.
   ============================================= */
document.addEventListener("DOMContentLoaded", () => {

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Mobile nav toggle ---------- */
  const navToggle = document.getElementById("navToggle");
  const navMobile = document.getElementById("navMobile");
  if (navToggle && navMobile) {
    navToggle.addEventListener("click", () => {
      const isOpen = navMobile.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    navMobile.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        navMobile.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Sticky nav shadow on scroll ---------- */
  const nav = document.getElementById("fwNav");
  const onScroll = () => {
    if (!nav) return;
    nav.style.boxShadow = window.scrollY > 8 ? "0 8px 24px -16px rgba(11,31,58,.25)" : "none";
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("is-visible"));
  }

  /* ---------- Animated hero counters ---------- */
  const counters = document.querySelectorAll(".hero__stat-num[data-count]");
  const animateCounter = (el) => {
    const target = parseFloat(el.getAttribute("data-count"));
    const duration = 1400;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target;
    };
    requestAnimationFrame(step);
  };
  if (counters.length) {
    if ("IntersectionObserver" in window) {
      const counterIO = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterIO.unobserve(entry.target);
          }
        });
      }, { threshold: 0.6 });
      counters.forEach(c => counterIO.observe(c));
    } else {
      counters.forEach(animateCounter);
    }
  }

  /* ---------- Live telemetry ticker ---------- */
  const tickerTrack = document.getElementById("tickerTrack");
  if (tickerTrack) {
    const readings = [
      { id: "ID-014", temp: "38.6°C", hr: "72 bpm", spo2: "97%", status: "OK" },
      { id: "ID-027", temp: "39.7°C", hr: "98 bpm", spo2: "94%", status: "ATENCIÓN" },
      { id: "ID-031", temp: "38.4°C", hr: "69 bpm", spo2: "98%", status: "OK" },
      { id: "ID-045", temp: "38.9°C", hr: "76 bpm", spo2: "96%", status: "OK" },
      { id: "ID-052", temp: "38.5°C", hr: "71 bpm", spo2: "97%", status: "OK" },
      { id: "ID-063", temp: "40.1°C", hr: "104 bpm", spo2: "92%", status: "ALERTA" },
    ];

    const buildEntry = (r) =>
      `<span><span>●</span>${r.id} · TEMP ${r.temp} · HR ${r.hr} · SPO2 ${r.spo2} · ${r.status}</span>`;

    // Duplicate the sequence so the CSS marquee loop is seamless
    const html = readings.map(buildEntry).join("") + readings.map(buildEntry).join("");
    tickerTrack.innerHTML = html;
  }

  /* ---------- Contact form (front-end only demo) ---------- */
  const contactForm = document.getElementById("contactForm");
  const contactNote = document.getElementById("contactNote");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        return;
      }
      contactNote.textContent = "Gracias, recibimos tu solicitud. Te contactaremos pronto.";
      contactForm.reset();
    });
  }

});