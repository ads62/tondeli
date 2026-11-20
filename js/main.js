/* =========================================================
   Tondelli Dent's — interações
   GSAP + ScrollTrigger + Lenis (sem frameworks)
   Seções: 0 setup · 1 scroll suave · 2 cursor · 3 navegação
           4 intro · 5 scroll (parallax / pin / reveals)
   ========================================================= */
(() => {
  'use strict';

  const root = document.documentElement;

  /* Sem GSAP: o site continua legível (estados iniciais dependem da classe .js). */
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 1. Scroll suave (Lenis ↔ ScrollTrigger) ---------- */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const lockScroll = () => (lenis ? lenis.stop() : (document.body.style.overflow = 'hidden'));
  const unlockScroll = () => (lenis ? lenis.start() : (document.body.style.overflow = ''));

  /* ---------- 2. Cursor personalizado (apenas mouse) ---------- */
  const initCursor = () => {
    if (!finePointer) return;

    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    const label = $('.cursor__label');
    if (!cursor || !dot || !ring) return;

    root.classList.add('has-cursor');
    cursor.style.opacity = '0';

    const setDotX = gsap.quickSetter(dot, 'x', 'px');
    const setDotY = gsap.quickSetter(dot, 'y', 'px');
    const setRingX = gsap.quickSetter(ring, 'x', 'px');
    const setRingY = gsap.quickSetter(ring, 'y', 'px');

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      mouseX = e.clientX;
      mouseY = e.clientY;
      setDotX(mouseX);
      setDotY(mouseY);
      cursor.style.opacity = '1';
    }, { passive: true });

    root.addEventListener('mouseleave', () => (cursor.style.opacity = '0'));
    root.addEventListener('mouseenter', () => (cursor.style.opacity = '1'));

    /* Anel com inércia; com reduced-motion segue o ponteiro sem atraso. */
    gsap.ticker.add(() => {
      const k = reduced ? 1 : 1 - Math.pow(1 - 0.18, gsap.ticker.deltaRatio());
      ringX += (mouseX - ringX) * k;
      ringY += (mouseY - ringY) * k;
      setRingX(ringX);
      setRingY(ringY);
    });

    const setState = (target) => {
      if (!target) {
        cursor.dataset.state = 'default';
        label.textContent = '';
        return;
      }
      const kind = target.dataset.cursor;
      const text = target.dataset.cursorLabel || '';
      label.textContent = text;
      if (kind === 'image') cursor.dataset.state = 'image';
      else if (text) cursor.dataset.state = 'label';
      else cursor.dataset.state = target.classList.contains('btn') ? 'button' : 'link';
    };

    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      setState(e.target.closest('[data-cursor], [data-cursor-label], a, button'));
    });

    /* Efeito magnético nos botões */
    if (!reduced) {
      $$('[data-magnetic]').forEach((el) => {
        el.addEventListener('pointermove', (e) => {
          if (e.pointerType !== 'mouse') return;
          const r = el.getBoundingClientRect();
          gsap.to(el, {
            x: (e.clientX - (r.left + r.width / 2)) * 0.28,
            y: (e.clientY - (r.top + r.height / 2)) * 0.28,
            duration: 0.4,
            ease: 'power3.out',
          });
        });
        el.addEventListener('pointerleave', () => {
          gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' });
        });
      });
    }
  };

  /* ---------- 3. Navegação ---------- */
  const nav = $('#nav');
  const toggle = $('.nav__toggle');
  const menu = $('#menu');
  let menuOpen = false;

  const setMenu = (open) => {
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    nav.classList.remove('is-hidden');
    open ? lockScroll() : unlockScroll();
  };

  toggle.addEventListener('click', () => setMenu(!menuOpen));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) setMenu(false);
  });

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > 40 || menuOpen);
      nav.classList.toggle('is-hidden', self.direction === 1 && y > 520 && !menuOpen);
    },
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    const target = hash.length > 1 ? $(hash) : null;
    if (!target) return;
    e.preventDefault();
    if (menuOpen) setMenu(false);
    if (lenis) lenis.scrollTo(hash === '#topo' ? 0 : target, { duration: 1.4 });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    history.replaceState(null, '', hash);
  });

  /* WhatsApp fixo no mobile: aparece depois do hero e some quando o CTA final está visível */
  const waFloat = $('.wa-float');
  if (waFloat) {
    let pastHero = false;
    let atContact = false;
    const sync = () => waFloat.classList.toggle('is-visible', pastHero && !atContact);
    ScrollTrigger.create({ trigger: '.hero', start: 'bottom 25%', onEnter: () => { pastHero = true; sync(); }, onLeaveBack: () => { pastHero = false; sync(); } });
    ScrollTrigger.create({ trigger: '#contato', start: 'top 75%', onEnter: () => { atContact = true; sync(); }, onLeaveBack: () => { atContact = false; sync(); } });
  }

  /* ---------- 4. Intro (loader + hero) ---------- */
  const loader = $('.loader');

  const seenIntro = (() => {
    try { return sessionStorage.getItem('td-intro') === '1'; } catch (_) { return false; }
  })();
  const markIntro = () => { try { sessionStorage.setItem('td-intro', '1'); } catch (_) { /* modo privado */ } };

  const playHero = (tl, at = 0) => {
    tl.to('.hero__title .line > span', { yPercent: 0, y: 0, duration: 1.3, stagger: 0.12, ease: 'expo.out' }, at)
      .to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1, stagger: 0.12, ease: 'expo.out' }, at + 0.45)
      .to('[data-hero-arch]', { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut' }, at + 0.1)
      .fromTo('[data-hero-arch] img', { scale: 1.25 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, at + 0.1)
      .fromTo('[data-hero-card]', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out' }, at + 0.7)
      .fromTo('[data-hero-badge]', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 1, ease: 'back.out(1.6)' }, at + 1)
      .to('.nav', { opacity: 1, duration: 0.8, ease: 'power2.out' }, at + 0.6);
  };

  const runIntro = () => {
    root.dataset.ready = '1';

    if (reduced) {
      loader && loader.remove();
      return;
    }

    gsap.set('.hero__title .line > span', { yPercent: 110 });
    const tl = gsap.timeline();

    if (loader && !seenIntro) {
      lockScroll();
      tl.to('.loader__logo', { opacity: 1, scale: 1, duration: 1.1, ease: 'power3.out' }, 0)
        .to('.loader__bar i', { scaleX: 1, duration: 1.3, ease: 'power1.inOut' }, 0)
        .to('.loader', { yPercent: -100, duration: 0.95, ease: 'power4.inOut' }, 1.45)
        .add(() => { loader.remove(); unlockScroll(); markIntro(); ScrollTrigger.refresh(); }, '>');
      playHero(tl, 1.95);
    } else {
      loader && loader.remove();
      playHero(tl, 0.1);
    }
  };

  /* Espera imagens críticas (máx. 2,5s) para não travar a abertura */
  const pageLoaded = new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  });
  Promise.race([pageLoaded, new Promise((r) => setTimeout(r, 2500))]).then(runIntro);

  /* ---------- 5. Scroll: parallax, pin, reveals ---------- */

  /* Títulos por linha (contato) */
  const contactLines = $$('.contact__title .line > span');
  if (contactLines.length && !reduced) {
    gsap.to(contactLines, {
      yPercent: 0, y: 0, duration: 1.3, stagger: 0.12, ease: 'expo.out',
      scrollTrigger: { trigger: '.contact__title', start: 'top 82%', once: true },
    });
  } else {
    gsap.set(contactLines, { yPercent: 0 });
  }

  /* Reveals genéricos */
  if (!reduced) {
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, ease: 'expo.out', overwrite: true }),
    });
  }

  /* Citação: palavras acendem conforme o scroll */
  const quote = $('[data-words]');
  if (quote) {
    const text = quote.textContent.trim();
    quote.setAttribute('aria-label', text);
    quote.textContent = '';
    text.split(/\s+/).forEach((word, i, all) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = word;
      quote.appendChild(span);
      if (i < all.length - 1) quote.appendChild(document.createTextNode(' '));
    });

    if (!reduced) {
      gsap.to('.care__quote .w', {
        opacity: 1, ease: 'none', stagger: 0.12,
        scrollTrigger: { trigger: quote, start: 'top 78%', end: 'bottom 42%', scrub: true },
      });
    }
  }

  /* Contadores da nota */
  if (!reduced) {
    $$('[data-count]').forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const state = { v: 0 };
      const format = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      el.textContent = format(0);
      gsap.to(state, {
        v: target, duration: 1.8, ease: 'power3.out',
        onUpdate: () => (el.textContent = format(state.v)),
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });
  }

  /* Marquee: velocidade acompanha o scroll */
  if (!reduced) {
    const marqueeTween = gsap.to('.marquee__track', { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });
    let boost = 0;
    ScrollTrigger.create({
      trigger: '.marquee', start: 'top bottom', end: 'bottom top',
      onUpdate: (self) => { boost = Math.min(Math.abs(self.getVelocity()) / 600, 4); },
    });
    gsap.ticker.add(() => {
      boost *= 0.93;
      marqueeTween.timeScale(1 + boost);
    });
  }

  /* Parallax + pin com breakpoints */
  const mm = gsap.matchMedia();

  mm.add(
    {
      desktop: '(min-width: 992px)',
      mobile: '(max-width: 991px)',
      motion: '(prefers-reduced-motion: no-preference)',
    },
    (ctx) => {
      const { desktop, motion } = ctx.conditions;
      if (!motion) return;

      /* HERO — camadas com velocidades diferentes */
      const heroScrub = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };

      gsap.to('[data-hero-arch] img', { yPercent: desktop ? -12 : -6, ease: 'none', scrollTrigger: heroScrub });
      gsap.to('[data-hero-card]', { yPercent: desktop ? -38 : -14, ease: 'none', scrollTrigger: heroScrub });
      gsap.to('[data-hero-badge]', { yPercent: desktop ? -55 : -20, ease: 'none', scrollTrigger: heroScrub });
      gsap.to('.beam--a', { xPercent: desktop ? 70 : 25, ease: 'none', scrollTrigger: heroScrub });
      if (desktop) gsap.to('.beam--b', { xPercent: -80, ease: 'none', scrollTrigger: heroScrub });
      gsap.to('.hero__content', {
        y: desktop ? -60 : -24, opacity: 0.15, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: '35% top', end: 'bottom top', scrub: true },
      });

      /* TRATAMENTOS */
      const stage = $('.showcase');
      const items = $$('[data-treat]');

      if (desktop) {
        /* Seção fixa: o scroll troca o conteúdo (storytelling) */
        const n = items.length;
        const hudCurrent = $('[data-hud-current]');
        const hudBar = $('[data-hud-bar]');
        const STEP = 1.6;
        const DUR = 0.8;
        const FIRST = 0.8;
        const midpoints = items.map((_, i) => (i === 0 ? 0 : FIRST + (i - 1) * STEP + DUR / 2));
        const total = FIRST + (n - 2) * STEP + DUR + 0.8;
        let currentIndex = 0;

        items.forEach((item, i) => {
          item.style.zIndex = String(i + 1);
          if (i === 0) return;
          gsap.set($('.treat__text', item), { autoAlpha: 0, y: 50 });
          gsap.set($('.treat__media', item), { clipPath: 'inset(100% 0% 0% 0%)' });
          gsap.set($('.treat__media img', item), { scale: 1.25 });
        });

        const tl = gsap.timeline({
          defaults: { ease: 'power2.inOut' },
          scrollTrigger: {
            trigger: stage,
            start: 'top top',
            end: () => '+=' + Math.round(window.innerHeight * (n + 0.5)),
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
          /* Atualiza o contador no avanço da própria timeline (acompanha o scrub suavizado) */
          onUpdate: () => {
            gsap.set(hudBar, { scaleX: tl.progress() });
            const t = tl.time();
            let idx = 0;
            midpoints.forEach((m, i) => { if (t >= m) idx = i; });
            if (idx !== currentIndex) {
              currentIndex = idx;
              hudCurrent.textContent = String(idx + 1).padStart(2, '0');
            }
          },
        });

        items.forEach((item, i) => {
          if (i === 0) return;
          const prev = items[i - 1];
          const t = FIRST + (i - 1) * STEP;
          tl.to($('.treat__text', prev), { autoAlpha: 0, y: -40, duration: 0.5 }, t)
            .to($('.treat__media img', prev), { scale: 1.12, duration: DUR }, t)
            .to($('.treat__media', item), { clipPath: 'inset(0% 0% 0% 0%)', duration: DUR }, t)
            .to($('.treat__media img', item), { scale: 1, duration: DUR }, t)
            .to($('.treat__text', item), { autoAlpha: 1, y: 0, duration: 0.5 }, t + 0.3);
        });
        tl.to({}, { duration: 0.01 }, total);
      } else {
        /* Mobile/tablet: blocos empilhados, sem pin */
        items.forEach((item) => {
          gsap.from($('.treat__text', item), {
            y: 40, opacity: 0, duration: 1, ease: 'expo.out',
            scrollTrigger: { trigger: item, start: 'top 82%', once: true },
          });
          gsap.fromTo($('.treat__media', item), { clipPath: 'inset(0% 0% 100% 0%)' }, {
            clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut',
            scrollTrigger: { trigger: item, start: 'top 75%', once: true },
          });
        });
      }

      /* Rodapé do cuidado: leve deslocamento da citação */
      if (desktop) {
        gsap.to('.care__quote', {
          yPercent: -6, ease: 'none',
          scrollTrigger: { trigger: '.care', start: 'top bottom', end: 'bottom top', scrub: true },
        });
      }
    }
  );

  initCursor();

  /* Recalcula posições quando fontes/imagens terminam de carregar */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());

  /* Limpeza explícita (útil se o site for embutido em SPA) */
  window.TondelliSite = {
    destroy() {
      mm.revert();
      ScrollTrigger.getAll().forEach((st) => st.kill());
      if (lenis) lenis.destroy();
    },
  };
})();
