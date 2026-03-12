/* ════════════════════════════════════════════════
   journal.js — Text entries, audio recording, list
════════════════════════════════════════════════ */

import { api } from './api.js';

/* ── State ──────────────────────────────────── */
let currentPage = 1;
let totalPages  = 1;
let mediaRecorder = null;
let audioChunks   = [];
let recordInterval = null;
let recordSeconds  = 0;
let audioBlob      = null;
let analyserCtx    = null;
let animFrameId    = null;
let audioCtx       = null;

/* ═══════════════════════════════════════════════
   MOOD HELPERS
══════════════════════════════════════════════ */
const MOOD_EMOJI = {
  very_positive: '😄', positive: '😊', neutral: '😐',
  negative: '😔', very_negative: '😢',
};

function moodBadge(label, score) {
  const emoji = MOOD_EMOJI[label] || '❓';
  const scoreStr = score != null ? ` · ${score >= 0 ? '+' : ''}${score.toFixed(2)}` : '';
  return `<span class="mood-badge mood-${label}">${emoji} ${label.replace('_', ' ')}${scoreStr}</span>`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ═══════════════════════════════════════════════
   JOURNAL ENTRY CARD BUILDER
══════════════════════════════════════════════ */
function buildEntryCard(entry) {
  const div  = document.createElement('div');
  div.className = 'entry-card';
  div.dataset.id = entry._id;

  const hasAdvice = !!entry.aiAdvice;
  const adviceId  = `advice-${entry._id}`;
  const noteId    = `note-${entry._id}`;

  div.innerHTML = `
    <div class="entry-header">
      <div class="entry-header-left">
        ${moodBadge(entry.moodLabel, entry.moodScore)}
        ${entry.audioKey ? '<span class="score-chip">🎤 Audio</span>' : ''}
      </div>
      <span class="entry-date">${formatDate(entry.recordedAt)}</span>
    </div>
    ${entry.audioKey ? `<div style="margin: 0.8rem 0;"><audio controls src="/uploads/audio/${entry.audioKey}" style="width: 100%; height: 40px; border-radius: 8px;"></audio></div>` : ''}
    <p class="entry-body">${entry.transcript || ''}</p>
    ${entry.userNote ? `<p class="entry-body" style="color:var(--text-muted);margin-top:0.3rem">📌 ${entry.userNote}</p>` : ''}
    <div class="entry-actions">
      ${hasAdvice ? `<button class="advice-toggle" data-target="${adviceId}">💡 AI Advice</button>` : ''}
      <button class="btn btn-secondary btn-sm note-btn" data-target="${noteId}">✏️ Note</button>
      <button class="btn btn-danger btn-sm delete-btn" data-id="${entry._id}">🗑</button>
    </div>
    ${hasAdvice ? `<div class="advice-body hidden" id="${adviceId}">${entry.aiAdvice}</div>` : ''}
    <div class="hidden" id="${noteId}">
      <textarea class="note-input" placeholder="Add a note…" maxlength="500">${entry.userNote || ''}</textarea>
      <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.4rem">
        <button class="btn btn-secondary btn-sm cancel-note-btn" data-target="${noteId}">Cancel</button>
        <button class="btn btn-primary btn-sm save-note-btn" data-id="${entry._id}" data-target="${noteId}">Save</button>
      </div>
    </div>
  `;

  // Advice toggle
  div.querySelector('.advice-toggle')?.addEventListener('click', () => {
    document.getElementById(adviceId)?.classList.toggle('hidden');
  });

  // Note panel
  div.querySelector('.note-btn')?.addEventListener('click', () => {
    document.getElementById(noteId)?.classList.toggle('hidden');
  });
  div.querySelector('.cancel-note-btn')?.addEventListener('click', () => {
    document.getElementById(noteId)?.classList.add('hidden');
  });

  // Save note
  div.querySelector('.save-note-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const textarea = div.querySelector(`#${noteId} .note-input`);
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api.patch(`/journal/${btn.dataset.id}`, { userNote: textarea.value });
      document.getElementById(noteId)?.classList.add('hidden');
    } catch (err) { alert('Failed to save note: ' + err.message); }
    finally { btn.disabled = false; btn.textContent = 'Save'; }
  });

  // Delete
  div.querySelector('.delete-btn')?.addEventListener('click', async (e) => {
    if (!confirm('Delete this entry?')) return;
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = '…';
    try {
      await api.delete(`/journal/${btn.dataset.id}`);
      div.remove();
    } catch (err) { alert('Delete failed: ' + err.message); btn.disabled = false; btn.textContent = '🗑'; }
  });

  return div;
}

