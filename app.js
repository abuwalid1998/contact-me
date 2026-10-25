/**
 * Amjad Wakid Khaliliah — Digital contact card
 * Interaction layer. Everything a person can touch is driven by springs:
 * they start from the on-screen value, carry velocity, and can be grabbed
 * and reversed mid-flight.
 */
'use strict';

const PHONE = '972595457008';
const EMAIL = 'amjadkhaliliah1998@gmail.com';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ==========================================================================
   Physics helpers
   ========================================================================== */

/**
 * Spring described the way Apple does it: damping ratio (1 = no overshoot)
 * and response (seconds to reach the target, roughly). No fixed duration.
 */
class Spring {
  constructor({ value = 0, response = 0.4, damping = 1, precision = 0.5, onUpdate } = {}) {
    this.x = value;
    this.v = 0;
    this.target = value;
    this.response = response;
    this.damping = damping;
    this.precision = precision;
    this.onUpdate = onUpdate || (() => {});
    this.onRest = null;
    this.raf = 0;
    this.last = 0;
  }
  get running() { return this.raf !== 0; }
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  /** Jump without animating (used while a finger is in control). */
  set(x) {
    this.stop();
    this.x = this.target = x;
    this.v = 0;
    this.onUpdate(x);
  }
  to(target, opts = {}) {
    this.target = target;
    if (opts.velocity !== undefined) this.v = opts.velocity;
    if (opts.response !== undefined) this.response = opts.response;
    if (opts.damping !== undefined) this.damping = opts.damping;
    this.onRest = opts.onRest || null;
    if (reduceMotion.matches) {
      this.set(target);
      this.finish();
      return;
    }
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.tick(t));
    }
  }
  tick(now) {
    let dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    const k = Math.pow((2 * Math.PI) / this.response, 2);   // stiffness (mass = 1)
    const c = (4 * Math.PI * this.damping) / this.response;  // damping coefficient
    const h = 1 / 240;
    while (dt > 0) {                                          // fixed sub-steps for stability
      const s = Math.min(h, dt);
      const a = -k * (this.x - this.target) - c * this.v;
      this.v += a * s;
      this.x += this.v * s;
      dt -= s;
    }
    if (Math.abs(this.v) < this.precision * 10 && Math.abs(this.x - this.target) < this.precision) {
      this.x = this.target;
      this.v = 0;
      this.raf = 0;
      this.onUpdate(this.x);
      this.finish();
      return;
    }
    this.onUpdate(this.x);
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }
  finish() {
    const cb = this.onRest;
    this.onRest = null;
    if (cb) cb();
  }
}

/** Apple's momentum projection (from Designing Fluid Interfaces). */
function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary instead of a hard stop. */
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Short position history, so release velocity reflects the last ~100ms. */
function velocityTracker() {
  const pts = [];
  return {
    reset() { pts.length = 0; },
    add(y, t) {
      pts.push({ y, t });
      while (pts.length > 2 && t - pts[0].t > 100) pts.shift();
    },
    velocity(now = performance.now()) {
      if (pts.length < 2) return 0;
      const a = pts[0];
      const b = pts[pts.length - 1];
      if (now - b.t > 60) return 0;           // finger paused before lifting
      const dt = (b.t - a.t) / 1000;
      return dt > 0 ? (b.y - a.y) / dt : 0;
    },
  };
}

/**
 * Vertical drag recogniser with hysteresis. Feedback is continuous (onMove
 * fires every pointermove) and release hands over velocity.
 */
function verticalDrag(el, { canStart, onStart, onMove, onEnd, threshold = 8 }) {
  const tracker = velocityTracker();
  let id = null, startX = 0, startY = 0, active = false, suppressClick = false;

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || id !== null) return;
    if (canStart && !canStart(e)) return;
    id = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    active = false;
    tracker.reset();
    tracker.add(e.clientY, e.timeStamp);
  });

  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dy = e.clientY - startY;
    const dx = e.clientX - startX;
    tracker.add(e.clientY, e.timeStamp);
    if (!active) {
      if (Math.abs(dy) < threshold || Math.abs(dy) < Math.abs(dx)) {
        if (Math.abs(dx) > threshold * 2) id = null;     // clearly horizontal: give up
        return;
      }
      active = true;
      suppressClick = true;
      el.setPointerCapture(id);
      startY = e.clientY;                               // track 1:1 from here, no jump
      onStart && onStart();
    }
    e.preventDefault();
    onMove(e.clientY - startY);
  });

  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    if (!active) return;
    active = false;
    onEnd(tracker.velocity(e.timeStamp));
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  // A drag that started on a button must not also "click" it.
  el.addEventListener('click', (e) => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; }
  }, true);
  el.addEventListener('pointerdown', () => { suppressClick = false; }, true);
}

