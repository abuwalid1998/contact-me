/**
 * AMJAD WAKID KHALILIAH - DIGITAL CONTACT & PORTFOLIO
 * Interactive JavaScript Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  initBackgroundCanvas();
  initViewCounter();
  initTabs();
  initContactActions();
  initQrModal();
  initCalendarScheduler();
  initFormActions();
  initCurrentYear();
});

/* ==========================================================================
   1. AMBIENT PARTICLE BACKGROUND CANVAS
   ========================================================================== */
function initBackgroundCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width, height;
  let particles = [];
  const particleCount = 38;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resize);
  resize();

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.radius = Math.random() * 2 + 1;
      this.alpha = Math.random() * 0.5 + 0.2;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0) this.x = width;
      if (this.x > width) this.x = 0;
      if (this.y < 0) this.y = height;
      if (this.y > height) this.y = 0;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(125, 211, 252, ${this.alpha})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    // Draw connecting lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          const lineAlpha = (1 - dist / 110) * 0.15;
          ctx.strokeStyle = `rgba(56, 189, 248, ${lineAlpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    particles.forEach(p => {
      p.update();
      p.draw();
    });

    requestAnimationFrame(render);
  }

  render();
}

/* ==========================================================================
   2. LIVE SITE VIEW COUNTER (RIGHT BOTTOM)
   ========================================================================== */
function initViewCounter() {
  const visitCountEl = document.getElementById('visitCount');
  const viewCounterBadge = document.getElementById('viewCounterBadge');
  
  const STORAGE_KEY = 'amjad_contact_site_views_v1';
  const BASE_VIEWS = 1248; // Starting realistic organic visit baseline

  let localViews = parseInt(localStorage.getItem(STORAGE_KEY), 10);
  
  if (isNaN(localViews)) {
    localViews = BASE_VIEWS + 1;
  } else {
    localViews += 1;
  }

  localStorage.setItem(STORAGE_KEY, localViews.toString());

  // Animate count up effect
  animateCounter(visitCountEl, localViews);

  // Optional: Try public CountAPI for real multi-device cloud sync if available
  fetch('https://api.counterapi.dev/v1/amjadkhaliliah_contact/views/up')
    .then(res => res.json())
    .then(data => {
      if (data && data.count) {
        const total = BASE_VIEWS + data.count;
        localStorage.setItem(STORAGE_KEY, total.toString());
        animateCounter(visitCountEl, total);
      }
    })
    .catch(() => {
      // Fallback works automatically from localStorage
    });

  if (viewCounterBadge) {
    viewCounterBadge.addEventListener('click', () => {
      const current = localStorage.getItem(STORAGE_KEY) || localViews;
      showToast(`📊 Page view #${current}! Thanks for visiting.`);
    });
  }
}

function animateCounter(element, target) {
  if (!element) return;
  const duration = 1200;
  const start = Math.max(0, target - 45);
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOutQuad = 1 - (1 - progress) * (1 - progress);
    const current = Math.floor(start + (target - start) * easeOutQuad);
    
    element.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = target.toLocaleString();
    }
  }

  requestAnimationFrame(update);
}

/* ==========================================================================
   3. TABS SYSTEM
   ========================================================================== */
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });
}

/* ==========================================================================
   4. VCARD & SHARING ACTIONS
   ========================================================================== */
function initContactActions() {
  const saveContactBtn = document.getElementById('saveContactBtn');
  const shareBtn = document.getElementById('shareBtn');

  if (saveContactBtn) {
    saveContactBtn.addEventListener('click', generateAndDownloadVCard);
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const shareData = {
        title: 'Amjad Wakid Khaliliah - Contact & Portfolio',
        text: 'Contact details of Amjad Wakid Khaliliah (CTO FACEPAL, CEO PAL-DI, AI Engineer & Architect)',
        url: window.location.href
      };

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        navigator.share(shareData).catch(() => {});
      } else {
        copyToClipboard(window.location.href, 'Profile link copied to clipboard!');
      }
    });
  }
}

function generateAndDownloadVCard() {
  const vCardContent = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Khaliliah;Amjad;Wakid;;',
    'FN:Amjad Wakid Khaliliah',
    'TITLE:CTO FACEPAL | CEO PAL-DI | AI Engineer',
    'ORG:FACEPAL; PAL-DI (Sanad)',
    'TEL;TYPE=CELL,VOICE,PREF:+972595457008',
    'EMAIL;TYPE=INTERNET,PREF:amjadkhaliliah1998@gmail.com',
    'URL:https://www.linkedin.com/in/amjadkhalilia',
    'ADR;TYPE=WORK:;;Ramallah;West Bank;;;Palestine',
    'NOTE:Software Engineer who builds smart AI systems, trains models for business needs, and designs cloud systems. Founder of FacePal.',
    'END:VCARD'
  ].join('\r\n');

  const blob = new Blob([vCardContent], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Amjad_Khaliliah.vcf');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('📇 Contact card (.vcf) downloaded! Tap to save in your phone.');
}

/* ==========================================================================
   5. QR CODE MODAL
   ========================================================================== */
