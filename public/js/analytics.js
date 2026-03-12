/* ════════════════════════════════════════════════
   analytics.js — Charts and burnout status
════════════════════════════════════════════════ */

import { api } from './api.js';

/* ── Chart.js default overrides ─────────────── */
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
}

let weeklyLineChart   = null;
let moodDoughnutChart = null;
let alltimeBarChart   = null;

const MOOD_COLORS = {
  very_positive: '#4ade80',
  positive:      '#22d3ee',
  neutral:       '#94a3b8',
  negative:      '#fb923c',
  very_negative: '#f87171',
};

function destroyChart(c) { if (c) { c.destroy(); } }

/* ═══════════════════════════════════════════════
   BURNOUT STATUS
══════════════════════════════════════════════ */
async function loadBurnoutStatus() {
  const el = document.getElementById('burnout-status-content');
  if (!el) return null;
  try {
    const res = await api.get('/analytics/burnout-status');
    const d   = res.data;
    const flagged = d.burnoutFlagged;
    el.innerHTML = `
      <p class="${flagged ? 'burnout-flag' : 'burnout-ok'}">
        ${flagged ? '⚠️ Burnout Detected' : '✅ No Burnout Detected'}
      </p>
      <p class="burnout-meta">Negative streak: <strong>${d.negativeStreak}</strong> / ${d.threshold} threshold</p>
      ${d.burnoutFlaggedAt ? `<p class="burnout-meta">Flagged on: ${new Date(d.burnoutFlaggedAt).toLocaleDateString()}</p>` : ''}
      <p class="burnout-meta disclaimer-text">Not a medical diagnosis. Consult a professional if needed.</p>
    `;

    // Also update dashboard burnout banner
    if (flagged) {
      document.getElementById('burnout-banner')?.classList.remove('hidden');
    }

    return d;
  } catch (err) {
    el.innerHTML = `<p class="burnout-meta">Could not load: ${err.message}</p>`;
    return null;
  }
}

/* ═══════════════════════════════════════════════
   WEEKLY LINE CHART
══════════════════════════════════════════════ */
async function loadWeeklyCharts() {
  try {
    const res = await api.get('/analytics/weekly');
    const d   = res.data;

    // Update dashboard stats
    const statTotal   = document.getElementById('stat-total');
    const statAvgMood = document.getElementById('stat-avg-mood');
    const statStreak  = document.getElementById('stat-streak');
    if (statTotal)   statTotal.textContent   = d.totalEntries ?? '0';
    if (statStreak)  statStreak.textContent  = (d.streak ?? '0') + 'd';
    if (statAvgMood) {
      const avg = d.averageMoodScore;
      statAvgMood.textContent = avg != null ? (avg >= 0 ? '+' : '') + avg.toFixed(2) : '—';
    }

    // Weekly line chart
    const lineCanvas = document.getElementById('weekly-line-chart');
    const dashCanvas = document.getElementById('dashboard-chart');

    const labels = (d.entries || []).map(e =>
      new Date(e.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
    const scores = (d.entries || []).map(e => e.moodScore);

    const lineData = {
      labels,
      datasets: [{
        label: 'Mood Score',
        data: scores,
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124,58,237,0.12)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: scores.map(s =>
          s > 0.3 ? '#4ade80' : s < -0.3 ? '#f87171' : '#94a3b8'
        ),
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    };

    const lineOptions = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: -1, max: 1, grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { callback: v => v >= 0 ? '+' + v : v } },
        x: { grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    };

    destroyChart(weeklyLineChart);
    if (lineCanvas) {
      weeklyLineChart = new Chart(lineCanvas, { type: 'line', data: lineData, options: lineOptions });
    }

    // Dashboard mini chart
    destroyChart(window._dashChart);
    if (dashCanvas) {
      window._dashChart = new Chart(dashCanvas, {
        type: 'line',
        data: lineData,
        options: { ...lineOptions, plugins: { legend: { display: false } } },
      });
    }

    // Doughnut
    const dist = d.moodDistribution || {};
    const doughnutCanvas = document.getElementById('mood-doughnut-chart');
    destroyChart(moodDoughnutChart);
    if (doughnutCanvas && Object.keys(dist).length) {
      const dLabels = Object.keys(dist);
      const dData   = Object.values(dist);
      moodDoughnutChart = new Chart(doughnutCanvas, {
        type: 'doughnut',
        data: {
          labels: dLabels.map(l => l.replace('_', ' ')),
          datasets: [{
            data: dData,
            backgroundColor: dLabels.map(l => MOOD_COLORS[l] + '99'),
            borderColor:     dLabels.map(l => MOOD_COLORS[l]),
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 12 } } },
          cutout: '60%',
        },
      });
    } else if (doughnutCanvas) {
      doughnutCanvas.parentElement.innerHTML = '<div class="empty-state">No data yet</div>';
    }
  } catch (err) {
    console.warn('Weekly analytics error:', err.message);
  }
}

/* ═══════════════════════════════════════════════
   ALL-TIME BAR CHART
══════════════════════════════════════════════ */
async function loadAllTimeChart() {
  try {
    const res = await api.get('/analytics/all-time');
    const months = res.data.months || [];

    const barCanvas = document.getElementById('alltime-bar-chart');
    destroyChart(alltimeBarChart);
    if (!barCanvas) return;

    if (!months.length) {
      barCanvas.parentElement.innerHTML = '<div class="empty-state">No all-time data yet</div>';
      return;
    }

    const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = months.map(m => `${MONTH_NAMES[m.month]} ${m.year}`);
    const scores = months.map(m => m.averageMoodScore);
    const counts = months.map(m => m.entryCount);

    alltimeBarChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Avg Mood Score',
            data: scores,
            backgroundColor: scores.map(s =>
              s > 0.3 ? 'rgba(74,222,128,0.6)' : s < -0.3 ? 'rgba(248,113,113,0.6)' : 'rgba(148,163,184,0.5)'
            ),
            borderColor: scores.map(s =>
              s > 0.3 ? '#4ade80' : s < -0.3 ? '#f87171' : '#94a3b8'
            ),
            borderWidth: 2, borderRadius: 6,
            yAxisID: 'y',
          },
          {
            label: 'Entry Count',
            data: counts,
            type: 'line',
            borderColor: '#7c3aed',
            backgroundColor: 'rgba(124,58,237,0.1)',
            tension: 0.4, fill: false,
            pointRadius: 4,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 12, padding: 14 } } },
        scales: {
          y:  { min: -1, max: 1, position: 'left',  grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { callback: v => (v >= 0 ? '+' : '') + v } },
          y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { stepSize: 1 } },
          x:  { grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
  } catch (err) {
    console.warn('All-time analytics error:', err.message);
  }
}

/* ═══════════════════════════════════════════════
   DASHBOARD STATS (negativeStreak for stat card)
══════════════════════════════════════════════ */
export async function loadDashboardStats() {
  const burnoutData = await loadBurnoutStatus();
  const negStreak   = document.getElementById('stat-neg-streak');
  if (negStreak && burnoutData) {
    negStreak.textContent = burnoutData.negativeStreak ?? '0';
  }
}

/* ═══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
export async function initAnalytics() {
  await Promise.all([
    loadBurnoutStatus(),
    loadWeeklyCharts(),
    loadAllTimeChart(),
  ]);
}

export { loadWeeklyCharts };