/* ==========================================================================
   Boot
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initPressFeedback();
  initNavBar();
  initSheets();
  initSegmented();
  initContactActions();
  initQr();
  initCalendarScheduler();
  initFormActions();
  initViewCounter();
  initCurrentYear();
});

/* ==========================================================================
   1. Press feedback — highlight on pointer-down, commit on release
   ========================================================================== */
function initPressFeedback() {
  let pressed = null, x0 = 0, y0 = 0;
  const release = () => { if (pressed) pressed.classList.remove('is-pressed'); pressed = null; };

  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-press]');
    if (!el || el.disabled) return;
    pressed = el;
    x0 = e.clientX; y0 = e.clientY;
    el.classList.add('is-pressed');
  }, { passive: true });

  document.addEventListener('pointermove', (e) => {
    if (pressed && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) release();   // became a scroll
  }, { passive: true });

  ['pointerup', 'pointercancel', 'dragstart'].forEach((t) => document.addEventListener(t, release, { passive: true }));
  window.addEventListener('blur', release);
}

/* ==========================================================================
   2. Navigation bar — material and title track the scroll 1:1
   ========================================================================== */
function initNavBar() {
  const nav = $('#nav');
  const poster = $('#poster');
  if (!nav || !poster) return;
  let queued = false;

  const update = () => {
    queued = false;
    const navBottom = nav.getBoundingClientRect().bottom;
    const posterBottom = poster.getBoundingClientRect().bottom;
    const p = clamp((navBottom + 72 - posterBottom) / 72, 0, 1);
    nav.style.setProperty('--p', p.toFixed(3));
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  update();
}

/* ==========================================================================
   3. Sheets — drag to dismiss, momentum projection, rubber-band at the top
   ========================================================================== */
const sheets = {};

class Sheet {
  constructor(layer) {
    this.layer = layer;
    this.panel = $('.sheet', layer);
    this.scrim = $('.sheet-scrim', layer);
    this.body = $('.sheet-body', layer);
    this.page = [$('#page'), $('#nav')];
    this.height = 600;
    this.isOpen = false;
    this.returnFocus = null;
    this.spring = new Spring({ value: 1e4, precision: 0.5, onUpdate: (y) => this.render(y) });

    $$('[data-close]', layer).forEach((el) => el.addEventListener('click', () => this.close()));
    // Listen on the document: tapping a non-focusable part of the sheet moves focus to <body>.
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      if (e.key === 'Tab') {
        if (!this.panel.contains(document.activeElement)) { e.preventDefault(); $('.sheet-title', this.panel).focus(); return; }
        this.trapFocus(e);
      }
    });

    let startY = 0;
    verticalDrag(this.panel, {
      canStart: (e) => {
        if (e.target.closest('input, textarea, select')) return false;
        const inBody = e.target.closest('.sheet-body');
        return !(inBody && inBody.scrollTop > 0);       // let scrolled content scroll
      },
      onStart: () => {
        this.spring.stop();                              // grab it mid-flight
        startY = this.spring.x;                          // from the presentation value
      },
      onMove: (dy) => this.spring.set(startY + dy),
      onEnd: (velocity) => {
        const y = this.spring.x;
        const landing = y + project(velocity);
        if (landing > this.height * 0.5 && velocity > -200) {
          this.close(velocity);
        } else {
          // Bounce only because the gesture carried momentum.
          const damping = Math.abs(velocity) > 300 ? 0.8 : 1;
          this.spring.to(0, { velocity, damping, response: 0.3 });
        }
      },
    });

    window.addEventListener('resize', () => { if (this.isOpen) this.measure(); });
  }

  measure() {
    this.height = this.panel.offsetHeight + 32;
    this.body.classList.toggle('is-scrollable', this.body.scrollHeight > this.body.clientHeight + 1);
  }

  render(y) {
    const visual = y < 0 ? -rubberband(-y, this.height) : y;
    this.panel.style.transform = `translate3d(0, ${visual}px, 0)`;
    const progress = clamp(1 - y / this.height, 0, 1);
    this.scrim.style.opacity = progress;
    if (reduceMotion.matches) this.panel.style.opacity = progress > 0.5 ? 1 : 0;
  }

  open(trigger) {
    Object.values(sheets).forEach((s) => s !== this && s.isOpen && s.close());
    this.returnFocus = trigger || document.activeElement;
    const wasHidden = this.layer.hidden;
    this.layer.hidden = false;
    this.measure();
    if (wasHidden) this.spring.set(this.height);        // start just below the edge
    this.isOpen = true;
    document.documentElement.classList.add('sheet-open');
    this.page.forEach((el) => el && (el.inert = true));
    this.spring.to(0, { damping: 1, response: 0.38 });
    requestAnimationFrame(() => $('.sheet-title', this.layer)?.focus({ preventScroll: true }));
  }

  close(velocity = 0) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.page.forEach((el) => el && (el.inert = false));
    document.documentElement.classList.remove('sheet-open');
    this.spring.to(this.height, {
      velocity,
      damping: 1,
      response: 0.32,
      onRest: () => {
        if (this.isOpen) return;
        this.layer.hidden = true;
        this.returnFocus?.focus?.({ preventScroll: true });
      },
    });
  }

  trapFocus(e) {
    const items = $$('button, a[href], input, textarea, [tabindex="0"]', this.panel).filter((el) => !el.disabled && el.offsetParent);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

function initSheets() {
  $$('.sheet-layer').forEach((layer) => { sheets[layer.id] = new Sheet(layer); });
  $$('[data-open-sheet]').forEach((btn) => {
    btn.addEventListener('click', () => sheets[btn.dataset.openSheet]?.open(btn));
  });
}

/* ==========================================================================
   4. Segmented control — spring-driven thumb, height follows content
   ========================================================================== */
function initSegmented() {
  const control = $('#segmented');
  const panesWrap = $('#panes');
  if (!control || !panesWrap) return;
  const thumb = $('.segmented-thumb', control);
  const tabs = $$('[role="tab"]', control);

  const thumbX = new Spring({ precision: 0.2, onUpdate: (x) => { thumb.style.transform = `translate3d(${x}px,0,0)`; } });
  const thumbW = new Spring({ precision: 0.2, onUpdate: (w) => { thumb.style.width = `${w}px`; } });
  const height = new Spring({ precision: 0.5, onUpdate: (h) => { panesWrap.style.height = `${h}px`; } });

  let current = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  const place = (i, animate) => {
    const t = tabs[i];
    if (animate) {
      thumbX.to(t.offsetLeft, { response: 0.32, damping: 1 });
      thumbW.to(t.offsetWidth, { response: 0.32, damping: 1 });
    } else {
      thumbX.set(t.offsetLeft);
      thumbW.set(t.offsetWidth);
    }
  };

  const select = (i, focus) => {
    if (i === current) return;
    const from = panesWrap.offsetHeight;
    tabs.forEach((t, j) => {
      const on = j === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    current = i;
    if (focus) tabs[i].focus();
    place(i, true);

    // Animate the container from its current height to the new content height.
    panesWrap.style.height = 'auto';
    const to = panesWrap.offsetHeight;
    if (height.running) {
      panesWrap.style.height = `${height.x}px`;
    } else {
      height.set(from);
    }
    height.to(to, { response: 0.36, damping: 1, onRest: () => { panesWrap.style.height = ''; } });
  };

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i, false));
    t.addEventListener('keydown', (e) => {
      const map = { ArrowRight: 1, ArrowLeft: -1 };
      if (map[e.key]) { e.preventDefault(); select((current + map[e.key] + tabs.length) % tabs.length, true); }
      if (e.key === 'Home') { e.preventDefault(); select(0, true); }
      if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, true); }
    });
  });

  place(current, false);
  new ResizeObserver(() => place(current, false)).observe(control);
}

