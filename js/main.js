/* =========================================================
   Associação Barra Sport Karatê — Interações
   ========================================================= */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Menu mobile ---------- */
  const burger = $('.burger');
  const menu = $('.menu');
  if (burger && menu) {
    const toggle = (open) => {
      menu.classList.toggle('open', open);
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
    };
    burger.addEventListener('click', () => toggle(!menu.classList.contains('open')));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => toggle(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
    document.addEventListener('click', (e) => {
      if (menu.classList.contains('open') && !menu.contains(e.target) && !burger.contains(e.target)) toggle(false);
    });
  }

  /* ---------- Rolagem: navbar, progresso, topo, parallax ---------- */
  const nav = $('.nav');
  const progress = $('.progress');
  const toTop = $('.to-top');
  const heroBg = $('.hero-bg');

  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (nav) nav.classList.toggle('scrolled', y > 40);
    if (progress) progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    if (toTop) toTop.classList.toggle('show', y > 600);
    if (heroBg && !reduceMotion && y < window.innerHeight * 1.2) {
      heroBg.style.transform = 'translate3d(0,' + y * 0.35 + 'px,0) scale(1.05)';
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------- Revelar ao rolar ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('visible'));
  }

  /* ---------- Link ativo conforme a seção ---------- */
  const sectionLinks = $$('.menu a[href^="#"]');
  if (sectionLinks.length && 'IntersectionObserver' in window) {
    const map = new Map();
    sectionLinks.forEach((a) => {
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) map.set(target, a);
    });
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          $$('.menu a').forEach((a) => a.classList.remove('active'));
          map.get(entry.target).classList.add('active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, section) => spy.observe(section));
  }

  /* ---------- Contadores animados ---------- */
  const counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    const animate = (el) => {
      const end = parseInt(el.dataset.count, 10);
      if (reduceMotion) { el.textContent = end; return; }
      const duration = 1600;
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * eased);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const co = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { animate(entry.target); co.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  }

  /* ---------- Texto digitado no hero ---------- */
  const typed = $('.hero-typed');
  if (typed) {
    const words = JSON.parse(typed.dataset.words || '[]');
    if (words.length && !reduceMotion) {
      let w = 0, i = 0, deleting = false;
      const tick = () => {
        const word = words[w];
        i += deleting ? -1 : 1;
        typed.textContent = word.slice(0, i);
        let delay = deleting ? 45 : 95;
        if (!deleting && i === word.length) { deleting = true; delay = 1800; }
        else if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; delay = 350; }
        setTimeout(tick, delay);
      };
      typed.textContent = '';
      setTimeout(tick, 600);
    }
  }

  /* ---------- Inclinação 3D nos cards ---------- */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    $$('.card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'perspective(800px) rotateX(' + (-y * 8) + 'deg) rotateY(' + (x * 8) + 'deg) translateY(-6px)';
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- Galeria: filtros ---------- */
  const photos = $$('.photo');
  const filters = $$('.filter');
  if (filters.length) {
    filters.forEach((btn) => {
      const cat = btn.dataset.filter;
      const n = cat === 'all' ? photos.length : photos.filter((p) => p.dataset.cat === cat).length;
      const badge = $('.count', btn);
      if (badge) badge.textContent = n;

      btn.addEventListener('click', () => {
        filters.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        photos.forEach((p) => {
          const show = cat === 'all' || p.dataset.cat === cat;
          p.classList.toggle('hide', !show);
          if (show) p.classList.add('visible');
        });
        if (history.replaceState) history.replaceState(null, '', cat === 'all' ? location.pathname : '#' + cat);
      });
    });
    // Abre direto num filtro se a URL tiver #categoria
    const initial = filters.find((b) => '#' + b.dataset.filter === location.hash);
    if (initial) initial.click();
  }

  /* ---------- Galeria: lightbox ---------- */
  const lb = $('.lightbox');
  if (lb && photos.length) {
    const lbImg = $('img', lb);
    const lbCap = $('figcaption', lb);
    let current = 0;
    let lastFocus = null;

    const visible = () => photos.filter((p) => !p.classList.contains('hide'));
    const show = (idx) => {
      const list = visible();
      current = (idx + list.length) % list.length;
      const img = $('img', list[current]);
      const cap = $('figcaption', list[current]);
      lbImg.src = img.src;
      lbImg.alt = img.alt;
      lbCap.innerHTML = '';
      lbCap.append(cap ? cap.childNodes[cap.childNodes.length - 1].textContent.trim() : img.alt);
      const counter = document.createElement('span');
      counter.textContent = (current + 1) + ' / ' + list.length;
      lbCap.append(counter);
    };
    const open = (photo) => {
      lastFocus = document.activeElement;
      show(visible().indexOf(photo));
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      $('.lb-close', lb).focus();
    };
    const close = () => {
      lb.classList.remove('open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };

    photos.forEach((p) => {
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'button');
      p.addEventListener('click', () => open(p));
      p.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(p); }
      });
    });
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', () => show(current - 1));
    $('.lb-next', lb).addEventListener('click', () => show(current + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });

    // Deslizar no celular
    let startX = null;
    lb.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  /* ---------- Ano atual no rodapé ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
