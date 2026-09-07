import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyBrandDocumentHead, getWw360LogoPath, WW360_LOGO_SIZE } from '@/utils/brandHost';
import { initGa4, trackPageView } from '@/lib/ga4';
import {
  WW360_SLIDE_INTERVAL_MS,
  WW360_SLIDES,
  WW360_STAGE_SLIDES,
  WW360_STAGE_TRANSITION_MS,
} from './ww360LandingSlides';
import Workforce360AccessForm from './Workforce360AccessForm';
import './Workforce360Landing.css';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Sora:wght@600;700&display=swap';

type PartnersLinkGeom = {
  origin: { x: number; y: number };
  aqua: { x: number; y: number };
  oww: { x: number; y: number };
  width: number;
  height: number;
};

/** Intrinsic center of the "0" in workforce-360-logo-on-dark.png (745×494). */
const PARTNERS_ORIGIN_FRAC_X = 0.926;
const PARTNERS_ORIGIN_FRAC_Y = 0.532;

/** Rendered bitmap rect for object-fit: contain + object-position (default left center). */
function getObjectFitContentRect(img: HTMLImageElement): DOMRect | null {
  const { naturalWidth, naturalHeight } = img;
  if (!naturalWidth || !naturalHeight) return null;

  const box = img.getBoundingClientRect();
  const scale = Math.min(box.width / naturalWidth, box.height / naturalHeight);
  const contentW = naturalWidth * scale;
  const contentH = naturalHeight * scale;

  const style = getComputedStyle(img);
  const pos = style.objectPosition.trim().split(/\s+/);
  const posX = pos[0] ?? '50%';
  const posY = pos[1] ?? pos[0] ?? '50%';

  const resolveAxis = (token: string, axisSize: number, contentSize: number) => {
    if (token.endsWith('%')) {
      const pct = parseFloat(token) / 100;
      return (axisSize - contentSize) * pct;
    }
    if (token === 'left' || token === 'top') return 0;
    if (token === 'right' || token === 'bottom') return axisSize - contentSize;
    if (token === 'center') return (axisSize - contentSize) / 2;
    const px = parseFloat(token);
    return Number.isFinite(px) ? px : (axisSize - contentSize) / 2;
  };

  const offsetX = resolveAxis(posX, box.width, contentW);
  const offsetY = resolveAxis(posY, box.height, contentH);

  return new DOMRect(box.left + offsetX, box.top + offsetY, contentW, contentH);
}

/** Text-only partner names on the right. Hub keeps the official WW360 logo asset. */
function AquaSafePartnerMark() {
  return (
    <div className="ww360-aquasafe-mark" aria-hidden="true">
      <div className="ww360-partner-block" data-partner="aquasafe">
        <span className="ww360-aquasafe-mark__name" data-partner-text="aquasafe">
          AquaSafe
        </span>
      </div>
    </div>
  );
}

function OwwPartnerMark() {
  return (
    <div className="ww360-oww-mark" aria-hidden="true">
      <div className="ww360-partner-block" data-partner="oww">
        <span className="ww360-oww-mark__line" data-partner-line="oww-1">
          ONE WATER
        </span>
        <span className="ww360-oww-mark__line" data-partner-line="oww-2">
          WORKFORCE
        </span>
      </div>
    </div>
  );
}

