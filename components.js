(function () {
  'use strict';

  /* ── Schedule baseline (mirrors FIXED_SCHEDULE_SITE in index.html) ── */
  const _PF_FIXED = [
    {id:'1-17',day:1,name:'MMA Striking',         start:'17:00',end:'18:00'},
    {id:'1-18',day:1,name:'Striking / Grappling', start:'18:00',end:'19:00'},
    {id:'1-19',day:1,name:'MMA Grappling',         start:'19:00',end:'20:30'},
    {id:'2-17',day:2,name:'MMA Striking',          start:'17:00',end:'18:00'},
    {id:'2-18',day:2,name:'MMA Striking',          start:'18:00',end:'19:00'},
    {id:'2-19',day:2,name:'MMA Striking',          start:'19:00',end:'20:30'},
    {id:'3-17',day:3,name:'MMA Striking',          start:'17:00',end:'18:00'},
    {id:'3-18',day:3,name:'MMA Striking',          start:'18:00',end:'19:00'},
    {id:'3-19',day:3,name:'MMA Grappling',         start:'19:00',end:'20:30'},
    {id:'4-16',day:4,name:'Kids MMA',              start:'16:00',end:'17:00'},
    {id:'4-17',day:4,name:'MMA Striking',          start:'17:00',end:'18:00'},
    {id:'4-18',day:4,name:'Fight S&C',             start:'18:00',end:'19:00'},
    {id:'4-19',day:4,name:'MMA Striking',          start:'19:00',end:'20:30'},
    {id:'5-18',day:5,name:'MMA Striking Sparring', start:'18:00',end:'19:00'},
    {id:'5-19',day:5,name:'MMA Sparring',          start:'19:00',end:'20:30'},
  ];

  /* Pill colour from class name */
  function _pillCol(name) {
    const n = name.toLowerCase();
    if (n.includes('kids'))    return ['rgba(255,140,66,.14)','#FF8C42'];
    if (n.includes('grappling') || n.includes('wrestling')) return ['rgba(91,224,255,.12)','#5BE0FF'];
    if (n.includes('s&c') || n.includes('conditioning') || n.includes('kettlebell')) return ['rgba(167,139,250,.15)','#A78BFA'];
    if (n.includes('sparring') || n.includes('performance')) return ['rgba(250,204,21,.12)','#FACC15'];
    if (n.includes('bodycombat') || n.includes('personal')) return ['rgba(192,132,252,.14)','#C084FC'];
    return ['rgba(255,100,50,.13)','#FF8C42']; // Striking / MMA default
  }

  /* Render fetched slots into the popup hours grid */
  function _renderInfoHours(slots) {
    const grid = document.getElementById('infoHoursGrid');
    if (!grid) return;
    const DAY = {1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat',7:'Sun'};
    const active = (slots || []).filter(s => !s.hidden && !s.archived);
    if (!active.length) {
      grid.innerHTML = '<div class="info-hour-row" style="font-size:12px;color:var(--ink-dim)">See full schedule →</div>';
      return;
    }
    // Group by day, deduplicate session names per day
    const byDay = {};
    active.forEach(s => { (byDay[s.day] = byDay[s.day] || []).push(s); });
    grid.innerHTML = Object.keys(byDay).map(Number).sort((a,b)=>a-b).map(d => {
      const seen = new Set();
      const pills = byDay[d]
        .filter(s => { const k = s.name||s.dayName||''; if (seen.has(k)) return false; seen.add(k); return true; })
        .map(s => {
          const label = s.name || s.dayName || '';
          const [bg, col] = _pillCol(label);
          return `<span style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;padding:2px 8px;background:${bg};color:${col};white-space:nowrap">${label}</span>`;
        }).join('');
      return `<div class="info-hour-row"><span class="info-hour-day">${DAY[d]||d}</span><span class="info-hour-pills">${pills}</span></div>`;
    }).join('');
  }

  /* Load schedule: prefer window._pfSlots, fall back to Supabase REST */
  const SB_URL = 'https://nzfqsgdzbainfijbhwag.supabase.co';
  const SB_KEY = 'sb_publishable_OPR8hTocm9g1T79HTW3Qvg_y-0yj2Al';
  let _infoHoursReady = false;

  async function _loadInfoHours() {
    if (_infoHoursReady) return;
    _infoHoursReady = true;

    // Homepage already has merged live data ready
    if (window._pfSlots && window._pfSlots.length) {
      _renderInfoHours(window._pfSlots);
      return;
    }

    // Other pages: fetch overrides from Supabase and merge with baseline
    try {
      const resp = await fetch(`${SB_URL}/rest/v1/schedule_overrides?select=*`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
      });
      if (!resp.ok) throw new Error(resp.status);
      const rows = await resp.json();
      const hiddenIds = new Set((rows||[]).filter(r => r.hidden || r.archived).map(r => r.id));
      const ov = {};
      (rows||[]).forEach(r => { if (!r.hidden && !r.archived) ov[r.id] = r; });
      const merged = _PF_FIXED
        .filter(s => !hiddenIds.has(s.id))
        .map(s => {
          const o = ov[s.id];
          return { day: s.day, name: s.name,
            timeStart: o?.time_start ?? s.start,
            timeEnd:   o?.time_end   ?? s.end,
            hidden: false, archived: false };
        });
      _renderInfoHours(merged.length ? merged : _PF_FIXED.map(s => ({...s, timeStart: s.start, hidden: false, archived: false})));
    } catch(_) {
      // Network error – show fixed fallback
      _renderInfoHours(_PF_FIXED.map(s => ({...s, timeStart: s.start, hidden: false, archived: false})));
    }
  }

  const isHome = !location.pathname.match(/\/(contact|gallery|register|faq)(\.html)?$/);

  const sh   = isHome ? '#system'   : '/#system';
  const pr   = isHome ? '#programs' : '/#programs';
  const home = '/';

  /* ── NAV ───────────────────────────────────────────────────────── */
  const NAV_HTML = `
<nav class="nav" id="nav">
  <a class="brand" href="${home}">
    <div class="logo-wrap">
      <img src="logo.png" class="logo-default" alt="Power Fight">
      <img src="logo2.png" class="logo-scrolled" alt="Power Fight">
    </div>
  </a>
  <div class="mob-lang-nav">
    <button class="lang-btn active" data-lang="en">EN</button>
    <span class="lang-sep">|</span>
    <button class="lang-btn" data-lang="de">DE</button>
  </div>
  <div class="nav-cta">
    <div class="nav-links">
      <a href="${sh}">Schedules</a>
      <a href="${pr}">Trainings</a>
      <a href="/contact" data-nav-contact>Contact</a>
      <a href="/faq" data-nav-faq>FAQ</a>
    </div>
    <div class="lang-switch">
      <button class="lang-btn active" data-lang="en">EN</button>
      <span class="lang-sep">|</span>
      <button class="lang-btn" data-lang="de">DE</button>
    </div>
    <button class="btn btn-ghost" id="infoBtn" onclick="openInfoPopup()">
      <span style="display:inline-flex;align-items:center;gap:0.5rem"><span>Info</span><svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;position:relative;z-index:1"><circle cx="7" cy="7" r="6"/><line x1="7" y1="6" x2="7" y2="10"/><circle cx="7" cy="4" r="0.5" fill="currentColor" stroke="none"/></svg></span>
    </button>
    <a class="btn btn-primary" href="${sh}"><span>See Schedules</span></a>
  </div>
  <button class="hamburger" id="hamburger" aria-label="Open menu">
    <span></span><span></span>
  </button>
</nav>`;

  /* ── MOBILE MENU ────────────────────────────────────────────────── */
  const MOB_HTML = `
<div class="mob-menu" id="mobMenu">
  <div class="mob-menu-header">
    <img src="logo.png" alt="Power Fight">
    <button class="mob-close" id="mobClose" aria-label="Close menu">
      <svg viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/></svg>
    </button>
  </div>
  <nav>
    <a href="${sh}" class="mob-link">Schedules</a>
    <a href="${pr}" class="mob-link">Trainings</a>
    <a href="/contact" class="mob-link">Contact</a>
    <a href="/faq" class="mob-link">FAQ</a>
    <a href="#voices" class="mob-link">Info</a>
  </nav>
  <div class="mob-cta">
    <a class="btn btn-primary" href="${sh}"><span>See Schedules</span></a>
    <a class="btn btn-ghost" href="/contact"><span>Contact</span></a>
  </div>
  <div class="lang-switch mob-lang">
    <button class="lang-btn active" data-lang="en">EN</button>
    <span class="lang-sep">|</span>
    <button class="lang-btn" data-lang="de">DE</button>
  </div>
  <div class="mob-social">
    <a href="https://www.instagram.com/powerfightteam" target="_blank" rel="noopener" aria-label="Instagram">
      <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
    </a>
    <a href="https://www.facebook.com/p/Power-Fight-Team-100068990680962/" target="_blank" rel="noopener" aria-label="Facebook – Power Fight">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    </a>
    <a href="https://www.youtube.com/@germoofficial-experienceta1157" target="_blank" rel="noopener" aria-label="YouTube">
      <svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
    </a>
  </div>
</div>`;

  /* ── FOOTER ─────────────────────────────────────────────────────── */
  const FOOTER_HTML = `
<footer>
  <div class="foot-top">
    <div class="foot-brand">
      <a href="${home}" style="display:block;margin-bottom:20px;line-height:0"><img src="logo2.png" alt="Power Fight" style="height:4rem;width:auto;display:block"></a>
      <p data-i18n="foot.brand">A serious training environment for fighters who are serious about getting better. Open to all levels — built for those who want to compete.</p>
      <div class="foot-contact">
        <div class="foot-contact-name">Power Fight Team</div>
        <div>Pfeffingerring 201, 4147 Aesch</div>
        <a href="https://www.google.com/maps/search/?api=1&query=Pfeffingerring+201,+4147+Aesch,+Switzerland" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-dim);margin-top:2px;transition:color .3s" onmouseover="this.style.color='var(--lime)'" onmouseout="this.style.color='var(--ink-dim)'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>Open in Maps</a>
        <a href="tel:+41788937929">+41788937929</a>
        <a href="mailto:Nurmsoog@gmail.com">Nurmsoog@gmail.com</a>
      </div>
    </div>
    <div class="foot-col">
      <h5>Schedule</h5>
      <ul style="gap:14px">
        <li><a href="/#system" class="foot-sched-row"><span>Monday</span><span class="foot-pills"><span class="foot-pill fp-strike">Striking</span><span class="foot-pill fp-grapple">Grappling</span></span></a></li>
        <li><a href="/#system" class="foot-sched-row"><span>Tuesday</span><span class="foot-pills"><span class="foot-pill fp-strike">Striking</span></span></a></li>
        <li><a href="/#system" class="foot-sched-row"><span>Wednesday</span><span class="foot-pills"><span class="foot-pill fp-strike">Striking</span><span class="foot-pill fp-grapple">Grappling</span></span></a></li>
        <li><a href="/#system" class="foot-sched-row"><span>Thursday</span><span class="foot-pills"><span class="foot-pill fp-kids">Kids</span><span class="foot-pill fp-strike">Striking</span><span class="foot-pill fp-sc">S&amp;C</span></span></a></li>
        <li><a href="/#system" class="foot-sched-row"><span>Friday</span><span class="foot-pills"><span class="foot-pill fp-sparring">Sparring</span></span></a></li>
        <li><span class="foot-sched-row" style="opacity:0.4"><span>Saturday</span><span style="font-size:10px;letter-spacing:0.14em;color:var(--ink-mute)">Closed</span></span></li>
        <li><span class="foot-sched-row" style="opacity:0.4"><span>Sunday</span><span style="font-size:10px;letter-spacing:0.14em;color:var(--ink-mute)">Closed</span></span></li>
      </ul>
    </div>
    <div class="foot-col">
      <h5>Trainings</h5>
      <ul>
        <li><a href="/#programs">MMA Striking</a></li>
        <li><a href="/#programs">MMA Grappling</a></li>
        <li><a href="/#programs">Les Mills Bodycombat</a></li>
        <li><a href="/#programs">Kids MMA</a></li>
        <li><a href="/#programs">Professional</a></li>
        <li><a href="/booking" style="color:var(--lime)">Private Bookings →</a></li>
      </ul>
    </div>
    <div class="foot-col">
      <h5>Follow Us</h5>
      <ul>
        <li><a href="https://www.instagram.com/powerfightteam" target="_blank" rel="noopener">Instagram – Power Fight</a></li>
        <li><a href="https://www.facebook.com/p/Power-Fight-Team-100068990680962/" target="_blank" rel="noopener">Facebook – Power Fight</a></li>
        <li><a href="https://www.youtube.com/@germoofficial-experienceta1157" target="_blank" rel="noopener">YouTube</a></li>
      </ul>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:20px">
        <a class="btn btn-ghost" href="/contact" style="font-size:10px;padding:11px 18px"><span>Contact Us</span></a>
        <button onclick="openFeedbackModal()" style="background:none;border:none;padding:0;text-align:left;cursor:pointer;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-dim);margin-top:6px;transition:color .2s" onmouseover="this.style.color='var(--lime)'" onmouseout="this.style.color='var(--ink-dim)'">Leave Feedback →</button>
      </div>
    </div>
  </div>
  <div class="foot-bottom" style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
    <span>&copy; 2026 Power Fight Team</span>
    <a href="/admin" style="display:inline-flex;align-items:center;justify-content:center;padding:7px 16px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-dim);border:1px solid var(--line-2);background:transparent;transition:color .2s,border-color .2s" onmouseover="this.style.color='var(--ink)';this.style.borderColor='rgba(255,255,255,0.18)'" onmouseout="this.style.color='var(--ink-dim)';this.style.borderColor='var(--line-2)'">Admin</a>
  </div>
</footer>`;

  /* ── INFO POPUP ──────────────────────────────────────────────────── */
  const POPUP_HTML = `
<div class="info-popup-overlay" id="infoPopup">
  <div class="info-popup">
    <div class="info-popup-head">
      <img src="logo2.png" alt="Power Fight">
      <button class="info-popup-close" onclick="closeInfoPopup()">
        <svg viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/></svg>
      </button>
    </div>
    <div class="info-popup-body">
      <div class="info-row">
        <div class="info-icon"><svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg></div>
        <div>
          <div class="info-label">Address</div>
          <div class="info-val">Pfeffingerring 201<br>4147 Aesch, Switzerland</div>
          <a href="https://www.google.com/maps/search/?api=1&query=Pfeffingerring+201,+4147+Aesch,+Switzerland" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-dim);margin-top:6px;transition:color .3s" onmouseover="this.style.color='var(--lime)'" onmouseout="this.style.color='var(--ink-dim)'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>Open in Maps</a>
        </div>
      </div>
      <div class="info-row">
        <div class="info-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.12 7.1 19.79 19.79 0 01.07 4.5 2 2 0 012 2.36h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg></div>
        <div>
          <div class="info-label">Phone</div>
          <div class="info-val"><a href="tel:+41788937929">+41 78 893 79 29</a></div>
        </div>
      </div>
      <div class="info-row">
        <div class="info-icon"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>
        <div>
          <div class="info-label">Email</div>
          <div class="info-val"><a href="mailto:Nurmsoog@gmail.com">Nurmsoog@gmail.com</a></div>
        </div>
      </div>
      <div class="info-row">
        <div class="info-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg></div>
        <div style="flex:1">
          <div class="info-label">Training Hours</div>
          <div class="info-hours-grid" id="infoHoursGrid">
            <div class="info-hour-row" style="opacity:.4;font-size:12px;color:var(--ink-dim)">Loading schedule…</div>
          </div>
        </div>
      </div>
    </div>
    <div class="info-popup-cta">
      <a class="btn btn-primary" href="${sh}" onclick="closeInfoPopup()"><span>See Schedules</span></a>
    </div>
  </div>
</div>`;

  // ── bfcache: reload on back-navigation to prevent black screen ──────
  window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });

  /* ── PUBLIC API ──────────────────────────────────────────────────── */
  window.initComponents = function (pageId) {
    // Inject nav + mobile menu
    const navRoot = document.getElementById('nav-root');
    if (navRoot) {
      navRoot.insertAdjacentHTML('beforebegin', NAV_HTML + MOB_HTML);
      navRoot.remove();
    }

    // Inject footer + info popup
    const footRoot = document.getElementById('footer-root');
    if (footRoot) {
      footRoot.insertAdjacentHTML('beforebegin', FOOTER_HTML + POPUP_HTML);
      footRoot.remove();
    }

    // Mark active nav link
    if (pageId === 'contact') {
      const contactLink = document.querySelector('[data-nav-contact]');
      if (contactLink) contactLink.classList.add('active');
    }
    if (pageId === 'faq') {
      const faqLink = document.querySelector('[data-nav-faq]');
      if (faqLink) faqLink.classList.add('active');
    }

    // Nav scroll
    const nav = document.getElementById('nav');
    if (nav) {
      window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 1));
    }

    // Hamburger / mobile menu
    const hamburger = document.getElementById('hamburger');
    const mobMenu   = document.getElementById('mobMenu');

    window.lockScroll = function () {
      const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
      const y = window.scrollY;
      document.body.style.paddingRight = scrollbarW + 'px';
      document.body.style.position = 'fixed';
      document.body.style.top      = `-${y}px`;
      document.body.style.width    = '100%';
      document.body.dataset.scrollY = y;
    };

    window.unlockScroll = function () {
      const y = parseInt(document.body.dataset.scrollY || '0');
      document.body.style.position    = '';
      document.body.style.top         = '';
      document.body.style.width       = '';
      document.body.style.paddingRight = '';
      window.scrollTo(0, y);
    };

    function closeMenu() {
      if (hamburger) hamburger.classList.remove('open');
      if (mobMenu)   mobMenu.classList.remove('open');
      window.unlockScroll();
    }

    if (hamburger && mobMenu) {
      hamburger.addEventListener('click', () => {
        const open = hamburger.classList.toggle('open');
        mobMenu.classList.toggle('open', open);
        open ? window.lockScroll() : window.unlockScroll();
      });
    }

    const mobClose = document.getElementById('mobClose');
    if (mobClose) mobClose.addEventListener('click', closeMenu);

    document.querySelectorAll('.mob-link').forEach(a => a.addEventListener('click', closeMenu));

    // Info popup
    window.openInfoPopup = function () {
      const popup = document.getElementById('infoPopup');
      if (popup) { popup.classList.add('open'); window.lockScroll(); }
      _loadInfoHours(); // fetch & render live schedule data
    };

    window.closeInfoPopup = function () {
      const popup = document.getElementById('infoPopup');
      if (popup) { popup.classList.remove('open'); window.unlockScroll(); }
    };

    // Backdrop click closes popup
    const infoPopup = document.getElementById('infoPopup');
    if (infoPopup) {
      infoPopup.addEventListener('click', e => {
        if (e.target === infoPopup) window.closeInfoPopup();
      });
    }

    // Escape key closes popup
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') window.closeInfoPopup();
    });

    // ── Scroll progress bar ─────────────────────────────────────────
    const scrollBar = document.createElement('div');
    scrollBar.id = 'scrollBar';
    scrollBar.style.cssText = 'position:fixed;top:0;left:0;height:2px;background:var(--lime);z-index:9999;width:0%;pointer-events:none';
    document.body.prepend(scrollBar);
    window.addEventListener('scroll', () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0) scrollBar.style.width = (window.scrollY / max * 100) + '%';
    }, { passive: true });

    // ── Page transition ─────────────────────────────────────────────
    const pt = document.createElement('div');
    pt.id = 'pageTransition';
    pt.style.cssText = 'position:fixed;inset:0;background:var(--bg,#040505);z-index:9998;opacity:1;pointer-events:none;transition:opacity 0.35s ease';
    document.body.prepend(pt);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      pt.style.opacity = '0';
      // Scroll to hash after overlay fades (native hash scroll is blocked by the overlay)
      if (window.location.hash) {
        setTimeout(() => {
          const target = document.querySelector(window.location.hash);
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        }, 380);
      }
    }));
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || a.getAttribute('target') === '_blank') return;
      a.addEventListener('click', e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        pt.style.opacity = '1';
        pt.style.pointerEvents = 'all';
        const dest = href;
        setTimeout(() => { window.location.href = dest; }, 340);
      });
    });

    // ── Bottom row: sticky CTA + WhatsApp side by side ─────────────
    const stickyStyle = document.createElement('style');
    stickyStyle.textContent = `
      #bottomRow{position:fixed;bottom:20px;left:32px;right:32px;z-index:8888;display:flex;align-items:center;gap:12px;pointer-events:none;transform:translateY(calc(100% + 28px));opacity:0;transition:transform .45s cubic-bezier(.16,1,.3,1),opacity .45s ease}
      #bottomRow.visible{transform:translateY(0);opacity:1;pointer-events:all}
      #stickyCta{flex:1;min-width:0;background:rgba(4,5,5,0.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--line-2);border-radius:0;padding:14px 20px 14px 28px;transition:opacity .3s ease,transform .3s ease}
      #stickyCta.dismissed{opacity:0;transform:scale(.95);pointer-events:none}
      .sticky-cta-inner{display:flex;align-items:center;justify-content:space-between;gap:16px}
      .sticky-cta-text{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-dim);flex:1;min-width:0}
      .sticky-cta-text strong{color:var(--ink)}
      .sticky-cta-actions{display:flex;align-items:center;gap:10px;flex-shrink:0}
      .sticky-cta-btn{font-size:11px!important;padding:10px 22px!important;white-space:nowrap}
      .sticky-cta-close{background:none;border:1px solid var(--line-2);border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-dim);flex-shrink:0;transition:color .2s,border-color .2s}
      .sticky-cta-close:hover{color:var(--ink);border-color:rgba(255,255,255,0.25)}
      .sticky-cta-close svg{width:10px;height:10px;stroke:currentColor;stroke-width:2;overflow:visible}
      #waFloat{flex-shrink:0}
      .wa-btn{width:52px;height:52px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(37,211,102,.4);transition:transform .2s,box-shadow .2s;text-decoration:none}
      .wa-btn:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(37,211,102,.6)}
      .wa-btn svg{width:28px;height:28px;fill:#fff;display:block}
      @media(max-width:640px){.sticky-cta-text{display:none}#bottomRow{left:0;right:0;bottom:0;gap:0}#stickyCta{border:none;border-top:1px solid var(--line-2)}#waFloat{padding:0 14px}}
      footer{padding-bottom:calc(40px + 6rem)!important}
      @media(max-width:640px){footer{padding-bottom:calc(32px + 6rem)!important}}
      h1,h2,h3,h4,h5,h6{text-wrap:balance}
      p,li,blockquote,.faq-a-inner,.sched-card-name,.page-hero-tag{text-wrap:pretty}
    `;
    document.head.appendChild(stickyStyle);

    const WA_SVG = `<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.927 0C5.361 0 0 5.356 0 11.915c0 2.094.546 4.1 1.585 5.876L0 24l6.385-1.634a11.9 11.9 0 005.542 1.369h.004c6.559 0 11.918-5.356 11.918-11.915C23.849 5.356 18.49 0 11.927 0zm0 21.798h-.003a9.88 9.88 0 01-5.031-1.378l-.361-.214-3.741.98.997-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c0-5.445 4.436-9.875 9.888-9.875 2.641 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.444-4.437 9.877-9.885 9.877z"/></svg>`;

    const bottomRow = document.createElement('div');
    bottomRow.id = 'bottomRow';
    bottomRow.innerHTML = `
      <div id="stickyCta">
        <div class="sticky-cta-inner">
          <span class="sticky-cta-text">Browse our weekly training schedule.</span>
          <div class="sticky-cta-actions">
            <a class="btn btn-primary sticky-cta-btn" href="${sh}"><span>See Schedules</span></a>
            <button class="sticky-cta-close" id="stickyCtaClose" aria-label="Dismiss"><svg viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
          </div>
        </div>
      </div>
      <div id="waFloat">
        <a class="wa-btn" href="https://wa.me/41788937929" target="_blank" rel="noopener" aria-label="Contact us on WhatsApp">${WA_SVG}</a>
      </div>`;
    document.body.appendChild(bottomRow);

    const stickyCta = document.getElementById('stickyCta');
    const CTA_KEY = 'pf_cta_dismissed';
    const CTA_TTL = 24 * 60 * 60 * 1000; // 1 day in ms

    // If user dismissed within the last 24 hours, hide immediately
    const lastDismissed = parseInt(localStorage.getItem(CTA_KEY) || '0', 10);
    if (Date.now() - lastDismissed < CTA_TTL) {
      stickyCta.classList.add('dismissed');
    }

    document.getElementById('stickyCtaClose').addEventListener('click', () => {
      stickyCta.classList.add('dismissed');
      localStorage.setItem(CTA_KEY, Date.now().toString());
    });


    const heroEl = document.getElementById('hero');
    if (heroEl) {
      new IntersectionObserver(entries => {
        bottomRow.classList.toggle('visible', !entries[0].isIntersecting);
      }, { threshold: 0 }).observe(heroEl);
    } else {
      window.addEventListener('scroll', () => {
        bottomRow.classList.toggle('visible', window.scrollY > 300);
      }, { passive: true });
    }

    // ── Hide social sidebar when footer is visible ──────────────────
    const socialSide = document.querySelector('.social-side');
    if (socialSide) {
      socialSide.style.transition = 'opacity .3s, transform .3s';
      const footerObserver = new IntersectionObserver(entries => {
        const visible = entries[0].isIntersecting;
        socialSide.style.opacity = visible ? '0' : '';
        socialSide.style.pointerEvents = visible ? 'none' : '';
      }, { threshold: 0 });
      const footerEl = document.querySelector('footer');
      if (footerEl) footerObserver.observe(footerEl);
    }

    // ── Feedback modal ──────────────────────────────────────────────
    const fbStyle = document.createElement('style');
    fbStyle.textContent = '.fb-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:7777;opacity:0;pointer-events:none;transition:opacity .3s ease;display:flex;align-items:center;justify-content:center;padding:24px}.fb-modal-overlay.open{opacity:1;pointer-events:all}.fb-modal-inner{background:var(--bg-2,#0a0b0c);border:1px solid var(--line-2,rgba(255,255,255,0.06));border-radius:16px;width:100%;max-width:560px;padding:36px;position:relative;transform:translateY(20px);transition:transform .35s cubic-bezier(.16,1,.3,1);max-height:90vh;overflow-y:auto}.fb-modal-overlay.open .fb-modal-inner{transform:translateY(0)}.fb-modal-close{position:absolute;top:16px;right:16px;background:none;border:1px solid var(--line-2,rgba(255,255,255,0.06));border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-dim,#8a8c86);transition:color .2s,border-color .2s}.fb-modal-close:hover{color:var(--ink,#e8e8e4);border-color:rgba(255,255,255,0.25)}.fb-modal-close svg{width:12px;height:12px;stroke:currentColor;stroke-width:1.8;overflow:visible}.fb-modal-title{font-size:26px;font-family:"Clash Display",ui-sans-serif,system-ui,sans-serif;font-weight:700;color:var(--ink,#e8e8e4);margin-bottom:6px}.fb-modal-sub{font-size:14px;color:var(--ink-dim,#8a8c86);margin-bottom:28px;line-height:1.55}.fb-form{display:grid;grid-template-columns:1fr 1fr;gap:14px}.fb-form .fb-full{grid-column:1/-1}.fb-field{display:flex;flex-direction:column;gap:7px}.fb-field label{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-dim,#8a8c86)}.fb-field input,.fb-field textarea,.fb-field select{background:var(--bg,#040505);border:1px solid var(--line-2,rgba(255,255,255,0.06));border-radius:10px;padding:12px 14px;font-family:"General Sans",ui-sans-serif,system-ui,sans-serif;font-size:14px;color:var(--ink,#e8e8e4);outline:none;transition:border-color .25s}.fb-field input:focus,.fb-field textarea:focus,.fb-field select:focus{border-color:rgba(199,255,63,.4)}.fb-field textarea{resize:vertical;min-height:90px}.fb-field select{appearance:none;-webkit-appearance:none;cursor:pointer}.fb-stars{display:flex;gap:6px;margin-bottom:4px}.fb-star{font-size:22px;cursor:pointer;filter:grayscale(1);opacity:.35;background:none;border:none;padding:0;line-height:1;transition:opacity .15s,filter .15s}.fb-star.active{filter:none;opacity:1}.fb-submit-row{grid-column:1/-1;display:flex;align-items:center;gap:16px;margin-top:4px}.fb-success-screen{display:none;flex-direction:column;align-items:center;text-align:center;padding:12px 0 8px;gap:20px}.fb-success-screen.show{display:flex}.fb-success-icon svg{width:72px;height:72px}.fb-success-title{font-family:"Clash Display",ui-sans-serif,system-ui,sans-serif;font-size:clamp(22px,5vw,28px);font-weight:700;color:var(--ink,#e8e8e4)}.fb-success-sub{font-size:14px;color:var(--ink-dim,#8a8c86);line-height:1.6;max-width:320px}.fb-success-close-btn{min-width:160px;margin-top:8px;justify-content:center}';
    document.head.appendChild(fbStyle);

    document.body.insertAdjacentHTML('beforeend', '<div class="fb-modal-overlay" id="fbModal"><div class="fb-modal-inner"><button class="fb-modal-close" id="fbModalClose" aria-label="Close"><svg viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/></svg></button><div class="fb-modal-title">Leave Feedback</div><p class="fb-modal-sub">Trained with us? Your experience goes straight into the testimonials.</p><form class="fb-form" id="fbForm" novalidate><div class="fb-field"><label for="fbName">Your Name</label><input type="text" id="fbName" placeholder="Jonas Lie" autocomplete="name"></div><div class="fb-field"><label for="fbTraining">Training Type</label><select id="fbTraining"><option value="">Select a discipline</option><option>MMA Striking</option><option>MMA Grappling</option><option>Kids MMA</option><option>Les Mills Bodycombat</option><option>Professional</option><option>Sparring</option><option>S&C</option></select></div><div class="fb-field fb-full"><label for="fbText">Your Experience</label><textarea id="fbText" placeholder="What was your experience training at Power Fight?"></textarea></div><div class="fb-field fb-full"><label>Rating</label><div class="fb-stars" id="fbStars" role="group" aria-label="Rating"><button class="fb-star" type="button" data-val="1" aria-label="1 star">★</button><button class="fb-star" type="button" data-val="2" aria-label="2 stars">★</button><button class="fb-star" type="button" data-val="3" aria-label="3 stars">★</button><button class="fb-star" type="button" data-val="4" aria-label="4 stars">★</button><button class="fb-star" type="button" data-val="5" aria-label="5 stars">★</button></div></div><div class="fb-submit-row"><button class="btn btn-primary" type="submit"><span>Submit Feedback</span></button></div></form><div class="fb-success-screen" id="fbSuccessScreen"><div class="fb-success-icon"><svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="23" stroke="#C7FF3F" stroke-width="1.5"/><path d="M13 24.5l8 8 14-16" stroke="#C7FF3F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="fb-success-title">Thanks for the feedback!</div><p class="fb-success-sub">Your review is now live in the testimonials section.</p><button class="btn btn-primary fb-success-close-btn" id="fbSuccessDone"><span>Close</span></button></div></div></div>');

    const fbModalEl = document.getElementById('fbModal');

    window.openFeedbackModal = function () { fbModalEl.classList.add('open'); window.lockScroll(); };

    function closeFeedbackModal() {
      fbModalEl.classList.remove('open');
      window.unlockScroll();
      document.getElementById('fbSuccessScreen').classList.remove('show');
      document.getElementById('fbForm').style.display = '';
      document.querySelector('.fb-modal-title').style.display = '';
      document.querySelector('.fb-modal-sub').style.display = '';
    }

    document.getElementById('fbModalClose').addEventListener('click', closeFeedbackModal);
    document.getElementById('fbSuccessDone').addEventListener('click', closeFeedbackModal);
    fbModalEl.addEventListener('click', e => { if (e.target === fbModalEl) closeFeedbackModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && fbModalEl.classList.contains('open')) closeFeedbackModal(); });

    const FB_KEY = 'pf_feedback_v1';
    window.loadFeedback = function () { try { return JSON.parse(localStorage.getItem(FB_KEY) || '[]'); } catch { return []; } };
    function saveFeedback(arr) { try { localStorage.setItem(FB_KEY, JSON.stringify(arr)); } catch {} }

    let fbRating = 0;
    const fbStarBtns = document.querySelectorAll('.fb-star');
    fbStarBtns.forEach(star => {
      star.addEventListener('mouseenter', () => { const v = +star.dataset.val; fbStarBtns.forEach(s => s.classList.toggle('active', +s.dataset.val <= v)); });
      star.addEventListener('mouseleave', () => { fbStarBtns.forEach(s => s.classList.toggle('active', +s.dataset.val <= fbRating)); });
      star.addEventListener('click', () => { fbRating = +star.dataset.val; fbStarBtns.forEach(s => s.classList.toggle('active', +s.dataset.val <= fbRating)); });
    });

    document.getElementById('fbForm').addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('fbName').value.trim();
      const training = document.getElementById('fbTraining').value;
      const text = document.getElementById('fbText').value.trim();
      if (!name || !training || !text) return;
      const entry = { name, training, text, rating: fbRating || 5, ts: Date.now() };
      const all = window.loadFeedback(); all.push(entry); saveFeedback(all);
      if (window.onFeedbackSubmit) window.onFeedbackSubmit(entry);
      document.getElementById('fbName').value = '';
      document.getElementById('fbTraining').value = '';
      document.getElementById('fbText').value = '';
      fbRating = 0;
      fbStarBtns.forEach(s => s.classList.remove('active'));
      document.getElementById('fbForm').style.display = 'none';
      document.querySelector('.fb-modal-title').style.display = 'none';
      document.querySelector('.fb-modal-sub').style.display = 'none';
      document.getElementById('fbSuccessScreen').classList.add('show');
    });
  };
}());