/* ═══════════════════════════════════════════════
   LOAD JOURNAL ENTRIES
══════════════════════════════════════════════ */
export async function loadJournal(page = 1) {
  const list = document.getElementById('journal-entries-list');
  if (!list) return;
  list.innerHTML = '<div class="empty-state"><div class="loading-spinner"></div></div>';

  try {
    const res = await api.get(`/journal?page=${page}&limit=10`);
    const { entries, pagination } = res.data;
    currentPage = pagination.page;
    totalPages  = pagination.totalPages;

    if (!entries.length && page === 1) {
      list.innerHTML = '<div class="empty-state">No journal entries yet. Start by recording or writing!</div>';
    } else {
      list.innerHTML = '';
      entries.forEach(e => list.appendChild(buildEntryCard(e)));
    }

    // Pagination
    const prevBtn  = document.getElementById('j-prev-btn');
    const nextBtn  = document.getElementById('j-next-btn');
    const pageInfo = document.getElementById('j-page-info');
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${Math.max(totalPages,1)}`;

    return entries;
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Error loading entries: ${err.message}</div>`;
    return [];
  }
}

/* ── Load recent 3 for dashboard ─────────────── */
export async function loadRecentEntries() {
  const list = document.getElementById('recent-entries-list');
  if (!list) return;
  try {
    const res = await api.get('/journal?page=1&limit=3');
    const { entries } = res.data;
    if (!entries.length) {
      list.innerHTML = '<div class="empty-state">No entries yet. Record your first mood!</div>';
    } else {
      list.innerHTML = '';
      entries.forEach(e => list.appendChild(buildEntryCard(e)));
    }
  } catch { /* silent */ }
}

/* ═══════════════════════════════════════════════
   TEXT ENTRY FORM
══════════════════════════════════════════════ */
function initTextEntry() {
  const openBtn   = document.getElementById('j-new-text-btn');
  const panel     = document.getElementById('text-entry-panel');
  const closeBtn  = document.getElementById('close-text-panel');
  const textarea  = document.getElementById('text-entry-input');
  const submitBtn = document.getElementById('submit-text-entry');
  const charCount = document.getElementById('char-count');
  const errEl     = document.getElementById('text-entry-error');

  openBtn?.addEventListener('click', () => { panel?.classList.remove('hidden'); textarea?.focus(); });
  closeBtn?.addEventListener('click', () => panel?.classList.add('hidden'));

  textarea?.addEventListener('input', () => {
    if (charCount) charCount.textContent = textarea.value.length;
  });

  submitBtn?.addEventListener('click', async () => {
    const text = textarea?.value.trim();
    if (!text) { errEl && (errEl.textContent = 'Please write something first.') && errEl.classList.remove('hidden'); return; }
    errEl?.classList.add('hidden');
    submitBtn.disabled = true; submitBtn.textContent = 'Analysing…';
    try {
      const includeAdvice = document.getElementById('text-include-advice')?.checked;
      await api.post('/journal/text', { text, includeAdvice });
      textarea.value = ''; if (charCount) charCount.textContent = '0';
      panel?.classList.add('hidden');
      await loadJournal(1);
      window.dispatchEvent(new Event('ve:new_entry'));
    } catch (err) {
      errEl && (errEl.textContent = err.message) && errEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false; submitBtn.textContent = 'Submit';
    }
  });

  // "New text entry" button on journal header btn shortcut from record nav
  document.getElementById('j-new-audio-btn')?.addEventListener('click', () => {
    window.location.hash = '#record';
  });
}