/* ==========================================================================
   5. vCard & sharing
   ========================================================================== */
function initContactActions() {
  $('#saveContactBtn')?.addEventListener('click', generateAndDownloadVCard);

  $('#shareBtn')?.addEventListener('click', () => {
    const shareData = {
      title: 'Amjad Wakid Khaliliah - Contact & Portfolio',
      text: 'Contact details of Amjad Wakid Khaliliah (CTO FACEPAL, CEO PAL-DI, AI Engineer & Architect)',
      url: pageUrl(),
    };
    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      navigator.share(shareData).catch(() => {});
    } else {
      copyToClipboard(shareData.url, 'Link copied');
    }
  });
}

function generateAndDownloadVCard() {
  const vCardContent = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Khaliliah;Amjad;Wakid;;',
    'FN:Amjad Wakid Khaliliah',
    'TITLE:CTO FACEPAL | CEO PAL-DI | AI Engineer',
    'ORG:FACEPAL; PAL-DI (Sanad)',
    `TEL;TYPE=CELL,VOICE,PREF:+${PHONE}`,
    `EMAIL;TYPE=INTERNET,PREF:${EMAIL}`,
    'URL:https://www.linkedin.com/in/amjadkhalilia',
    'ADR;TYPE=WORK:;;Ramallah;West Bank;;;Palestine',
    'NOTE:Software Engineer who builds smart AI systems, trains models for business needs, and designs cloud systems. Founder of FacePal.',
    'END:VCARD',
  ].join('\r\n');

  const blob = new Blob([vCardContent], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Amjad_Khaliliah.vcf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast('Contact card downloaded');
}