function initQrModal() {
  const qrBtn = document.getElementById('qrBtn');
  const qrModal = document.getElementById('qrModal');
  const closeQrModal = document.getElementById('closeQrModal');
  const qrCodeImage = document.getElementById('qrCodeImage');
  const copyProfileUrlBtn = document.getElementById('copyProfileUrlBtn');

  const pageUrl = window.location.href;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=070e20&bgcolor=ffffff&data=${encodeURIComponent(pageUrl)}`;

  if (qrCodeImage) {
    qrCodeImage.src = qrApiUrl;
  }

  if (qrBtn && qrModal) {
    qrBtn.addEventListener('click', () => {
      qrModal.classList.add('open');
    });
  }

  if (closeQrModal && qrModal) {
    closeQrModal.addEventListener('click', () => {
      qrModal.classList.remove('open');
    });
  }

  if (qrModal) {
    qrModal.addEventListener('click', (e) => {
      if (e.target === qrModal) {
        qrModal.classList.remove('open');
      }
    });
  }

  if (copyProfileUrlBtn) {
    copyProfileUrlBtn.addEventListener('click', () => {
      copyToClipboard(pageUrl, 'Profile URL copied!');
      qrModal.classList.remove('open');
    });
  }
}

/* ==========================================================================
   6. GOOGLE CALENDAR APPOINTMENT SCHEDULER
   ========================================================================== */
function initCalendarScheduler() {
  const bookMeetingBtn = document.getElementById('bookMeetingBtn');
  const openCalendarScheduler = document.getElementById('openCalendarScheduler');
  const calendarModal = document.getElementById('calendarModal');
  const closeCalModal = document.getElementById('closeCalModal');
  const confirmGCalBtn = document.getElementById('confirmGCalBtn');

  const meetingDateInput = document.getElementById('meetingDate');
  
  // Set default meeting date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  if (meetingDateInput) {
    meetingDateInput.value = `${yyyy}-${mm}-${dd}`;
    meetingDateInput.min = `${yyyy}-${mm}-${dd}`;
  }

  function openModal() {
    if (calendarModal) calendarModal.classList.add('open');
  }

  function closeModal() {
    if (calendarModal) calendarModal.classList.remove('open');
  }

  if (bookMeetingBtn) bookMeetingBtn.addEventListener('click', openModal);
  if (openCalendarScheduler) openCalendarScheduler.addEventListener('click', openModal);
  if (closeCalModal) closeCalModal.addEventListener('click', closeModal);

  if (calendarModal) {
    calendarModal.addEventListener('click', (e) => {
      if (e.target === calendarModal) closeModal();
    });
  }

  if (confirmGCalBtn) {
    confirmGCalBtn.addEventListener('click', () => {
      const title = document.getElementById('meetingTitle').value || 'Meeting with Amjad Khaliliah';
      const dateVal = document.getElementById('meetingDate').value;
      const timeVal = document.getElementById('meetingTime').value || '11:00';
      const details = document.getElementById('meetingDetails').value || '';

      let datesParam = '';
      if (dateVal) {
        const [year, month, day] = dateVal.split('-');
        const [hour, min] = timeVal.split(':');
        
        const startDate = new Date(year, month - 1, day, hour, min);
        const endDate = new Date(startDate.getTime() + 45 * 60000); // 45 min meeting

        function formatGCalDate(d) {
          return d.toISOString().replace(/-|:|\.\d+/g, '');
        }

        datesParam = `&dates=${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`;
      }

      const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}&add=amjadkhaliliah1998@gmail.com${datesParam}`;

      window.open(gcalUrl, '_blank');
      closeModal();
      showToast('📅 Opening Google Calendar event invitation...');
    });
  }
}

/* ==========================================================================
   7. DIRECT FORM ACTIONS (WHATSAPP & EMAIL)
   ========================================================================== */
function initFormActions() {
  const quickContactForm = document.getElementById('quickContactForm');
  const sendViaWhatsApp = document.getElementById('sendViaWhatsApp');

  if (sendViaWhatsApp) {
    sendViaWhatsApp.addEventListener('click', () => {
      const name = document.getElementById('senderName').value.trim();
      const subject = document.getElementById('senderSubject').value.trim();
      const message = document.getElementById('senderMessage').value.trim();

      if (!message) {
        showToast('⚠️ Please enter a message before sending.');
        document.getElementById('senderMessage').focus();
        return;
      }

      let text = `Hello Amjad,\n`;
      if (name) text += `My name is *${name}*.\n`;
      if (subject) text += `Subject: *${subject}*\n\n`;
      text += `${message}`;

      const waUrl = `https://wa.me/972595457008?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
      showToast('💬 Opening WhatsApp conversation...');
    });
  }

  if (quickContactForm) {
    quickContactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('senderName').value.trim();
      const subject = document.getElementById('senderSubject').value.trim() || 'Website Inquiry';
      const message = document.getElementById('senderMessage').value.trim();

      const body = `Hi Amjad,\n\nName: ${name}\n\nMessage:\n${message}\n\nSent via your digital contact website.`;
      const mailtoUrl = `mailto:amjadkhaliliah1998@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      window.location.href = mailtoUrl;
      showToast('✉️ Opening email client...');
    });
  }
}

/* ==========================================================================
   8. UTILITIES & HELPERS
   ========================================================================== */
function copyToClipboard(text, message) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(message || 'Copied to clipboard!');
    }).catch(() => {
      fallbackCopy(text, message);
    });
  } else {
    fallbackCopy(text, message);
  }
}

function fallbackCopy(text, message) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast(message || 'Copied to clipboard!');
  } catch (err) {
    showToast('Failed to copy');
  }
  document.body.removeChild(textArea);
}

function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMessage');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = msg;
  toast.classList.add('show');

  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

function initCurrentYear() {
  const yearEl = document.getElementById('currentYear');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}