/* ═══════════════════════════════════════════════
   AUDIO RECORDING
══════════════════════════════════════════════ */
function tickTimer() {
  recordSeconds++;
  const m = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
  const s = String(recordSeconds % 60).padStart(2, '0');
  const el = document.getElementById('record-timer');
  if (el) el.textContent = `${m}:${s}`;
}

function drawVisualizer(analyser) {
  const canvas = document.getElementById('audio-visualizer');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const bufLen = analyser.frequencyBinCount;
  const data   = new Uint8Array(bufLen);
  const idle   = document.querySelector('.visualizer-idle');
  if (idle) idle.style.display = 'none';

  function draw() {
    animFrameId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(data);
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barW = canvas.width / bufLen * 2.5;
    let x = 0;
    for (let i = 0; i < bufLen; i++) {
      const h = (data[i] / 255) * canvas.height;
      const hue = 260 + (data[i] / 255) * 80;
      ctx.fillStyle = `hsla(${hue},80%,60%,0.85)`;
      ctx.fillRect(x, canvas.height - h, barW - 1, h);
      x += barW + 1;
    }
  }
  draw();
}

function stopVisualizer() {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  const idle = document.querySelector('.visualizer-idle');
  if (idle) idle.style.display = '';
  const canvas = document.getElementById('audio-visualizer');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

export function initRecorder() {
  const recordBtn  = document.getElementById('record-btn');
  const stopBtn    = document.getElementById('stop-btn');
  const cancelBtn  = document.getElementById('cancel-record-btn');
  const previewEl  = document.getElementById('audio-preview');
  const playback   = document.getElementById('audio-playback');
  const submitBtn  = document.getElementById('submit-audio-btn');
  const reRecBtn   = document.getElementById('re-record-btn');
  const statusEl   = document.getElementById('record-status');
  const resultCard = document.getElementById('record-result');

  if (!recordBtn) return;

  function resetRecorder() {
    audioChunks = []; audioBlob = null;
    recordSeconds = 0;
    const timer = document.getElementById('record-timer');
    if (timer) timer.textContent = '00:00';
    clearInterval(recordInterval);
    stopVisualizer();
    recordBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    cancelBtn.classList.add('hidden');
    previewEl?.classList.add('hidden');
    if (statusEl) statusEl.textContent = '';
  }

  recordBtn.addEventListener('click', async () => {
    resultCard?.classList.add('hidden');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Web Audio visualizer
      audioCtx    = new (window.AudioContext || window.webkitAudioContext)();
      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      drawVisualizer(analyser);

      // MediaRecorder — pick a supported format
      const mimeTypes = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'];
      const mime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';
      mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      audioChunks = [];

      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const actualMime = mediaRecorder.mimeType || 'audio/webm';
        audioBlob = new Blob(audioChunks, { type: actualMime });
        const url = URL.createObjectURL(audioBlob);
        if (playback) { playback.src = url; }
        previewEl?.classList.remove('hidden');
        stream.getTracks().forEach(t => t.stop());
        audioCtx?.close();
      };

      mediaRecorder.start(200);
      recordSeconds = 0;
      recordInterval = setInterval(tickTimer, 1000);
      recordBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      cancelBtn.classList.remove('hidden');
      if (statusEl) statusEl.textContent = '🔴 Recording…';
    } catch (err) {
      if (statusEl) statusEl.textContent = '⚠️ Microphone access denied: ' + err.message;
    }
  });

  stopBtn.addEventListener('click', () => {
    mediaRecorder?.stop();
    clearInterval(recordInterval);
    stopVisualizer();
    stopBtn.classList.add('hidden');
    cancelBtn.classList.remove('hidden');
    if (statusEl) statusEl.textContent = '';
  });

  cancelBtn.addEventListener('click', () => {
    mediaRecorder?.stop();
    resetRecorder();
  });

  reRecBtn?.addEventListener('click', resetRecorder);

  submitBtn?.addEventListener('click', async () => {
    if (!audioBlob) return;
    const btnText   = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    submitBtn.disabled = true;
    if (btnText)   btnText.style.opacity = '0';
    if (btnLoader) btnLoader.classList.remove('hidden');
    if (statusEl)  statusEl.textContent = '⏳ Uploading and analysing…';

    try {
      const ext = audioBlob.type.includes('ogg') ? 'ogg' : audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const fd  = new FormData();
      fd.append('audio', audioBlob, `recording.${ext}`);
      fd.append('includeAdvice', document.getElementById('audio-include-advice')?.checked ? 'true' : 'false');

      const res   = await import('./api.js').then(m => m.api.post('/journal/audio', fd));
      const entry = res.data.entry;
      const burnout = res.data.burnout;

      // Show result
      showRecordResult(entry, burnout);
      resetRecorder();
      if (statusEl) statusEl.textContent = '';
      window.dispatchEvent(new Event('ve:new_entry'));
    } catch (err) {
      if (statusEl) statusEl.textContent = '❌ ' + (err.message || 'Upload failed');
    } finally {
      submitBtn.disabled = false;
      if (btnText)   btnText.style.opacity = '1';
      if (btnLoader) btnLoader.classList.add('hidden');
    }
  });
}