/* ==========================================================================
   6. QR code — generated locally, crisp at any size
   ========================================================================== */
function pageUrl() {
  return window.location.href.split('#')[0];
}

function initQr() {
  const holder = $('#qrCode');
  const qrBtn = $('#qrBtn');
  if (!holder) return;
  let rendered = false;

  const render = () => {
    if (rendered) return;
    rendered = true;
    if (typeof window.qrcode === 'function') {
      const qr = window.qrcode(0, 'M');
      qr.addData(pageUrl());
      qr.make();
      const n = qr.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      }
      holder.innerHTML = `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true"><path fill="#13213f" d="${d}"/></svg>`;
    } else {
      // Fallback if the local generator failed to load.
      const img = new Image();
      img.alt = '';
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=480x480&color=13213f&bgcolor=ffffff&data=${encodeURIComponent(pageUrl())}`;
      holder.appendChild(img);
    }
  };

  qrBtn?.addEventListener('click', () => { render(); sheets.qrSheet?.open(qrBtn); });

  $('#copyProfileUrlBtn')?.addEventListener('click', () => {
    copyToClipboard(pageUrl(), 'Link copied');
    sheets.qrSheet?.close();
  });
}

/* ==========================================================================
   7. Google Calendar scheduler
   ========================================================================== */
function initCalendarScheduler() {
  const dateInput = $('#meetingDate');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  if (dateInput) { dateInput.value = iso; dateInput.min = iso; }

  $('#confirmGCalBtn')?.addEventListener('click', () => {
    const title = $('#meetingTitle').value || 'Meeting with Amjad Khaliliah';
    const dateVal = $('#meetingDate').value;
    const timeVal = $('#meetingTime').value || '11:00';
    const details = $('#meetingDetails').value || '';

    let datesParam = '';
    if (dateVal) {
      const [year, month, day] = dateVal.split('-').map(Number);
      const [hour, min] = timeVal.split(':').map(Number);
      const start = new Date(year, month - 1, day, hour, min);
      const end = new Date(start.getTime() + 45 * 60000);
      const fmt = (d) => d.toISOString().replace(/-|:|\.\d+/g, '');
      datesParam = `&dates=${fmt(start)}/${fmt(end)}`;
    }

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}&add=${EMAIL}${datesParam}`;
    window.open(gcalUrl, '_blank', 'noopener');
    sheets.calendarSheet?.close();
    showToast('Opening Google Calendar');
  });
}

/* ==========================================================================
   8. Quick message — inline validation, WhatsApp or email
   ========================================================================== */
