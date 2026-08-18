/* =========================================================
   ARIADNA & DANTE — Invitación de Boda
   script.js — Interacciones: sobre, navbar, countdown,
               trivia, copiar CLABE, botón "arriba"
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {

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

  function openEnvelope() {
    if (!envelope || envelope.classList.contains('is-open')) return;
    envelope.classList.add('is-open');

    // Espera a que termine la animación del sobre antes de desvanecer el overlay
    setTimeout(function () {
      overlay.classList.add('hidden');
      body.classList.remove('no-scroll');
    }, 900);
  }

  if (envelope) {
    envelope.addEventListener('click', openEnvelope);
    envelope.addEventListener('keypress', function (e) {
      if (e.key === 'Enter' || e.key === ' ') openEnvelope();
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
     5) COPIAR CLABE al portapapeles
     --------------------------------------------------------- */
  const copyBtn = document.getElementById('copy-clabe-btn');
  const clabeText = document.getElementById('clabe-number');

  if (copyBtn && clabeText) {
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
  }

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