function PartnersDiagram() {
  const frameRef = useRef<HTMLElement | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const [geom, setGeom] = useState<PartnersLinkGeom | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const logoImg = logoImgRef.current;
      const aquaText = frame.querySelector<HTMLElement>('[data-partner-text="aquasafe"]');
      const oww1 = frame.querySelector<HTMLElement>('[data-partner-line="oww-1"]');
      const oww2 = frame.querySelector<HTMLElement>('[data-partner-line="oww-2"]');
      if (!logoImg || !aquaText || !oww1 || !oww2) return;

      const frameBox = frame.getBoundingClientRect();
      const aquaBox = aquaText.getBoundingClientRect();
      const l1 = oww1.getBoundingClientRect();
      const l2 = oww2.getBoundingClientRect();

      // OWW: vertical mid of BOTH lines (never first-line-only)
      const owwLeft = Math.min(l1.left, l2.left);
      const anchorPad = Math.max(12, Math.min(22, frameBox.width * 0.014));
      // Sit in the gap between the two OWW lines (visually between, not on line 1)
      const owwGapMidY = (l1.bottom + l2.top) / 2 - frameBox.top;

      const stacked = frameBox.width < 700;
      const logoWrap = frame.querySelector('.ww360-stage__partners-logo-wrap');
      const logoBox = logoWrap?.getBoundingClientRect();
      const contentRect = getObjectFitContentRect(logoImg);

      let origin: { x: number; y: number };
      // Mobile stack: fork from bottom of logo down to partners
      if (stacked && logoBox) {
        origin = {
          x: logoBox.left - frameBox.left + logoBox.width / 2,
          y: logoBox.bottom - frameBox.top - 2,
        };
      } else if (contentRect) {
        origin = {
          x:
            contentRect.left +
            contentRect.width * PARTNERS_ORIGIN_FRAC_X -
            frameBox.left,
          y:
            contentRect.top +
            contentRect.height * PARTNERS_ORIGIN_FRAC_Y -
            frameBox.top,
        };
      } else {
        return;
      }

      setGeom({
        width: Math.max(1, frameBox.width),
        height: Math.max(1, frameBox.height),
        origin,
        aqua: {
          x: aquaBox.left - frameBox.left - anchorPad,
          y: aquaBox.top - frameBox.top + aquaBox.height / 2,
        },
        oww: {
          x: owwLeft - frameBox.left - anchorPad,
          y: owwGapMidY,
        },
      });
    };

    const run = () => {
      measure();
      requestAnimationFrame(() => measure());
    };

    run();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null;
    ro?.observe(frame);
    window.addEventListener('resize', run);
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(run);
    }
    const t1 = window.setTimeout(run, 50);
    const t2 = window.setTimeout(run, 300);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', run);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const curve = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = Math.max(40, (to.x - from.x) * 0.5);
    return `M${from.x},${from.y} C${from.x + dx},${from.y} ${to.x - dx},${to.y} ${to.x},${to.y}`;
  };

  const node = (p: { x: number; y: number }, r = 8) => (
    <>
      <circle cx={p.x} cy={p.y} r={r} fill="#07111f" stroke="#38bdf8" strokeWidth="3.25" />
      <circle cx={p.x} cy={p.y} r={r * 0.42} fill="#38bdf8" />
    </>
  );

  return (
    <figure
      ref={frameRef}
      className="ww360-stage__partners"
      role="img"
      aria-label="Workforce 360 connects AquaSafe and One Water Workforce"
    >
      {geom ? (
        <svg
          className="ww360-stage__partners-links"
          viewBox={`0 0 ${geom.width} ${geom.height}`}
          width={geom.width}
          height={geom.height}
          aria-hidden="true"
        >
          <path
            d={curve(geom.origin, geom.aqua)}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.75"
            strokeOpacity="0.95"
            strokeLinecap="round"
          />
          <path
            d={curve(geom.origin, geom.oww)}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.75"
            strokeOpacity="0.95"
            strokeLinecap="round"
          />
          {node(geom.origin, 9)}
          {node(geom.aqua, 8)}
          {node(geom.oww, 8)}
        </svg>
      ) : null}

      <div className="ww360-stage__partners-hub">
        <div className="ww360-stage__partners-logo-wrap">
          <img
            ref={logoImgRef}
            className="ww360-stage__partners-logo ww360-stage__partners-logo--ww360"
            src={getWw360LogoPath('dark')}
            alt=""
            onLoad={() => window.dispatchEvent(new Event('resize'))}
          />
        </div>
      </div>
      <div className="ww360-stage__partners-nodes">
        <div className="ww360-stage__partners-node ww360-stage__partners-node--aquasafe">
          <AquaSafePartnerMark />
        </div>
        <div className="ww360-stage__partners-node ww360-stage__partners-node--oww">
          <OwwPartnerMark />
        </div>
      </div>
    </figure>
  );
}