function initFormActions() {
  const form = $('#quickContactForm');
  const message = $('#senderMessage');
  const error = $('#messageError');
  if (!form || !message) return;
  const field = message.closest('.field');

  const validate = () => {
    if (message.value.trim()) return true;
    field.setAttribute('data-invalid', '');
    message.setAttribute('aria-invalid', 'true');
    error.textContent = 'Write a message first.';
    message.focus();
    return false;
  };
  message.addEventListener('input', () => {
    if (!message.value.trim()) return;
    field.removeAttribute('data-invalid');
    message.removeAttribute('aria-invalid');
    error.textContent = '';
  });

  $('#sendViaWhatsApp')?.addEventListener('click', () => {
    if (!validate()) return;
    const name = $('#senderName').value.trim();
    const subject = $('#senderSubject').value.trim();
    let text = 'Hello Amjad,\n';
    if (name) text += `My name is *${name}*.\n`;
    if (subject) text += `Subject: *${subject}*\n\n`;
    text += message.value.trim();
    window.open(`https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    showToast('Opening WhatsApp');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;
    const name = $('#senderName').value.trim();
    const subject = $('#senderSubject').value.trim() || 'Website Inquiry';
    const body = `Hi Amjad,\n\nName: ${name}\n\nMessage:\n${message.value.trim()}\n\nSent via your digital contact website.`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    showToast('Opening your email app');
  });
}

/* ==========================================================================
   9. View counter
   ========================================================================== */
function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, val) { try { localStorage.setItem(key, val); } catch { /* private mode */ } }

function initViewCounter() {
  const el = $('#visitCount');
  if (!el) return;
  const STORAGE_KEY = 'amjad_contact_site_views_v1';
  const BASE_VIEWS = 1248;

  let views = parseInt(storageGet(STORAGE_KEY), 10);
  views = Number.isNaN(views) ? BASE_VIEWS + 1 : views + 1;
  storageSet(STORAGE_KEY, String(views));
  el.textContent = views.toLocaleString();

  fetch('https://api.counterapi.dev/v1/amjadkhaliliah_contact/views/up')
    .then((res) => res.json())
    .then((data) => {
      if (data && data.count) {
        const total = BASE_VIEWS + data.count;
        storageSet(STORAGE_KEY, String(total));
        el.textContent = total.toLocaleString();
      }
    })
    .catch(() => {});
}

/* ==========================================================================
   10. HUD notification — springs in from the top, flick up to dismiss
   ========================================================================== */
const hud = (() => {
  let el, msg, icon, spring, timer, height = 80, visible = false;

  function init() {
    el = $('#toastNotification');
    msg = $('#toastMessage');
    icon = $('#toastIcon use');
    spring = new Spring({
      value: -200,
      precision: 0.5,
      onUpdate: (y) => {
        const visual = y > 0 ? rubberband(y, height) : y;
        el.style.transform = `translate3d(-50%, ${visual}px, 0)`;
        if (reduceMotion.matches) el.style.opacity = y > -height / 2 ? 1 : 0;
      },
    });

    let startY = 0;
    verticalDrag(el, {
      threshold: 4,
      onStart: () => { clearTimeout(timer); spring.stop(); startY = spring.x; },
      onMove: (dy) => spring.set(startY + dy),
      onEnd: (velocity) => {
        if (spring.x + project(velocity) < -height * 0.4) hide(velocity);
        else { spring.to(0, { velocity, damping: Math.abs(velocity) > 300 ? 0.8 : 1, response: 0.35 }); schedule(); }
      },
    });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => hide(0), 2800);
  }

  function hide(velocity) {
    clearTimeout(timer);
    visible = false;
    spring.to(-height * 2, { velocity, damping: 1, response: 0.35, onRest: () => { if (!visible) el.style.visibility = 'hidden'; } });
  }

  function show(text, isError) {
    if (!el) init();
    msg.textContent = text;
    el.classList.toggle('is-error', !!isError);
    icon.setAttribute('href', isError ? '#i-alert' : '#i-check');
    el.style.visibility = 'visible';
    height = el.offsetHeight + 16;
    if (!visible && !spring.running) spring.set(-height * 2);
    visible = true;
    spring.to(0, { damping: 1, response: 0.4 });
    schedule();
  }

  return { show };
})();

function showToast(text, isError) { hud.show(text, isError); }

/* ==========================================================================
   Utilities
   ========================================================================== */
function copyToClipboard(text, message) {
  const done = () => showToast(message || 'Copied');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    showToast('Couldn’t copy the link. Copy it from the address bar.', true);
  }
  ta.remove();
}

function initCurrentYear() {
  const el = $('#currentYear');
  if (el) el.textContent = new Date().getFullYear();
}