function showRecordResult(entry, burnout) {
  const resultCard = document.getElementById('record-result');
  if (!resultCard) return;
  resultCard.classList.remove('hidden');

  const moodBadgeEl = document.getElementById('r-mood-badge');
  if (moodBadgeEl) moodBadgeEl.innerHTML = moodBadge(entry.moodLabel, entry.moodScore);

  const transcriptEl = document.getElementById('r-transcript');
  if (transcriptEl) transcriptEl.textContent = entry.transcript || '(No transcript)';

  const adviceSection = document.getElementById('r-advice-section');
  const adviceEl      = document.getElementById('r-advice');
  if (entry.aiAdvice && adviceSection && adviceEl) {
    adviceEl.textContent = entry.aiAdvice;
    adviceSection.classList.remove('hidden');
  } else {
    adviceSection?.classList.add('hidden');
  }

  // Gauge
  drawGauge('result-gauge', entry.moodScore);

  // Burnout banner
  if (burnout?.burnoutFlagged) {
    document.getElementById('burnout-banner')?.classList.remove('hidden');
  }
}

function drawGauge(canvasId, score) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2, cy = canvas.height / 2, r = 45;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Track
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.stroke();

  // Value arc
  const pct    = (score + 1) / 2; // -1..1 → 0..1
  const endAng = Math.PI + pct * Math.PI;
  const grad   = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, '#ef4444');
  grad.addColorStop(0.5, '#f59e0b');
  grad.addColorStop(1, '#22c55e');
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, endAng);
  ctx.strokeStyle = grad; ctx.lineWidth = 8;
  ctx.lineCap = 'round'; ctx.stroke();

  // Score text
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 14px Inter,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((score >= 0 ? '+' : '') + score.toFixed(2), cx, cy + 18);
}
export { drawGauge }; // re-export for dashboard

/* ═══════════════════════════════════════════════
   INIT — called by app.js after login
══════════════════════════════════════════════ */
export function initJournal() {
  initTextEntry();
  initRecorder();

  // Pagination
  document.getElementById('j-prev-btn')?.addEventListener('click', () => loadJournal(currentPage - 1));
  document.getElementById('j-next-btn')?.addEventListener('click', () => loadJournal(currentPage + 1));
}
