/* =========================================================
   ARIADNA & DANTE — Invitación de Boda
   script.js — Interacciones: sobre, navbar, countdown,
               trivia, copiar CLABE, botón "arriba"
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {

  /* ---------------------------------------------------------
     -1) PROPAGAR ?invitado=CODIGO ENTRE PÁGINAS
     Si la URL actual trae un código, lo copiamos a todos los links
     internos hacia index.html / hospedaje.html (navbar, "Ver
     hospedaje", "Volver a la invitación", etc.) para que el
     invitado pueda ir y volver sin perder su invitación abierta.
     Corre de inmediato, sin esperar el fetch de invitados.csv.
     --------------------------------------------------------- */
  (function propagateGuestCodeInLinks() {
    const code = new URLSearchParams(window.location.search).get('invitado');
    if (!code) return;
    document.querySelectorAll('a[href]').forEach(function (link) {
      const href = link.getAttribute('href');
      if (!href || !/^(index\.html|hospedaje\.html)(#|\?|$)/.test(href)) return;
      if (href.indexOf('invitado=') !== -1) return; // ya trae código
      const hashIndex = href.indexOf('#');
      const path = hashIndex === -1 ? href : href.slice(0, hashIndex);
      const hash = hashIndex === -1 ? '' : href.slice(hashIndex);
      const separator = path.indexOf('?') === -1 ? '?' : '&';
      link.setAttribute('href', path + separator + 'invitado=' + encodeURIComponent(code) + hash);
    });
  })();

  /* ---------------------------------------------------------
     0) INVITACIÓN PERSONALIZADA (?invitado=CODIGO)
     Lee invitados.csv, busca el código de la URL y, si hace match,
     rellena la nota personalizada y aplica la visibilidad de
     padrinos. Si la URL no trae código, o trae uno que no hace
     match, el sobre se bloquea (no abre).
     --------------------------------------------------------- */
  const GUESTS_URL = 'invitados.csv';
  let envelopeLocked = false;

  function getGuestCodeFromURL() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invitado');
    return code ? code.trim().toUpperCase() : null;
  }

  // Parser CSV mínimo (soporta campos entre comillas con comas, comillas
  // dobles escapadas "" y saltos de línea dentro del campo) — así el
  // archivo invitados.csv se puede editar tranquilamente en Excel o
  // Google Sheets sin romper el sitio.
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (char === '"' && next === '"') { field += '"'; i++; }
        else if (char === '"') { inQuotes = false; }
        else { field += char; }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field); field = '';
      } else if (char === '\r') {
        // ignorado: Windows usa \r\n como salto de línea
      } else if (char === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
      } else {
        field += char;
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || (r[0] || '').trim() !== ''; });
  }

  function csvToGuestList(text) {
    const rows = parseCSV(text);
    if (rows.length === 0) return [];
    const headers = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) {
      const obj = {};
      headers.forEach(function (h, idx) { obj[h] = (r[idx] || '').trim(); });
      return obj;
    });
  }

  function lockEnvelope(message, hint) {
    envelopeLocked = true;
    const envelopeEl = document.getElementById('envelope');
    const hintEl = document.querySelector('.envelope-hint');
    const introSub = document.querySelector('.envelope-intro-sub');
    if (envelopeEl) {
      envelopeEl.classList.add('is-locked');
      envelopeEl.setAttribute('aria-disabled', 'true');
    }
    if (introSub && message) introSub.textContent = message;
    if (hintEl && hint) {
      hintEl.textContent = hint;
      hintEl.classList.add('is-locked-hint');
    }
  }

  function applyGuest(guest) {
    const introSub = document.querySelector('.envelope-intro-sub');
    if (introSub) {
      introSub.textContent = `Preparamos esta invitación especial para ${guest.nombre}`;
    }

    // Nota personalizada dentro de "Bienvenida"
    const noteBox = document.getElementById('guest-note');
    const noteTag = document.getElementById('guest-note-tag');
    const noteName = document.getElementById('guest-note-name');
    const noteMsg = document.getElementById('guest-note-message');
    if (noteBox) {
      const tagLabels = {
        familia: 'Para ustedes, con cariño',
        pareja: '💍 Para ustedes',
        personal: '💌 Para ti',
        amigos: '🎉 Para ustedes'
      };
      if (noteTag) noteTag.textContent = tagLabels[guest.tipo] || '💌 Para ti';
      if (noteName) noteName.textContent = guest.nombre;
      if (noteMsg) noteMsg.textContent = guest.mensaje;
      noteBox.hidden = false;
    }

    // Visibilidad de padrinos: "inicio" (por defecto, no se toca el DOM) o "final"
    const padrinosPos = (guest.padrinos || 'inicio').toLowerCase();
    if (padrinosPos === 'final') {
      const row = document.getElementById('padrinos-inicio-row');
      const finalSection = document.getElementById('padrinos-final');
      const finalSlot = document.getElementById('padrinos-final-slot');
      if (row && finalSection && finalSlot) {
        finalSlot.appendChild(row); // mueve el nodo real, no lo duplica
        finalSection.hidden = false;
      }
    }
  }

  async function loadGuest() {
    const code = getGuestCodeFromURL();
    if (!code) {
      // Sin código en la URL: esta invitación es personalizada, así que
      // tampoco abre (evita que se comparta/indexe el link "pelón").
      lockEnvelope('Esta es una invitación personalizada.', 'Pide tu enlace a los novios ✦');
      return;
    }

    try {
      // Cache-busting: cada carga pide la versión más reciente del CSV,
      // nunca una copia vieja guardada en caché del navegador/CDN.
      const bust = Date.now();
      const res = await fetch(`${GUESTS_URL}?v=${bust}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('No se pudo leer invitados.csv');
      const text = await res.text();
      const guests = csvToGuestList(text);
      const guest = guests.find(function (g) {
        return (g.id || '').toUpperCase() === code;
      });

      if (!guest) {
        lockEnvelope('Este enlace no es válido.', 'Pide tu enlace personal a los novios ✦');
        return;
      }
      applyGuest(guest);
    } catch (err) {
      // Si falla la carga (sin internet, JSON caído, etc.) no dejamos el
      // sobre en un estado ambiguo: lo tratamos igual que un código inválido.
      console.warn('No se pudo cargar la invitación personalizada:', err);
      lockEnvelope('No pudimos verificar tu invitación.', 'Intenta de nuevo más tarde ✦');
    }
  }

  const guestReady = loadGuest();

  /* ---------------------------------------------------------
     1) SOBRE INTERACTIVO (portada)
     --------------------------------------------------------- */
  const envelope = document.getElementById('envelope');
  const overlay = document.getElementById('envelope-overlay');
  const body = document.body;

  // Solo bloquea el scroll si esta página tiene sobre de entrada
  // (páginas secundarias, como hospedaje.html, no lo tienen).
  if (envelope && overlay) {
    body.classList.add('no-scroll');
  }

  // skipAnimation === true: abre de golpe, sin esperar la animación del
  // sobre (se usa al volver de hospedaje.html hacia una sección concreta,
  // para no obligar al invitado a "reabrir" una invitación que ya abrió).
  function openEnvelope(skipAnimation) {
    if (!envelope || envelope.classList.contains('is-open') || envelopeLocked) return;
    envelope.classList.add('is-open');

    if (skipAnimation === true) {
      overlay.classList.add('hidden');
      body.classList.remove('no-scroll');
      return;
    }

    // Espera a que termine la animación del sobre antes de desvanecer el overlay
    setTimeout(function () {
      overlay.classList.add('hidden');
      body.classList.remove('no-scroll');
    }, 900);
  }

  if (envelope) {
    // Evita el clic mientras se verifica el código (fetch local, casi
    // instantáneo) para que no se alcance a abrir un sobre que debía
    // quedar bloqueado.
    guestReady.finally(function () {
      envelope.addEventListener('click', function () { openEnvelope(); });
      envelope.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' || e.key === ' ') openEnvelope();
      });

      // Si el invitado es válido y la URL ya trae una sección (por ejemplo,
      // regresando de hospedaje.html con "...index.html?invitado=X#detalles"),
      // no lo regresamos al sobre cerrado: lo abrimos directo y lo llevamos
      // a esa sección.
      if (!envelopeLocked && window.location.hash) {
        openEnvelope(true);
        const target = document.querySelector(window.location.hash);
        if (target) {
          requestAnimationFrame(function () {
            target.scrollIntoView();
          });
        }
      }
    });
  }

  /* ---------------------------------------------------------
     2) NAVBAR: cambia de estilo al hacer scroll
     --------------------------------------------------------- */
  const navbar = document.getElementById('mainNavbar');
  function handleNavbarScroll() {
    if (!navbar) return;
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', handleNavbarScroll);
  handleNavbarScroll();

  // Cierra el menú colapsado (móvil) al hacer clic en un link
  document.querySelectorAll('#mainNavbar .nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      const collapseEl = document.getElementById('navbarContent');
      if (collapseEl && collapseEl.classList.contains('show') && window.bootstrap) {
        const collapse = window.bootstrap.Collapse.getInstance(collapseEl) || new window.bootstrap.Collapse(collapseEl);
        collapse.hide();
      }
    });
  });

  /* ---------------------------------------------------------
     3) CUENTA REGRESIVA hacia el 16 de enero de 2027, 15:00
     --------------------------------------------------------- */
  const WEDDING_DATE = new Date(2027, 0, 16, 15, 0, 0); // mes 0 = enero

  const elDays = document.getElementById('cd-days');
  const elHours = document.getElementById('cd-hours');
  const elMinutes = document.getElementById('cd-minutes');
  const elSeconds = document.getElementById('cd-seconds');

  function pad(n) { return String(n).padStart(2, '0'); }

  function updateCountdown() {
    const now = new Date();
    let diff = WEDDING_DATE - now;

    if (diff <= 0) {
      if (elDays) elDays.textContent = '00';
      if (elHours) elHours.textContent = '00';
      if (elMinutes) elMinutes.textContent = '00';
      if (elSeconds) elSeconds.textContent = '00';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    diff -= days * (1000 * 60 * 60 * 24);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    diff -= hours * (1000 * 60 * 60);
    const minutes = Math.floor(diff / (1000 * 60));
    diff -= minutes * (1000 * 60);
    const seconds = Math.floor(diff / 1000);

    if (elDays) elDays.textContent = pad(days);
    if (elHours) elHours.textContent = pad(hours);
    if (elMinutes) elMinutes.textContent = pad(minutes);
    if (elSeconds) elSeconds.textContent = pad(seconds);
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  /* ---------------------------------------------------------
     4) TRIVIA DE AMOR — voltear tarjetas al hacer clic
     --------------------------------------------------------- */
  document.querySelectorAll('.trivia-card').forEach(function (card) {
    card.addEventListener('click', function () {
      card.classList.toggle('flipped');
    });
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.addEventListener('keypress', function (e) {
      if (e.key === 'Enter' || e.key === ' ') card.classList.toggle('flipped');
    });
  });

  /* ---------------------------------------------------------
     5) COPIAR CLABE al portapapeles (Cuenta de Dante / Cuenta de Ariadna)
     --------------------------------------------------------- */
  document.querySelectorAll('.copy-btn[data-copy-target]').forEach(function (copyBtn) {
    const clabeText = document.getElementById(copyBtn.dataset.copyTarget);
    if (!clabeText) return;

    copyBtn.addEventListener('click', function () {
      const value = clabeText.textContent.trim();

      function showCopied() {
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="bi bi-check2"></i> ¡Copiado!';
        copyBtn.classList.add('copied');
        setTimeout(function () {
          copyBtn.innerHTML = original;
          copyBtn.classList.remove('copied');
        }, 1800);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(showCopied).catch(function () {
          fallbackCopy(value, showCopied);
        });
      } else {
        fallbackCopy(value, showCopied);
      }
    });
  });

  function fallbackCopy(text, cb) {
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    try { document.execCommand('copy'); } catch (e) { /* noop */ }
    document.body.removeChild(temp);
    if (cb) cb();
  }

  /* ---------------------------------------------------------
     6) BOTÓN "VOLVER ARRIBA"
     --------------------------------------------------------- */
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 500) {
        backToTop.classList.add('show');
      } else {
        backToTop.classList.remove('show');
      }
    });
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---------------------------------------------------------
     7) Placeholder de imágenes rotas en la galería
        (si alguna foto real aún no ha sido subida)
     --------------------------------------------------------- */
  document.querySelectorAll('.gallery-item img').forEach(function (img) {
    img.addEventListener('error', function () {
      const wrap = img.closest('.gallery-item');
      if (wrap) {
        img.remove();
        const ph = document.createElement('div');
        ph.className = 'gallery-placeholder';
        ph.innerHTML = '<i class="bi bi-image"></i><span>Sube tu foto aquí</span>';
        wrap.appendChild(ph);
      }
    });
  });

  /* ---------------------------------------------------------
     8) Inicializa animaciones al hacer scroll (AOS)
     --------------------------------------------------------- */
  if (window.AOS) {
    window.AOS.init({
      duration: 900,
      easing: 'ease-out-cubic',
      once: true,
      offset: 60
    });
  }

});
