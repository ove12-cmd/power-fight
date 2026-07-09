(function () {
  'use strict';

  /* Schedule is fully dynamic — loaded from pf_schedule_v2 settings key */

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

  /* Current UI language (updated by _compApplyLang) */
  let _uiLang = (typeof localStorage !== 'undefined' && localStorage.getItem('pf_lang')) || 'de';

  const _DAY_SHORT = {
    en: {1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat',7:'Sun'},
    de: {1:'Mo', 2:'Di', 3:'Mi', 4:'Do', 5:'Fr', 6:'Sa', 7:'So'},
  };
  const _DAY_FULL = {
    en: {1:'Monday',2:'Tuesday',3:'Wednesday',4:'Thursday',5:'Friday',6:'Saturday',7:'Sunday'},
    de: {1:'Montag',2:'Dienstag',3:'Mittwoch',4:'Donnerstag',5:'Freitag',6:'Samstag',7:'Sonntag'},
  };
  const _CLOSED = { en: 'Closed', de: 'Geschlossen' };

  /* Render fetched slots into the popup hours grid */
  function _renderInfoHours(slots) {
    const grid = document.getElementById('infoHoursGrid');
    if (!grid) return;
    const DAY = _DAY_SHORT[_uiLang] || _DAY_SHORT.de;
    const active = (slots || []).filter(s => !s.hidden && !s.archived);
    if (!active.length) {
      grid.innerHTML = `<div class="info-hour-row" style="font-size:12px;color:var(--ink-dim)">${_uiLang === 'en' ? 'See full schedule →' : 'Vollständigen Plan →'}</div>`;
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

  /* ── Shared schedule data (one fetch, reused by popup + footer) ──── */
  const SB_URL = 'https://nzfqsgdzbainfijbhwag.supabase.co';
  const SB_KEY = 'sb_publishable_OPR8hTocm9g1T79HTW3Qvg_y-0yj2Al';
  let _slotsPromise = null;

  function _getScheduleSlots() {
    if (_slotsPromise) return _slotsPromise;
    // Homepage: _pfSlots already loaded from DB — reuse directly
    if (window._pfSlots && window._pfSlots.length) {
      return (_slotsPromise = Promise.resolve(window._pfSlots));
    }
    // All other pages: fetch from settings table (pf_schedule_v2)
    _slotsPromise = fetch(
      `${SB_URL}/rest/v1/settings?key=eq.pf_schedule_v2&select=value`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    )
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(rows => {
      if (!rows || !rows.length || !rows[0].value) return [];
      const slots = JSON.parse(rows[0].value) || [];
      return slots.filter(s => !s.hidden && !s.archived && s.name);
    })
    .catch(err => { console.warn('[PowerFight] Schedule load failed:', err); return []; });
    return _slotsPromise;
  }

  /* Render slots → Info popup hours grid */
  async function _loadInfoHours() {
    const slots = await _getScheduleSlots();
    _renderInfoHours(slots);
  }

  /* Render training names → footer Trainings column (fixed list from Our Classes) */
  const _FOOTER_TRAININGS = {
    en: ['Striking for MMA','Grappling','Kettlebell Group Training',
         'Les Mills BodyCombat','Personal Training','Kids Training'],
    de: ['Striking für MMA','Grappling','Kettlebell Gruppentraining',
         'Les Mills BodyCombat','Personal Training','Kids Training']
  };
  function _loadFooterTrainings() {
    const list = document.getElementById('footTrainingList');
    if (!list) return;
    const trainings = _FOOTER_TRAININGS[_uiLang] || _FOOTER_TRAININGS.de;
    const privLink = `<li><a href="/booking" style="color:var(--lime)"><span data-ci18n="foot.priv">${_uiLang === 'en' ? 'Private Bookings →' : 'Private Buchungen →'}</span></a></li>`;
    list.innerHTML = trainings.map(n => `<li><a href="${pr}">${n}</a></li>`).join('') + privLink;
  }

  /* Populate #fbTraining select with unique class names from schedule */
  async function _loadFbTrainingOptions() {
    const sel = document.getElementById('fbTraining');
    if (!sel) return;
    const slots = await _getScheduleSlots();
    const seen = new Set();
    const names = slots.filter(s => s.name && !seen.has(s.name) && seen.add(s.name)).map(s => s.name);
    // Keep first placeholder option, rebuild the rest
    const placeholder = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(placeholder);
    names.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      sel.appendChild(opt);
    });
  }

  /* Expose schedule fetch for use on other pages (e.g. contact.html) */
  window._pfGetScheduleSlots = _getScheduleSlots;

  /* Render slots → footer schedule list */
  async function _loadFooterSchedule() {
    const list = document.getElementById('footSchedList');
    if (!list) return;
    const slots = await _getScheduleSlots();
    const active = slots.filter(s => !s.hidden && !s.archived);
    const byDay = {};
    active.forEach(s => { (byDay[s.day] = byDay[s.day] || []).push(s); });
    const DAY_FULL = _DAY_FULL[_uiLang] || _DAY_FULL.de;
    const closedLabel = _CLOSED[_uiLang] || _CLOSED.de;
    // Days that have sessions, plus always show Sat+Sun as closed if absent
    const allDays = [...new Set([...Object.keys(byDay).map(Number), 6, 7])].sort((a,b)=>a-b);
    list.innerHTML = allDays.map(d => {
      const sessions = byDay[d];
      if (!sessions) {
        // Day with no sessions → Closed
        return `<li><span class="foot-sched-row" style="opacity:0.4"><span>${DAY_FULL[d]||d}</span><span style="font-size:10px;letter-spacing:0.14em;color:var(--ink-mute)">${closedLabel}</span></span></li>`;
      }
      const seen = new Set();
      const pills = sessions
        .filter(s => { const k = s.name||''; if (seen.has(k)) return false; seen.add(k); return true; })
        .map(s => {
          const label = s.name || '';
          const [bg, col] = _pillCol(label);
          return `<span class="foot-pill" style="background:${bg};color:${col}">${label}</span>`;
        }).join('');
      return `<li><a href="${typeof sh !== 'undefined' ? sh : '/#system'}" class="foot-sched-row"><span>${DAY_FULL[d]||d}</span><span class="foot-pills">${pills}</span></a></li>`;
    }).join('');
  }

  const isHome = !location.pathname.match(/\/(contact|gallery|register|faq|booking)(\.html)?$/);

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
    <button class="lang-btn" data-lang="en">EN</button>
    <span class="lang-sep">|</span>
    <button class="lang-btn active" data-lang="de">DE</button>
  </div>
  <div class="nav-cta">
    <div class="nav-links">
      <a href="${sh}" data-ci18n="nav.sched">Stundenplan</a>
      <a href="${pr}" data-ci18n="nav.train">Training</a>
      <a href="/contact" data-nav-contact data-ci18n="nav.cont">Kontakt</a>
      <a href="/pricing" data-nav-pricing data-ci18n="nav.pricing">Preise</a>
      <a href="/faq" data-nav-faq>FAQ</a>
    </div>
    <div class="lang-switch">
      <button class="lang-btn" data-lang="en">EN</button>
      <span class="lang-sep">|</span>
      <button class="lang-btn active" data-lang="de">DE</button>
    </div>
    <button class="btn btn-primary" id="infoBtn" onclick="openInfoPopup()">
      <span style="display:inline-flex;align-items:center;gap:0.5rem"><svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;position:relative;z-index:1"><path d="M7 1C4.79 1 3 2.79 3 5c0 3.5 4 8 4 8s4-4.5 4-8c0-2.21-1.79-4-4-4z"/><circle cx="7" cy="5" r="1.5"/></svg><span data-ci18n="nav.info">Find Us</span></span>
    </button>
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
    <a href="${pr}" class="mob-link">
      <span class="mob-link-icon"><svg width="14" height="15" viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.71973 1.08008C5.96901 1.08015 5.24869 1.37564 4.71777 1.90234C4.18688 2.42906 3.88873 3.1437 3.88867 3.88867V6.11133C3.88861 6.25005 3.83323 6.38319 3.73438 6.48145C3.63532 6.57972 3.50054 6.63565 3.36035 6.63574C3.22004 6.63574 3.08547 6.5798 2.98633 6.48145C2.88725 6.38315 2.83111 6.25022 2.83105 6.11133V4.96875H2.24023C1.93498 4.96875 1.6417 5.0895 1.42578 5.30371C1.21007 5.51789 1.08887 5.80844 1.08887 6.11133V8.14648L1.09766 8.15527L3.73145 10.7383C3.78123 10.787 3.82067 10.8452 3.84766 10.9092C3.87464 10.9732 3.88864 11.042 3.88867 11.1113V13.9199H11.791V11.1113C11.791 11.0626 11.798 11.0137 11.8115 10.9668L12.9102 7.15332L12.8799 7.14453L12.9111 7.15332V3.88867C12.9111 3.14367 12.613 2.42907 12.082 1.90234C11.5511 1.37561 10.8309 1.0801 10.0801 1.08008H6.71973ZM10.042 9.47656C10.1112 9.47168 10.1812 9.48024 10.2471 9.50195C10.313 9.52374 10.3743 9.5584 10.4268 9.60352C10.4792 9.64867 10.5227 9.70401 10.5537 9.76562C10.5847 9.82715 10.6025 9.89431 10.6074 9.96289C10.6123 10.0316 10.604 10.1007 10.582 10.166C10.5601 10.2313 10.525 10.2917 10.4795 10.3438C10.434 10.3957 10.3785 10.438 10.3164 10.4688L9.07812 11.083L9.02148 11.1113L9.07812 11.1387L10.3164 11.7529C10.4419 11.8152 10.5377 11.9247 10.582 12.0566C10.6263 12.1885 10.6164 12.3327 10.5537 12.457C10.491 12.5814 10.3802 12.6757 10.2471 12.7197C10.1141 12.7636 9.96915 12.7535 9.84375 12.6914L7.85352 11.7041L7.83984 11.6973L7.82617 11.7041L5.83691 12.6914C5.77481 12.7222 5.70697 12.7402 5.6377 12.7451C5.56835 12.75 5.49856 12.7415 5.43262 12.7197C5.3667 12.6979 5.3054 12.6633 5.25293 12.6182C5.20069 12.5731 5.15793 12.5184 5.12695 12.457C5.09596 12.3955 5.07723 12.3283 5.07227 12.2598C5.06735 12.1912 5.07579 12.1219 5.09766 12.0566C5.11958 11.9914 5.15477 11.9309 5.2002 11.8789C5.22296 11.8529 5.24807 11.8287 5.27539 11.8076L5.36328 11.7529L6.60156 11.1387L6.6582 11.1113L6.60156 11.083L5.36328 10.4688C5.30122 10.4379 5.24565 10.3957 5.2002 10.3438C5.1547 10.2917 5.11961 10.2313 5.09766 10.166C5.07571 10.1007 5.06735 10.0316 5.07227 9.96289C5.07719 9.89421 5.09591 9.82723 5.12695 9.76562C5.15799 9.70404 5.20048 9.64866 5.25293 9.60352C5.30541 9.55836 5.36668 9.52376 5.43262 9.50195C5.56577 9.45795 5.7114 9.46899 5.83691 9.53125L7.82617 10.5186L7.83984 10.5254L7.85352 10.5186L9.84375 9.53125C9.90572 9.50054 9.97288 9.4815 10.042 9.47656ZM2.83105 11.3301L2.82227 11.3203L0.310547 8.8584C0.296234 8.84432 0.283106 8.82908 0.270508 8.81348C0.135609 8.64558 0.0536987 8.44201 0.0351562 8.22949L0.03125 8.1377V6.11133C0.03125 5.53033 0.263541 4.97243 0.677734 4.56152C1.09193 4.15063 1.65437 3.91992 2.24023 3.91992H2.83105V3.88867C2.83222 2.86606 3.24272 1.88529 3.97168 1.16211C4.65513 0.484234 5.56658 0.0843514 6.52734 0.0361328L6.71973 0.03125H10.0801C11.1111 0.0323734 12.1001 0.438891 12.8291 1.16211C13.558 1.88528 13.9676 2.8661 13.9688 3.88867V7.14453C13.9686 7.24461 13.9545 7.34422 13.9268 7.44043L12.8496 11.1797H12.8486V13.8887C12.8486 14.1749 12.7343 14.4498 12.5303 14.6523C12.3261 14.8549 12.0486 14.9688 11.7598 14.9688H3.91992C3.63119 14.9687 3.35452 14.8548 3.15039 14.6523C2.94624 14.4498 2.83105 14.175 2.83105 13.8887V11.3301Z" fill="#C7FF3F" stroke="#C7FF3F" stroke-width="0.0625"/></svg></span>
      <span class="mob-link-sep">|</span>
      <span class="mob-link-text" data-ci18n="nav.train">Training</span>
      <svg class="mob-link-arr" viewBox="0 0 9 15"><polyline points="1,1 8,7.5 1,14"/></svg>
    </a>
    <a href="/contact" class="mob-link">
      <span class="mob-link-icon"><svg width="15" height="11" viewBox="0 0 15 11" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.07129 0.25H13.9287C14.1444 0.250038 14.3523 0.338397 14.5068 0.49707C14.6615 0.655901 14.7499 0.872274 14.75 1.09961V9.90039C14.7499 10.1277 14.6615 10.3441 14.5068 10.5029C14.3523 10.6616 14.1444 10.75 13.9287 10.75H1.07129C0.855637 10.75 0.647716 10.6616 0.493164 10.5029C0.338511 10.3441 0.250101 10.1277 0.25 9.90039V1.09961C0.250101 0.872274 0.338511 0.655901 0.493164 0.49707C0.647716 0.338397 0.855637 0.250038 1.07129 0.25ZM13.7842 1.39648L7.66016 5.74707C7.61243 5.78106 7.55667 5.79883 7.5 5.79883C7.47153 5.79883 7.44316 5.7949 7.41602 5.78613L7.33984 5.74707L1.21582 1.39648L0.821289 1.11621V10.1504H14.1787V1.11621L13.7842 1.39648ZM2.10547 1.30371L7.35547 5.0332L7.5 5.13574L7.64453 5.0332L12.8945 1.30371L13.5342 0.849609H1.46582L2.10547 1.30371Z" fill="black" stroke="#C7FF3F" stroke-width="0.5"/></svg></span>
      <span class="mob-link-sep">|</span>
      <span class="mob-link-text" data-ci18n="nav.cont">Kontakt</span>
      <svg class="mob-link-arr" viewBox="0 0 9 15"><polyline points="1,1 8,7.5 1,14"/></svg>
    </a>
    <a href="/pricing" class="mob-link">
      <span class="mob-link-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="0.6" fill="currentColor" stroke="none"/></svg></span>
      <span class="mob-link-sep">|</span>
      <span class="mob-link-text" data-ci18n="nav.pricing">Preise</span>
      <svg class="mob-link-arr" viewBox="0 0 9 15"><polyline points="1,1 8,7.5 1,14"/></svg>
    </a>
    <a href="/faq" class="mob-link">
      <span class="mob-link-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none"/></svg></span>
      <span class="mob-link-sep">|</span>
      <span class="mob-link-text">FAQ</span>
      <svg class="mob-link-arr" viewBox="0 0 9 15"><polyline points="1,1 8,7.5 1,14"/></svg>
    </a>
    <button class="mob-link" style="display:flex;align-items:center;width:100%;padding:18px 0;border:none;border-bottom:1px solid var(--line);background:none;cursor:pointer;color:var(--ink);text-align:left" onclick="openInfoPopup()">
      <span class="mob-link-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.69 2 6 4.69 6 8c0 5.25 6 13 6 13s6-7.75 6-13c0-3.31-2.69-6-6-6z"/><circle cx="12" cy="8" r="2.5"/></svg></span>
      <span class="mob-link-sep">|</span>
      <span class="mob-link-text" data-ci18n="nav.info">Find Us</span>
      <svg class="mob-link-arr" viewBox="0 0 9 15"><polyline points="1,1 8,7.5 1,14"/></svg>
    </button>
  </nav>
  <div class="mob-cta">
    <a class="btn btn-primary" href="${sh}"><span data-ci18n="cta">Stundenplan ansehen</span></a>
    <a class="btn btn-ghost" href="/contact"><span data-ci18n="nav.cont">Kontakt</span></a>
  </div>
  <div class="mob-social">
    <a href="https://www.instagram.com/powerfightteam_" target="_blank" rel="noopener" aria-label="Instagram">
      <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
    </a>
    <a href="https://www.facebook.com/p/Power-Fight-Team-100068990680962/" target="_blank" rel="noopener" aria-label="Facebook – Power Fight">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    </a>
    <a href="https://www.youtube.com/@germoofficial-experienceta1157" target="_blank" rel="noopener" aria-label="YouTube">
      <svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
    </a>
  </div>
</div>
<a id="schedFab" href="${sh}" aria-label="See Schedules">
  <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 9.5C4.13261 9.5 4.25975 9.55272 4.35352 9.64648C4.44728 9.74025 4.5 9.86739 4.5 10C4.5 10.1326 4.44728 10.2597 4.35352 10.3535C4.25975 10.4473 4.13261 10.5 4 10.5C3.86739 10.5 3.74025 10.4473 3.64648 10.3535C3.55272 10.2597 3.5 10.1326 3.5 10C3.5 9.86739 3.55272 9.74025 3.64648 9.64648C3.74025 9.55272 3.86739 9.5 4 9.5ZM7 9.5C7.13261 9.5 7.25975 9.55272 7.35352 9.64648C7.44728 9.74025 7.5 9.86739 7.5 10C7.5 10.1326 7.44728 10.2597 7.35352 10.3535C7.25975 10.4473 7.13261 10.5 7 10.5C6.86739 10.5 6.74025 10.4473 6.64648 10.3535C6.55272 10.2597 6.5 10.1326 6.5 10C6.5 9.86739 6.55272 9.74025 6.64648 9.64648C6.74025 9.55272 6.86739 9.5 7 9.5ZM4 6.5C4.13261 6.5 4.25975 6.55272 4.35352 6.64648C4.44728 6.74025 4.5 6.86739 4.5 7C4.5 7.13261 4.44728 7.25975 4.35352 7.35352C4.25975 7.44728 4.13261 7.5 4 7.5C3.86739 7.5 3.74025 7.44728 3.64648 7.35352C3.55272 7.25975 3.5 7.13261 3.5 7C3.5 6.86739 3.55272 6.74025 3.64648 6.64648C3.74025 6.55272 3.86739 6.5 4 6.5ZM7 6.5C7.13261 6.5 7.25975 6.55272 7.35352 6.64648C7.44728 6.74025 7.5 6.86739 7.5 7C7.5 7.13261 7.44728 7.25975 7.35352 7.35352C7.25975 7.44728 7.13261 7.5 7 7.5C6.86739 7.5 6.74025 7.44728 6.64648 7.35352C6.55272 7.25975 6.5 7.13261 6.5 7C6.5 6.86739 6.55272 6.74025 6.64648 6.64648C6.74025 6.55272 6.86739 6.5 7 6.5ZM10 6.5C10.1326 6.5 10.2597 6.55272 10.3535 6.64648C10.4473 6.74025 10.5 6.86739 10.5 7C10.5 7.13261 10.4473 7.25975 10.3535 7.35352C10.2597 7.44728 10.1326 7.5 10 7.5C9.86739 7.5 9.74025 7.44728 9.64648 7.35352C9.55272 7.25975 9.5 7.13261 9.5 7C9.5 6.86739 9.55272 6.74025 9.64648 6.64648C9.74025 6.55272 9.86739 6.5 10 6.5Z" fill="#040505" stroke="#040505"/></svg>
</a>`;

  /* ── FOOTER ─────────────────────────────────────────────────────── */
  const FOOTER_HTML = `
<footer>
  <div class="foot-top">
    <div class="foot-brand">
      <a href="${home}" style="display:block;margin-bottom:20px;line-height:0"><img src="logo2.png" alt="Power Fight" style="height:4rem;width:auto;display:block"></a>
      <p data-ci18n="foot.brand">Ein ernsthaftes Trainingsumfeld für Kämpfer, die besser werden wollen. Offen für alle Niveaus – gebaut für alle, die kämpfen wollen.</p>
      <div class="foot-contact">
        <div class="foot-contact-name">Power Fight Team</div>
        <div>Pfeffingerring 201, 4147 Aesch</div>
        <a href="https://www.google.com/maps/search/?api=1&query=Pfeffingerring+201,+4147+Aesch,+Switzerland" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-dim);margin-top:2px;transition:color .3s" onmouseover="this.style.color='var(--lime)'" onmouseout="this.style.color='var(--ink-dim)'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg><span data-ci18n="foot.maps">In Maps öffnen</span></a>
        <a href="tel:+41788937929">+41788937929</a>
        <a href="mailto:powerfightt@gmail.com">powerfightt@gmail.com</a>
      </div>
    </div>
    <div class="foot-col">
      <h5 data-ci18n="foot.h1">Stundenplan</h5>
      <ul id="footSchedList" style="gap:14px">
        <li><span class="foot-sched-row" style="opacity:0.35;font-size:12px;color:var(--ink-mute)" data-ci18n="foot.loading">Lädt…</span></li>
      </ul>
    </div>
    <div class="foot-col">
      <h5 data-ci18n="foot.h2">Training</h5>
      <ul id="footTrainingList" style="gap:10px">
        <li><span style="opacity:.35;font-size:12px;color:var(--ink-mute)" data-ci18n="foot.loading">Lädt…</span></li>
      </ul>
    </div>
    <div class="foot-col">
      <h5 data-ci18n="foot.h3">Folge uns</h5>
      <ul>
        <li><a href="https://www.instagram.com/powerfightteam_" target="_blank" rel="noopener">Instagram – Power Fight</a></li>
        <li><a href="https://www.facebook.com/p/Power-Fight-Team-100068990680962/" target="_blank" rel="noopener">Facebook – Power Fight</a></li>
        <li><a href="https://www.youtube.com/@germoofficial-experienceta1157" target="_blank" rel="noopener">YouTube</a></li>
      </ul>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:20px">
        <a class="btn btn-ghost" href="/pricing" style="font-size:10px;padding:11px 18px"><span data-ci18n="foot.pricing">Preise ansehen</span></a>
        <a class="btn btn-ghost" href="/contact" style="font-size:10px;padding:11px 18px"><span data-ci18n="foot.contact">Kontaktiere uns</span></a>
        <button onclick="openFeedbackModal()" style="background:none;border:none;padding:0;text-align:left;cursor:pointer;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-dim);margin-top:6px;transition:color .2s" onmouseover="this.style.color='var(--lime)'" onmouseout="this.style.color='var(--ink-dim)'"><span data-ci18n="foot.fb">Feedback hinterlassen →</span></button>
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
          <div class="info-label" data-ci18n="pop.addr">Adresse</div>
          <div class="info-val" data-ci18n-html="pop.country">Pfeffingerring 201<br>4147 Aesch, Switzerland</div>
          <a href="https://www.google.com/maps/search/?api=1&query=Pfeffingerring+201,+4147+Aesch,+Switzerland" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-dim);margin-top:6px;transition:color .3s" onmouseover="this.style.color='var(--lime)'" onmouseout="this.style.color='var(--ink-dim)'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg><span data-ci18n="foot.maps">In Maps öffnen</span></a>
        </div>
      </div>
      <div class="info-row">
        <div class="info-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.12 7.1 19.79 19.79 0 01.07 4.5 2 2 0 012 2.36h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg></div>
        <div>
          <div class="info-label" data-ci18n="pop.phone">Telefon</div>
          <div class="info-val"><a href="tel:+41788937929">+41 78 893 79 29</a></div>
        </div>
      </div>
      <div class="info-row">
        <div class="info-icon"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>
        <div>
          <div class="info-label" data-ci18n="pop.email">E-Mail</div>
          <div class="info-val"><a href="mailto:powerfightt@gmail.com">powerfightt@gmail.com</a></div>
        </div>
      </div>
      <div class="info-row">
        <div class="info-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg></div>
        <div style="flex:1">
          <div class="info-label" data-ci18n="pop.hours">Trainingszeiten</div>
          <div class="info-hours-grid" id="infoHoursGrid">
            <div class="info-hour-row" style="opacity:.4;font-size:12px;color:var(--ink-dim)"><span data-ci18n="pop.loading">Stundenplan wird geladen…</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="info-popup-cta">
      <a class="btn btn-primary" href="${sh}" onclick="closeInfoPopup()"><span data-ci18n="cta">Stundenplan ansehen</span></a>
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
      _loadFooterSchedule();   // populate schedule pills from live admin data
      _loadFooterTrainings();  // populate training names from live admin data
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
      #bottomRow{position:fixed;bottom:20px;left:32px;right:96px;z-index:8888;display:flex;align-items:center;gap:12px;pointer-events:none;transform:translateY(calc(100% + 28px));opacity:0;transition:transform .45s cubic-bezier(.16,1,.3,1),opacity .45s ease}
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
      #waFloat{position:fixed;bottom:20px;right:32px;z-index:9000}
      .wa-btn{width:52px;height:52px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(37,211,102,.4);transition:transform .2s,box-shadow .2s;text-decoration:none}
      .wa-btn:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(37,211,102,.6)}
      .wa-btn svg{width:28px;height:28px;fill:#fff;display:block}
      #schedFab{display:none;position:fixed;z-index:8999;width:52px;height:52px;border-radius:50%;background:var(--lime);align-items:center;justify-content:center;text-decoration:none;box-shadow:0 4px 20px rgba(199,255,63,.45);transition:transform .2s,box-shadow .2s}
      #schedFab:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(199,255,63,.65)}
      #schedFab svg{width:26px;height:26px;display:block;fill:none;stroke:#040505;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
      #trialFab{display:none;position:fixed;z-index:9000;align-items:center;justify-content:center;gap:9px;text-decoration:none;background:var(--lime);color:#040505;font-family:var(--display);font-weight:700;font-size:12px;letter-spacing:.03em;text-transform:uppercase;height:52px;padding:0 18px;border-radius:30px;box-shadow:0 4px 20px rgba(199,255,63,.45);opacity:0;transform:translateY(16px);transition:opacity .4s ease,transform .4s ease,box-shadow .2s}
      #trialFab.visible{opacity:1;transform:translateY(0)}
      #trialFab:active{box-shadow:0 2px 12px rgba(199,255,63,.5)}
      #trialFab svg{width:19px;height:19px;flex-shrink:0;fill:none;stroke:#040505;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
      @media(max-width:640px){
        #bottomRow{display:none!important}
        #waFloat{bottom:80px;right:16px}
        #schedFab{display:flex;bottom:20px;right:16px}
        #trialFab{display:flex;bottom:20px;left:16px;right:80px;overflow:hidden}
        #trialFab span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
      }
      @media(max-width:375px){
        #trialFab{font-size:10px;padding:0 12px;gap:6px}
        #trialFab svg{width:16px;height:16px}
      }
      .info-popup-overlay{padding:12px}
      @media(max-width:360px){.info-popup{max-width:calc(100vw - 24px)}}
      footer{padding-bottom:calc(40px + 6rem)!important}
      @media(max-width:640px){footer{padding-bottom:calc(32px + 6rem)!important}}
      h1,h2,h3,h4,h5,h6{text-wrap:balance}
      p,li,blockquote,.faq-a-inner,.sched-card-name,.page-hero-tag{text-wrap:pretty}
      /* Tablet nav fix: the desktop nav links hide at <=1100px, but the hamburger
         only showed at <=640px — leaving 641-1100px with no way to open the menu.
         Show the hamburger + mobile language toggle across the whole <=1100px range. */
      @media(max-width:1100px){
        .nav-cta{display:none!important}
        .hamburger{display:flex!important}
        .mob-lang-nav{display:flex!important}
      }
    `;
    document.head.appendChild(stickyStyle);

    // ── Component translations ──────────────────────────────────────
    const COMP_T = {
      en: {
        'nav.sched':'Schedules','nav.train':'Programs','nav.cont':'Contact','nav.info':'Find Us',
        'nav.pricing':'Pricing','foot.pricing':'View Pricing',
        'cta':'See Schedules','trial.book':'Book a Free Trial Week',
        'foot.brand':'A serious training environment for fighters who are serious about getting better. Open to all levels — built for those who want to compete.',
        'foot.h1':'Schedule','foot.h2':'Programs','foot.h3':'Follow Us',
        'foot.priv':'Private Bookings →','foot.contact':'Contact Us',
        'foot.fb':'Leave Feedback →','foot.maps':'Open in Maps',
        'pop.addr':'Address','pop.phone':'Phone','pop.email':'Email',
        'pop.country':'Pfeffingerring 201<br>4147 Aesch, Switzerland',
        'pop.hours':'Training Hours','pop.loading':'Loading schedule…',
        'foot.loading':'Loading…',
        'aria.menuOpen':'Open menu','aria.menuClose':'Close menu',
        'aria.dismiss':'Dismiss','aria.whatsapp':'Contact us on WhatsApp',
        'aria.sched':'Schedules','aria.trial':'Book a free trial week',
        'aria.fbClose':'Close','aria.rating':'Rating',
        'aria.star1':'1 star','aria.star2':'2 stars','aria.star3':'3 stars',
        'aria.star4':'4 stars','aria.star5':'5 stars',
        'sticky.text':'Book your free trial week.','sticky.cta':'Book now',
        'fb.title':'Leave Feedback','fb.sub':'Trained with us? Your experience appears in the Testimonials after a quick review.',
        'fb.lbl.name':'Your Name','fb.lbl.training':'Training Type','fb.lbl.text':'Your Experience',
        'fb.lbl.rating':'Rating','fb.ph.training':'Choose discipline','fb.ph.text':'How was your training at Power Fight?',
        'fb.submit':'Submit Feedback',
        'fb.success.title':'Thanks for your feedback!','fb.success.sub':'Your review has been received and will appear in the Testimonials once approved.',
        'fb.success.close':'Close',
      },
      de: {
        'nav.sched':'Stundenplan','nav.train':'Programme','nav.cont':'Kontakt','nav.info':'Finde uns',
        'nav.pricing':'Preise','foot.pricing':'Preise ansehen',
        'cta':'Stundenplan ansehen','trial.book':'Gratis Probewoche buchen',
        'foot.brand':'Ein ernsthaftes Trainingsumfeld für Kämpfer, die besser werden wollen. Offen für alle Niveaus – gebaut für alle, die kämpfen wollen.',
        'foot.h1':'Stundenplan','foot.h2':'Programme','foot.h3':'Folge uns',
        'foot.priv':'Private Buchungen →','foot.contact':'Kontaktiere uns',
        'foot.fb':'Feedback hinterlassen →','foot.maps':'In Maps öffnen',
        'pop.addr':'Adresse','pop.phone':'Telefon','pop.email':'E-Mail',
        'pop.country':'Pfeffingerring 201<br>4147 Aesch, Schweiz',
        'pop.hours':'Trainingszeiten','pop.loading':'Stundenplan wird geladen…',
        'foot.loading':'Lädt…',
        'aria.menuOpen':'Menü öffnen','aria.menuClose':'Menü schliessen',
        'aria.dismiss':'Schliessen','aria.whatsapp':'Kontaktiere uns auf WhatsApp',
        'aria.sched':'Stundenplan','aria.trial':'Gratis Probewoche buchen',
        'aria.fbClose':'Schliessen','aria.rating':'Bewertung',
        'aria.star1':'1 Stern','aria.star2':'2 Sterne','aria.star3':'3 Sterne',
        'aria.star4':'4 Sterne','aria.star5':'5 Sterne',
        'sticky.text':'Buche deine gratis Probewoche.','sticky.cta':'Jetzt buchen',
        'fb.title':'Feedback hinterlassen','fb.sub':'Hast du bei uns trainiert? Deine Erfahrung erscheint nach kurzer Prüfung in den Testimonials.',
        'fb.lbl.name':'Dein Name','fb.lbl.training':'Trainingsart','fb.lbl.text':'Deine Erfahrung',
        'fb.lbl.rating':'Bewertung','fb.ph.training':'Disziplin wählen','fb.ph.text':'Wie war dein Training bei Power Fight?',
        'fb.submit':'Feedback einreichen',
        'fb.success.title':'Danke für dein Feedback!','fb.success.sub':'Deine Bewertung ist eingegangen und erscheint nach Freigabe im Testimonials-Bereich.',
        'fb.success.close':'Schliessen',
      }
    };

    function _compApplyLang(lang) {
      _uiLang = lang;
      const t = COMP_T[lang] || COMP_T.de;
      document.querySelectorAll('[data-ci18n]').forEach(el => {
        const key = el.dataset.ci18n;
        if (t[key] !== undefined) el.textContent = t[key];
      });
      // Translate placeholders on inputs/textareas/selects that have data-ci18n-ph
      document.querySelectorAll('[data-ci18n-ph]').forEach(el => {
        const key = el.dataset.ci18nPh;
        if (t[key] !== undefined) el.placeholder = t[key];
      });
      // Translate elements whose content includes markup (e.g. <br>) via data-ci18n-html
      document.querySelectorAll('[data-ci18n-html]').forEach(el => {
        const key = el.dataset.ci18nHtml;
        if (t[key] !== undefined) el.innerHTML = t[key];
      });
      // Language-aware aria-labels (no visible text, so set directly)
      const _setAria = (sel, key) => {
        const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
        if (el && t[key] !== undefined) el.setAttribute('aria-label', t[key]);
      };
      _setAria('#hamburger', 'aria.menuOpen');
      _setAria('#mobClose', 'aria.menuClose');
      _setAria('#stickyCtaClose', 'aria.dismiss');
      _setAria('#waFloatBtn', 'aria.whatsapp');
      // Two elements share id="schedFab" (mobile-menu template + JS-created FAB)
      document.querySelectorAll('#schedFab').forEach(el => _setAria(el, 'aria.sched'));
      _setAria('#trialFab', 'aria.trial');
      _setAria('#fbModalClose', 'aria.fbClose');
      _setAria('#fbStars', 'aria.rating');
      document.querySelectorAll('#fbStars .fb-star').forEach(star => {
        _setAria(star, 'aria.star' + star.dataset.val);
      });
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
      });
      document.documentElement.lang = lang;
      localStorage.setItem('pf_lang', lang);
      // Re-render schedule lists if already loaded (day names are language-dependent)
      if (_slotsPromise) {
        _loadFooterSchedule();
        _loadFooterTrainings();
        const grid = document.getElementById('infoHoursGrid');
        if (grid && grid.children.length > 0 && !grid.querySelector('[data-ci18n]')) {
          _loadInfoHours();
        }
      }
    }

    // Read saved language — applied AFTER all DOM elements are appended (see below)
    const _initLang = localStorage.getItem('pf_lang') || 'de';

    // Wire lang buttons for all pages
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _compApplyLang(btn.dataset.lang);
        document.dispatchEvent(new CustomEvent('pfLangChange', { detail: btn.dataset.lang }));
      });
    });

    const WA_SVG = `<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.927 0C5.361 0 0 5.356 0 11.915c0 2.094.546 4.1 1.585 5.876L0 24l6.385-1.634a11.9 11.9 0 005.542 1.369h.004c6.559 0 11.918-5.356 11.918-11.915C23.849 5.356 18.49 0 11.927 0zm0 21.798h-.003a9.88 9.88 0 01-5.031-1.378l-.361-.214-3.741.98.997-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c0-5.445 4.436-9.875 9.888-9.875 2.641 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.444-4.437 9.877-9.885 9.877z"/></svg>`;

    const bottomRow = document.createElement('div');
    bottomRow.id = 'bottomRow';
    bottomRow.innerHTML = `
      <div id="stickyCta">
        <div class="sticky-cta-inner">
          <span class="sticky-cta-text" data-ci18n="sticky.text">Buche deine gratis Probewoche.</span>
          <div class="sticky-cta-actions">
            <a class="btn btn-primary sticky-cta-btn" href="/contact"><span data-ci18n="sticky.cta">Jetzt buchen</span></a>
            <button class="sticky-cta-close" id="stickyCtaClose" aria-label="Dismiss"><svg viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg></button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(bottomRow);

    const waFloatEl = document.createElement('div');
    waFloatEl.id = 'waFloat';
    waFloatEl.innerHTML = `<a class="wa-btn" id="waFloatBtn" href="https://wa.me/41788937929" target="_blank" rel="noopener" aria-label="Contact us on WhatsApp">${WA_SVG}</a>`;
    document.body.appendChild(waFloatEl);

    const SCHED_CAL_SVG = `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const schedFabEl = document.createElement('a');
    schedFabEl.id = 'schedFab';
    schedFabEl.href = sh;
    schedFabEl.setAttribute('aria-label', (COMP_T[_uiLang] || COMP_T.de)['aria.sched']);
    schedFabEl.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>`;
    document.body.appendChild(schedFabEl);

    // ── Mobile "Book a Free Trial Week" floating pill (next to WhatsApp) ──
    const _noTrialFabPage = /\/(contact|booking)(\.html)?(\?.*)?$/.test(window.location.pathname);
    if (!_noTrialFabPage) {
      const trialFabEl = document.createElement('a');
      trialFabEl.id = 'trialFab';
      trialFabEl.href = '/contact';
      trialFabEl.setAttribute('aria-label', (COMP_T[_uiLang] || COMP_T.de)['aria.trial']);
      trialFabEl.innerHTML = `${SCHED_CAL_SVG}<span data-ci18n="trial.book">Gratis Probewoche buchen</span>`;
      document.body.appendChild(trialFabEl);

      const heroTrialBtn = document.getElementById('heroTrialBtn');
      if (heroTrialBtn) {
        new IntersectionObserver(entries => {
          trialFabEl.classList.toggle('visible', !entries[0].isIntersecting);
        }, { threshold: 0 }).observe(heroTrialBtn);
      } else {
        window.addEventListener('scroll', () => {
          trialFabEl.classList.toggle('visible', window.scrollY > 300);
        }, { passive: true });
      }
    }

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
    fbStyle.textContent = '.fb-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:7777;opacity:0;pointer-events:none;transition:opacity .3s ease;display:flex;align-items:center;justify-content:center;padding:24px}.fb-modal-overlay.open{opacity:1;pointer-events:all}.fb-modal-inner{background:var(--bg-2,#0a0b0c);border:1px solid var(--line-2,rgba(255,255,255,0.06));border-radius:16px;width:100%;max-width:560px;padding:36px;position:relative;transform:translateY(20px);transition:transform .35s cubic-bezier(.16,1,.3,1);max-height:90vh;overflow-y:auto}.fb-modal-overlay.open .fb-modal-inner{transform:translateY(0)}.fb-modal-close{position:absolute;top:16px;right:16px;background:none;border:1px solid var(--line-2,rgba(255,255,255,0.06));border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink-dim,#8a8c86);transition:color .2s,border-color .2s}.fb-modal-close:hover{color:var(--ink,#e8e8e4);border-color:rgba(255,255,255,0.25)}.fb-modal-close svg{width:12px;height:12px;stroke:currentColor;stroke-width:1.8;overflow:visible}.fb-modal-title{font-size:26px;font-family:"Clash Display",ui-sans-serif,system-ui,sans-serif;font-weight:700;color:var(--ink,#e8e8e4);margin-bottom:6px}.fb-modal-sub{font-size:14px;color:var(--ink-dim,#8a8c86);margin-bottom:28px;line-height:1.55}.fb-form{display:grid;grid-template-columns:1fr 1fr;gap:14px}.fb-form .fb-full{grid-column:1/-1}.fb-field{display:flex;flex-direction:column;gap:7px}.fb-field label{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-dim,#8a8c86)}.fb-field input,.fb-field textarea,.fb-field select{background:var(--bg,#040505);border:1px solid var(--line-2,rgba(255,255,255,0.06));border-radius:10px;padding:12px 14px;font-family:"General Sans",ui-sans-serif,system-ui,sans-serif;font-size:14px;color:var(--ink,#e8e8e4);outline:none;transition:border-color .25s}.fb-field input:focus,.fb-field textarea:focus,.fb-field select:focus{border-color:rgba(199,255,63,.4)}.fb-field textarea{resize:vertical;min-height:90px}.fb-field select{appearance:none;-webkit-appearance:none;cursor:pointer}.fb-stars{display:flex;gap:6px;margin-bottom:4px}.fb-star{font-size:22px;cursor:pointer;filter:grayscale(1);opacity:.35;background:none;border:none;padding:0;line-height:1;transition:opacity .15s,filter .15s}.fb-star.active{filter:none;opacity:1}.fb-submit-row{grid-column:1/-1;display:flex;align-items:center;gap:16px;margin-top:4px}.fb-success-screen{display:none;flex-direction:column;align-items:center;text-align:center;padding:12px 0 8px;gap:20px}.fb-success-screen.show{display:flex}.fb-success-icon svg{width:72px;height:72px}.fb-success-title{font-family:"Clash Display",ui-sans-serif,system-ui,sans-serif;font-size:clamp(22px,5vw,28px);font-weight:700;color:var(--ink,#e8e8e4)}.fb-success-sub{font-size:14px;color:var(--ink-dim,#8a8c86);line-height:1.6;max-width:320px}.fb-success-close-btn{min-width:160px;margin-top:8px;justify-content:center}@media(max-width:600px){.fb-modal-inner{padding:24px 20px}.fb-form{grid-template-columns:1fr}}';
    document.head.appendChild(fbStyle);

    document.body.insertAdjacentHTML('beforeend', '<div class="fb-modal-overlay" id="fbModal"><div class="fb-modal-inner"><button class="fb-modal-close" id="fbModalClose" aria-label="Close"><svg viewBox="0 0 16 16"><line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/></svg></button><div class="fb-modal-title" data-ci18n="fb.title">Feedback hinterlassen</div><p class="fb-modal-sub" data-ci18n="fb.sub">Hast du bei uns trainiert? Deine Erfahrung erscheint direkt in den Testimonials.</p><form class="fb-form" id="fbForm" novalidate><div class="fb-field"><label for="fbName" data-ci18n="fb.lbl.name">Dein Name</label><input type="text" id="fbName" placeholder="Jonas Lie" autocomplete="name"></div><div class="fb-field"><label for="fbTraining" data-ci18n="fb.lbl.training">Trainingsart</label><select id="fbTraining"><option value="" data-ci18n="fb.ph.training">Disziplin wählen</option></select></div><div class="fb-field fb-full"><label for="fbText" data-ci18n="fb.lbl.text">Deine Erfahrung</label><textarea id="fbText" placeholder="Wie war dein Training bei Power Fight?" data-ci18n-ph="fb.ph.text"></textarea></div><div class="fb-field fb-full"><label data-ci18n="fb.lbl.rating">Bewertung</label><div class="fb-stars" id="fbStars" role="group" aria-label="Rating"><button class="fb-star" type="button" data-val="1" aria-label="1 star">★</button><button class="fb-star" type="button" data-val="2" aria-label="2 stars">★</button><button class="fb-star" type="button" data-val="3" aria-label="3 stars">★</button><button class="fb-star" type="button" data-val="4" aria-label="4 stars">★</button><button class="fb-star" type="button" data-val="5" aria-label="5 stars">★</button></div></div><div class="fb-submit-row"><button class="btn btn-primary" type="submit"><span data-ci18n="fb.submit">Feedback einreichen</span></button></div></form><div class="fb-success-screen" id="fbSuccessScreen"><div class="fb-success-icon"><svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="23" stroke="#C7FF3F" stroke-width="1.5"/><path d="M13 24.5l8 8 14-16" stroke="#C7FF3F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="fb-success-title" data-ci18n="fb.success.title">Danke für dein Feedback!</div><p class="fb-success-sub" data-ci18n="fb.success.sub">Deine Bewertung ist nun im Testimonials-Bereich sichtbar.</p><button class="btn btn-primary fb-success-close-btn" id="fbSuccessDone"><span data-ci18n="fb.success.close">Schliessen</span></button></div></div></div>');

    // Apply language after ALL dynamic elements are in the DOM
    _compApplyLang(_initLang);

    const fbModalEl = document.getElementById('fbModal');

    window.openFeedbackModal = function () { fbModalEl.classList.add('open'); window.lockScroll(); _loadFbTrainingOptions(); };

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

    document.getElementById('fbForm').addEventListener('submit', async e => {
      e.preventDefault();
      const name = document.getElementById('fbName').value.trim();
      const training = document.getElementById('fbTraining').value;
      const text = document.getElementById('fbText').value.trim();
      if (!name || !training || !text) return;
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name, training, text, rating: fbRating || 5,
        approved: false, created_at: new Date().toISOString()
      };
      const btn = document.querySelector('#fbForm button[type="submit"], #fbForm .btn');
      if (btn) btn.disabled = true;
      // Persist to Supabase (pf_reviews_v1) so it reaches the admin approval queue
      try {
        const hdrs = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
        const res = await fetch(`${SB_URL}/rest/v1/settings?key=eq.pf_reviews_v1&select=value`, { headers: hdrs });
        const rows = res.ok ? await res.json() : [];
        let reviews = [];
        try { reviews = JSON.parse(rows?.[0]?.value || '[]') || []; } catch (_) {}
        reviews.unshift(entry); // newest first — shows at the top of admin + homepage slider

        const up = await fetch(`${SB_URL}/rest/v1/settings?on_conflict=key`, {
          method: 'POST',
          headers: { ...hdrs, Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ key: 'pf_reviews_v1', value: JSON.stringify(reviews) })
        });
        if (!up.ok) throw new Error('upsert ' + up.status);
      } catch (err) {
        console.warn('[PowerFight] Feedback save failed:', err);
        if (btn) btn.disabled = false;
        alert(_uiLang === 'en'
          ? 'Something went wrong sending your feedback. Please try again.'
          : 'Beim Senden deines Feedbacks ist etwas schiefgelaufen. Bitte versuche es erneut.');
        return;
      }
      // Local backup copy
      const all = window.loadFeedback(); all.push(entry); saveFeedback(all);
      if (window.onFeedbackSubmit) window.onFeedbackSubmit(entry);
      if (btn) btn.disabled = false;
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