function ensureWw360Fonts(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ww360-fonts')) return;
  const link = document.createElement('link');
  link.id = 'ww360-fonts';
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

/**
 * Public marketing landing for waterworkforce360.org (OWW × AquaSafe).
 * Main stage = full-bleed hero rotator; capability copy is editable later.
 */
const Workforce360Landing: React.FC = () => {
  const [active, setActive] = useState(0);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [autoplay, setAutoplay] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const pausedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  const stage = WW360_STAGE_SLIDES[active] ?? WW360_STAGE_SLIDES[0];
  const slideCount = WW360_STAGE_SLIDES.length;

  useEffect(() => {
    ensureWw360Fonts();
    applyBrandDocumentHead();
    initGa4();
    trackPageView('/');
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Deep link: /?slide=partners or /preview/partners — opens that slide and pauses autoplay
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const raw =
      params.get('slide') ||
      (window.location.pathname.includes('/preview/partners') ? 'partners' : null);
    if (!raw) return;
    const idx = WW360_STAGE_SLIDES.findIndex(s => s.id === raw.trim().toLowerCase());
    if (idx < 0) return;
    setActive(idx);
    setAutoplay(false);
    setOutgoing(null);
  }, []);

  const goTo = useCallback(
    (index: number, direction: 'next' | 'prev' = 'next', manual = false) => {
      const nextIndex = ((index % slideCount) + slideCount) % slideCount;
      setActive(current => {
        if (nextIndex === current) return current;
        setDir(direction);
        if (!reducedMotion) {
          setOutgoing(current);
          if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = window.setTimeout(() => {
            setOutgoing(null);
          }, WW360_STAGE_TRANSITION_MS);
        } else {
          setOutgoing(null);
        }
        return nextIndex;
      });
      if (manual) setAutoplay(false);
    },
    [reducedMotion, slideCount]
  );

  const goPrev = useCallback(() => {
    goTo(active - 1, 'prev', true);
  }, [active, goTo]);

  const goNext = useCallback(
    (manual = true) => {
      goTo(active + 1, 'next', manual);
    },
    [active, goTo]
  );

  useEffect(() => {
    if (!autoplay || reducedMotion || pausedRef.current) return;
    timerRef.current = window.setInterval(() => {
      if (pausedRef.current) return;
      setActive(current => {
        const nextIndex = (current + 1) % slideCount;
        setDir('next');
        if (!reducedMotion) {
          setOutgoing(current);
          if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
          transitionTimerRef.current = window.setTimeout(() => {
            setOutgoing(null);
          }, WW360_STAGE_TRANSITION_MS);
        }
        return nextIndex;
      });
    }, WW360_SLIDE_INTERVAL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [autoplay, reducedMotion, active, slideCount]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
    };
  }, []);

  const onStageEnter = () => {
    pausedRef.current = true;
  };
  const onStageLeave = () => {
    pausedRef.current = false;
  };

  const closeNav = () => setNavOpen(false);

  return (
    <div
      className={`ww360-land${reducedMotion ? ' ww360-land--reduced' : ''}${
        navOpen ? ' ww360-land--nav-open' : ''
      }`}
      style={{ ['--ww360-slide-ms' as string]: `${WW360_SLIDE_INTERVAL_MS}ms` }}
    >
      <header className="ww360-nav">
        <a className="ww360-nav__brand" href="#top" onClick={closeNav}>
          <img
            className="ww360-nav__logo"
            src={getWw360LogoPath('dark')}
            alt="Workforce 360"
          />
        </a>
        <ul className="ww360-nav__links ww360-nav__links--desktop">
          <li>
            <a href="#capabilities">Capabilities</a>
          </li>
          <li>
            <a href="#how-it-works">How it works</a>
          </li>
          <li>
            <a href="#partnership">Partnership</a>
          </li>
        </ul>
        <div className="ww360-nav__actions ww360-nav__actions--desktop">
          <Link className="ww360-btn ww360-btn--ghost ww360-btn--sm" to="/login">
            Log in
          </Link>
          <a className="ww360-btn ww360-btn--primary ww360-btn--sm" href="#request-access">
            Join Water Workforce 360
          </a>
        </div>
        <button
          type="button"
          className="ww360-nav__toggle"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          aria-controls="ww360-mobile-nav"
          onClick={() => setNavOpen(open => !open)}
        >
          <span className="ww360-nav__toggle-bars" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </button>
      </header>

      <div
        id="ww360-mobile-nav"
        className={`ww360-nav__drawer${navOpen ? ' is-open' : ''}`}
        aria-hidden={!navOpen}
      >
        <nav aria-label="Mobile">
          <ul className="ww360-nav__drawer-links">
            <li>
              <a href="#capabilities" onClick={closeNav}>
                Capabilities
              </a>
            </li>
            <li>
              <a href="#how-it-works" onClick={closeNav}>
                How it works
              </a>
            </li>
            <li>
              <a href="#partnership" onClick={closeNav}>
                Partnership
              </a>
            </li>
          </ul>
          <div className="ww360-nav__drawer-actions">
            <Link className="ww360-btn ww360-btn--ghost" to="/login" onClick={closeNav}>
              Log in
            </Link>
            <a
              className="ww360-btn ww360-btn--primary"
              href="#request-access"
              onClick={closeNav}
            >
              Join Water Workforce 360
            </a>
          </div>
        </nav>
      </div>
      {navOpen ? (
        <button
          type="button"
          className="ww360-nav__backdrop"
          aria-label="Close menu"
          onClick={closeNav}
        />
      ) : null}

      <section
        className={`ww360-hero ww360-stage${stage.partnersFocus ? ' is-partners' : ''}`}
        id="top"
        data-dir={dir}
        data-animating={outgoing !== null ? '1' : '0'}
        onMouseEnter={onStageEnter}
        onMouseLeave={onStageLeave}
        onFocusCapture={onStageEnter}
        onBlurCapture={onStageLeave}
        aria-roledescription="carousel"
        aria-label="Workforce 360 highlights"
      >
        {WW360_STAGE_SLIDES.map((slide, i) => {
          if (slide.partnersFocus) return null;
          const isActive = i === active;
          const isOutgoing = i === outgoing;
          return (
            <div
              key={slide.id}
              className={`ww360-stage__bg${isActive ? ' is-active' : ''}${
                isOutgoing ? ' is-outgoing' : ''
              }`}
              style={{
                backgroundImage: `url('${slide.image}')`,
                ...(slide.focus ? { backgroundPosition: slide.focus } : {}),
              }}
              role="img"
              aria-label={slide.alt}
              aria-hidden={!isActive}
            />
          );
        })}
        <div className="ww360-hero__veil" aria-hidden />

        {stage.partnersFocus ? (
          <PartnersDiagram />
        ) : (
          <div className="ww360-hero__inner">
            <div className="ww360-stage__brand-lockup">
              <img
                className="ww360-stage__logo"
                src={getWw360LogoPath('dark')}
                alt="Workforce 360"
              />
            </div>

            <div className="ww360-stage__copy" key={stage.id}>
              {!stage.logoFocus ? (
                <p className="ww360-stage__kicker">{stage.label}</p>
              ) : null}

              <h1>
                {stage.headlineAccent ? (
                  <>
                    {stage.headline} <em>{stage.headlineAccent}</em>
                  </>
                ) : (
                  stage.headline
                )}
              </h1>
              <p className="ww360-hero__lede">{stage.body}</p>

              <div className="ww360-hero__ctas">
                <a className="ww360-btn ww360-btn--primary" href="#request-access">
                  Join Water Workforce 360
                </a>
                <Link className="ww360-btn ww360-btn--ghost" to="/login">
                  Log in
                </Link>
              </div>
              <p className="ww360-hero__trust">
                Built with One Water Workforce · for New York water districts
              </p>
            </div>
          </div>
        )}

        <div className="ww360-stage__controls" aria-label="Stage navigation">
          <button
            type="button"
            className="ww360-stage__arrow ww360-stage__arrow--prev"
            aria-label="Previous slide"
            onClick={goPrev}
          >
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="M14.5 5.5 8 12l6.5 6.5" />
            </svg>
          </button>

          <div className="ww360-stage__dots" role="tablist" aria-label="Stage slides">
            {WW360_STAGE_SLIDES.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={slide.label}
                className="ww360-stage__dot"
                onClick={() =>
                  goTo(
                    i,
                    i > active || (active === slideCount - 1 && i === 0) ? 'next' : 'prev',
                    true
                  )
                }
              >
                {i === active && autoplay && !reducedMotion ? (
                  <span className="ww360-stage__dot-progress" aria-hidden />
                ) : null}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="ww360-stage__arrow ww360-stage__arrow--next"
            aria-label="Next slide"
            onClick={() => goNext(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="M9.5 5.5 16 12l-6.5 6.5" />
            </svg>
          </button>
        </div>

        <div className="ww360-hero__shear" aria-hidden />
      </section>

      <section className="ww360-section ww360-section--cream" id="capabilities">
        <div className="ww360-wrap">
          <p className="ww360-section__kicker">Employer-side planning</p>
          <h2 className="ww360-section__title">What Water Workforce 360 delivers</h2>
          <p className="ww360-section__intro">
            One Water Workforce builds the candidate pipeline. Water Workforce 360 is the utility-side
            system that documents workforce demand — staffing, vacancies, retirements, succession
            risks, and training needs — so outreach and candidate development can start before
            positions go critical.
          </p>
          <ul className="ww360-capability-list">
            {WW360_SLIDES.map(slide => (
              <li key={slide.id}>
                <strong>{slide.label}</strong>
                <span>{slide.body}</span>
              </li>
            ))}
          </ul>
          <div className="ww360-bridge">
            <p className="ww360-bridge__lead">Supply meets demand</p>
            <p>
              Candidate-side data from One Water Workforce and employer-side data from Workforce 360
              create a workforce-planning cycle: identify utility needs, review the talent pipeline,
              close training and certification gaps, connect candidates with employers, and support
              retention after hire.
            </p>
          </div>
        </div>
      </section>

      <section className="ww360-section ww360-section--deep">
        <div className="ww360-wrap">
          <p className="ww360-section__kicker">Why it matters</p>
          <h2 className="ww360-section__title">From reactive hiring to proactive planning</h2>
          <p className="ww360-section__intro">
            Small and rural utilities often lack dedicated recruitment capacity. Workforce 360 gives
            employers a structured way to communicate current and future workforce needs — with
            confidentiality respected as data is aggregated for regional insight.
          </p>
          <div className="ww360-stats">
            <div className="ww360-stat">
              <strong>Document demand</strong>
              <span>Vacancies, retirements, succession risks, and critical positions in one place</span>
            </div>
            <div className="ww360-stat">
              <strong>Connect to OWW</strong>
              <span>Utility needs inform statewide outreach, training, and candidate development</span>
            </div>
            <div className="ww360-stat">
              <strong>Retain your team</strong>
              <span>CE tracking, certification advancement, and readiness after employment</span>
            </div>
            <div className="ww360-stat">
              <strong>Partner rollout</strong>
              <span>Utilities join through the One Water Workforce × AquaSafe partnership</span>
            </div>
          </div>
        </div>
      </section>

      <section className="ww360-section ww360-section--white" id="how-it-works">
        <div className="ww360-wrap">
          <p className="ww360-section__kicker">Workforce planning cycle</p>
          <h2 className="ww360-section__title">From utility need to retained workforce</h2>
          <p className="ww360-section__intro">
            Water Workforce 360 is the employer-side component of the One Water Workforce model —
            connecting documented utility demand with training, certification, employment, and
            long-term career support.
          </p>
          <div className="ww360-steps">
            <div className="ww360-step">
              <div className="ww360-step__n">01 — Identify</div>
              <h3>Utility workforce needs</h3>
              <p>
                Document staffing, anticipated openings, retirements, succession risks, and training
                or certification gaps in Workforce 360.
              </p>
            </div>
            <div className="ww360-step">
              <div className="ww360-step__n">02 — Develop</div>
              <h3>Candidate pipeline</h3>
              <p>
                One Water Workforce uses that intelligence to target outreach, training connections,
                and certification support before vacancies become critical.
              </p>
            </div>
            <div className="ww360-step">
              <div className="ww360-step__n">03 — Retain</div>
              <h3>Advancement &amp; readiness</h3>
              <p>
                After hire, CE proof, coverage visibility, and renewal tracking keep the district
                record current — supporting retention, not just placement.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="ww360-section ww360-section--cream" id="partnership">
        <div className="ww360-wrap ww360-partner">
          <div>
            <p className="ww360-section__kicker">One Water Workforce × AquaSafe</p>
            <h2 className="ww360-section__title">
              OWW builds the pipeline. Workforce 360 holds employer intelligence.
            </h2>
            <p className="ww360-section__intro">
              One Water Workforce connects individuals to careers, training, and certification.
              Water Workforce 360 gives utilities a structured tool to document and communicate
              workforce demand — so both sides of the pipeline work together.
            </p>
            <a className="ww360-btn ww360-btn--ink" href="#request-access">
              Join Water Workforce 360
            </a>
          </div>
          <div className="ww360-partner__card">
            <h3 style={{ marginTop: 0, fontFamily: 'var(--font-display)' }}>
              Where each system fits
            </h3>
            <ul>
              <li>
                <strong>One Water Workforce</strong> — candidate awareness, training pathways,
                certification roadmaps, and employment connections
              </li>
              <li>
                <strong>Water Workforce 360</strong> — employer staffing, vacancies, retirements,
                succession planning, and training needs
              </li>
              <li>
                <strong>Together</strong> — workforce supply meets workforce demand across New York
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="ww360-section ww360-section--deep ww360-final" id="request-access">
        <h2>Share your utility&apos;s workforce needs.</h2>
        <p>
          Join Water Workforce 360 to document staffing, anticipated vacancies, and succession
          planning — or log in if your district is already enrolled.
        </p>
        <Workforce360AccessForm />
      </section>

      <footer className="ww360-footer">
        <div className="ww360-footer__inner">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
            <img
              className="ww360-footer__logo"
              src={getWw360LogoPath('dark')}
              alt="Workforce 360"
              style={{ height: WW360_LOGO_SIZE.navMinPx, minHeight: WW360_LOGO_SIZE.navMinPx }}
            />
            <span style={{ fontSize: '0.95rem', color: 'var(--ww360-on-dark-muted)' }}>
              waterworkforce360.org
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to="/login">Log in</Link>
            <span style={{ fontSize: '1rem' }}>Partnered with One Water Workforce</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Workforce360Landing;
