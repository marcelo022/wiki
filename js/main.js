/* =========================================================
   Associação Barra Sport Karatê — interações
   Sem efeitos ligados à rolagem: só menu, galeria e detalhes.
   ========================================================= */
(function () {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- Menu (tela cheia no celular) ---------- */
  const burger = $('.burger');
  const menu = $('#menu');
  if (burger && menu) {
    const setOpen = (open) => {
      menu.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) { setOpen(false); burger.focus(); } });
  }

  /* ---------- Linha fina sob o menu depois do topo ---------- */
  const nav = $('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Galeria: filtros ---------- */
  const photos = $$('.gallery .ph');
  const filters = $$('.filter');
  if (filters.length) {
    const apply = (cat) => {
      filters.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === cat)));
      photos.forEach((p) => { p.hidden = !(cat === 'all' || p.dataset.cat === cat); });
      try { history.replaceState(null, '', cat === 'all' ? location.pathname : '#' + cat); } catch (e) { /* ignora */ }
    };
    filters.forEach((b) => {
      const cat = b.dataset.filter;
      const n = cat === 'all' ? photos.length : photos.filter((p) => p.dataset.cat === cat).length;
      const badge = $('.n', b);
      if (badge) badge.textContent = n;
      b.addEventListener('click', () => apply(cat));
    });
    const fromHash = location.hash.slice(1);
    if (filters.some((b) => b.dataset.filter === fromHash)) apply(fromHash);
  }

  /* ---------- Galeria: foto ampliada ---------- */
  const lb = $('.lightbox');
  if (lb && photos.length) {
    const img = $('img', lb);
    const cap = $('.lb-cap', lb);
    const count = $('.lb-count', lb);
    let list = [];
    let i = 0;
    let opener = null;

    const show = (n) => {
      i = (n + list.length) % list.length;
      const src = $('img', list[i]);
      img.src = src.currentSrc || src.src;
      img.alt = src.alt;
      cap.textContent = src.alt;
      count.textContent = (i + 1) + ' de ' + list.length;
    };
    const open = (btn) => {
      list = photos.filter((p) => !p.hidden);
      opener = btn;
      show(list.indexOf(btn));
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      $('.lb-close', lb).focus();
    };
    const close = () => {
      lb.classList.remove('open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (opener) opener.focus();
    };

    photos.forEach((p) => p.addEventListener('click', () => open(p)));
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', () => show(i - 1));
    $('.lb-next', lb).addEventListener('click', () => show(i + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(i - 1);
      if (e.key === 'ArrowRight') show(i + 1);
    });

    let x0 = null;
    lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  /* ---------- Ano no rodapé ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
