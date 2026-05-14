/* ════════════════════════════════════════
   TAREAS — script.js
   ════════════════════════════════════════ */

'use strict';

/* ── Constants ── */
const DAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DAYS_LONG  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MONTHS_ES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const TASKS_KEY  = 'tareas_v2';
const CATS_KEY   = 'tareas_cats_v2';
const NOTIF_KEY  = 'tareas_notif_v2';

const DEFAULT_CATS = [
  { id: 'work',     name: 'trabajo',  color: '#185FA5' },
  { id: 'personal', name: 'personal', color: '#534AB7' },
  { id: 'health',   name: 'salud',    color: '#0F6E56' },
];

/* ── State ── */
let viewYear, viewMonth, selectedKey;

/* ── Utils ── */
function dateKey(d)  { return d.toISOString().slice(0, 10); }
function todayKey()  { return dateKey(new Date()); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function escHtml(s) {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
}

function hex2rgba(hex, a) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ── Storage ── */
function loadTasks()   { try { return JSON.parse(localStorage.getItem(TASKS_KEY))  || {}; } catch { return {}; } }
function saveTasks(t)  { localStorage.setItem(TASKS_KEY,  JSON.stringify(t)); }
function loadCats()    { try { return JSON.parse(localStorage.getItem(CATS_KEY))   || DEFAULT_CATS; } catch { return DEFAULT_CATS; } }
function saveCats(c)   { localStorage.setItem(CATS_KEY,   JSON.stringify(c)); }
function loadNotified(){ try { return JSON.parse(localStorage.getItem(NOTIF_KEY))  || {}; } catch { return {}; } }
function saveNotified(n){ localStorage.setItem(NOTIF_KEY, JSON.stringify(n)); }

/* ══════════════════════════════
   THEME
══════════════════════════════ */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ══════════════════════════════
   SONIDOS (Web Audio API)
══════════════════════════════ */

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playReminderSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    [[0, 880, 0.18], [0.18, 1109, 0.18]].forEach(([start, freq, dur]) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(0.22, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + start); osc.stop(now + start + dur + 0.05);
    });
  } catch (e) { /* Audio no disponible */ }
}

function playCheckSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.08);
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.18);
  } catch (e) { /* ignore */ }
}

function playAddSound() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 528;
    g.gain.setValueAtTime(0.1, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.15);
  } catch (e) { /* ignore */ }
}

/* ══════════════════════════════
   NOTIFICACIONES (toast)
══════════════════════════════ */
function checkNotifBanner() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    document.getElementById('notif-banner').classList.add('show');
  }
}

async function requestNotifPermission() {
  const perm = await Notification.requestPermission();
  document.getElementById('notif-banner').classList.remove('show');
  if (perm === 'granted') {
    showToast('Notificaciones activadas', 'Recibirás recordatorios con sonido.');
  }
}

function showToast(title, body) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<strong>${escHtml(title)}</strong><span>${escHtml(body)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 6000);
}

function checkNotifications() {
  const tasks    = loadTasks();
  const notified = loadNotified();
  const now      = new Date();
  const key      = todayKey();
  const dayTasks = tasks[key] || [];

  dayTasks.forEach((t, i) => {
    if (!t.time || t.done) return;
    const [hh, mm] = t.time.split(':').map(Number);
    const tTime = new Date(); tTime.setHours(hh, mm, 0, 0);
    const diff = tTime - now;
    const nKey = `${key}_${i}_${t.time}_${t.text.slice(0,12)}`;
    if (diff >= 0 && diff <= 60000 && !notified[nKey]) {
      notified[nKey] = true; saveNotified(notified);
      const catName = Array.isArray(t.cats) && t.cats.length ? t.cats.map(c => c.name).join(', ') : '';
      const title   = 'Recordatorio: ' + t.text;
      const body    = t.time + (catName ? ' — ' + catName : '');
      showToast(title, body);
      playReminderSound();
    }
  });
}

/* ══════════════════════════════
   CATEGORIES
══════════════════════════════ */
function getCatById(id) {
  return loadCats().find(c => c.id === id);
}

// Tracks which category IDs are currently selected in the picker
let selectedCatIds = new Set();

function renderCatPicker() {
  const cats = loadCats();
  const list = document.getElementById('cat-picker-list');
  const btn  = document.getElementById('cat-picker-btn');

  // Limpiar ids que ya no existen
  selectedCatIds = new Set([...selectedCatIds].filter(id => cats.find(c => c.id === id)));

  if (!cats.length) {
    list.innerHTML = '<div class="sin-cats">Sin categorías creadas</div>';
  } else {
    list.innerHTML = cats.map(c => {
      const checked = selectedCatIds.has(c.id);
      return `<div class="opcion-cat" data-id="${c.id}">
        <span class="check-cat${checked ? ' marcado' : ''}" style="${checked ? 'background:' + c.color : ''}"></span>
        <span class="punto-cat" style="background:${c.color}"></span>
        <span class="nombre-cat">${escHtml(c.name)}</span>
      </div>`;
    }).join('');

    list.querySelectorAll('.opcion-cat').forEach(item => {
      item.addEventListener('click', () => toggleCatPick(item.dataset.id));
    });
  }

  // Actualizar texto del botón
  const selected = cats.filter(c => selectedCatIds.has(c.id));
  if (selected.length === 0) {
    btn.textContent = 'Categorías';
    btn.classList.remove('con-seleccion');
  } else {
    btn.textContent = selected.map(c => c.name).join(', ');
    btn.classList.add('con-seleccion');
  }
}

function toggleCatPick(id) {
  if (selectedCatIds.has(id)) selectedCatIds.delete(id);
  else selectedCatIds.add(id);
  renderCatPicker();
}

function openCatPicker() {
  const dd  = document.getElementById('cat-picker-dropdown');
  const btn = document.getElementById('cat-picker-btn');
  const isOpen = !dd.hidden;
  dd.hidden = isOpen;
  btn.setAttribute('aria-expanded', String(!isOpen));
  if (!isOpen) renderCatPicker();
}

function closeCatPickerOutside(e) {
  const dd  = document.getElementById('cat-picker-dropdown');
  const btn = document.getElementById('cat-picker-btn');
  if (!dd.hidden && !dd.contains(e.target) && !btn.contains(e.target)) {
    dd.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }
}

function renderCatsList() {
  const cats = loadCats();
  const el   = document.getElementById('cats-list');

  if (!cats.length) {
    el.innerHTML = '<span style="font-size:13px;color:var(--text-faint)">Sin categorías aún.</span>';
    return;
  }

  el.innerHTML = cats.map(c => `
    <div class="chip">
      <span class="chip-punto" style="background:${c.color}"></span>
      <span>${escHtml(c.name)}</span>
      <button class="chip-borrar" data-id="${c.id}" aria-label="Eliminar ${escHtml(c.name)}">×</button>
    </div>`).join('');

  el.querySelectorAll('.chip-borrar').forEach(btn => {
    btn.addEventListener('click', () => deleteCat(btn.dataset.id));
  });
}

function deleteCat(id) {
  saveCats(loadCats().filter(c => c.id !== id));
  selectedCatIds.delete(id);
  renderCatsList();
  renderCatPicker();
  render();
}

function addCat() {
  const nameEl  = document.getElementById('new-cat-name');
  const colorEl = document.getElementById('new-cat-color');
  const name    = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }
  const cats = loadCats();
  cats.push({ id: 'cat_' + Date.now(), name, color: colorEl.value });
  saveCats(cats);
  nameEl.value = '';
  renderCatsList();
  renderCatPicker();
}

/* ══════════════════════════════
   DATE PICKER
══════════════════════════════ */
function initView() {
  const now  = new Date();
  viewYear   = now.getFullYear();
  viewMonth  = now.getMonth();
  selectedKey = todayKey();
}

function buildDateSelects() {
  const sm = document.getElementById('sel-month');
  const sy = document.getElementById('sel-year');

  sm.innerHTML = MONTHS_ES.map((m, i) => `<option value="${i}">${m}</option>`).join('');

  const curYear = new Date().getFullYear();
  for (let y = curYear; y <= curYear + 3; y++) {
    sy.innerHTML += `<option value="${y}">${y}</option>`;
  }
  sm.value = viewMonth;
  sy.value = viewYear;

  sm.addEventListener('change', () => { viewMonth = +sm.value; render(); });
  sy.addEventListener('change', () => { viewYear  = +sy.value; render(); });
}

function buildDowLabels() {
  document.getElementById('dow-labels').innerHTML =
    ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
      .map(d => `<span class="dow-label">${d}</span>`)
      .join('');
}

/* ══════════════════════════════
   CALENDAR GRID
══════════════════════════════ */
function renderCalGrid() {
  const tasks  = loadTasks();
  const grid   = document.getElementById('cal-grid');
  const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
  const todayK = todayKey();

  const first      = new Date(viewYear, viewMonth, 1);
  const startDow   = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  let html = '';

  for (let i = 0; i < startDow; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dt       = new Date(viewYear, viewMonth, d);
    const key      = dateKey(dt);
    const isPast   = dt < todayD;
    const isToday  = key === todayK;
    const isActive = key === selectedKey;
    const hasTasks = (tasks[key] || []).length > 0;

    const classes = ['dia', isPast ? 'past' : '', isToday ? 'today' : '', isActive ? 'active' : '']
      .filter(Boolean).join(' ');
    const dot = hasTasks ? '<span class="cal-dot"></span>' : '';

    html += `<div class="${classes}" data-key="${key}">${d}${dot}</div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.dia:not(.empty):not(.past)').forEach(cell => {
    cell.addEventListener('click', () => {
      selectedKey = cell.dataset.key;
      render();
    });
  });
}

/* ══════════════════════════════
   TASK CRUD
══════════════════════════════ */
function toggleTask(index) {
  const tasks = loadTasks();
  if (!tasks[selectedKey]) return;
  tasks[selectedKey][index].done = !tasks[selectedKey][index].done;
  saveTasks(tasks);
  playCheckSound();
  renderTaskList();
  renderStats();
  renderCalGrid();
}

function deleteTask(index) {
  const tasks = loadTasks();
  if (!tasks[selectedKey]) return;
  tasks[selectedKey].splice(index, 1);
  if (!tasks[selectedKey].length) delete tasks[selectedKey];
  saveTasks(tasks);
  render();
}

function addTask() {
  const textEl = document.getElementById('new-task');
  const timeEl = document.getElementById('new-time');
  const text   = textEl.value.trim();
  if (!text) { textEl.focus(); return; }

  const tasks = loadTasks();
  const cats  = loadCats();
  // Snapshot the selected categories at the moment of creation
  const taskCats = cats
    .filter(c => selectedCatIds.has(c.id))
    .map(c => ({ id: c.id, name: c.name, color: c.color }));

  if (!tasks[selectedKey]) tasks[selectedKey] = [];
  tasks[selectedKey].push({
    text,
    time: timeEl.value || '',
    cats: taskCats,   // array of { id, name, color }
    done: false,
  });

  // Sort by time (tasks without time go last)
  tasks[selectedKey].sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  saveTasks(tasks);
  textEl.value = '';
  timeEl.value = '';
  selectedCatIds.clear();
  renderCatPicker();
  // close picker dropdown
  const dd = document.getElementById('cat-picker-dropdown');
  if (dd) { dd.hidden = true; document.getElementById('cat-picker-btn').setAttribute('aria-expanded', 'false'); }
  textEl.focus();
  playAddSound();
  render();
}

/* ══════════════════════════════
   RENDER
══════════════════════════════ */
function render() {
  // Sync date selects
  document.getElementById('sel-month').value = viewMonth;
  document.getElementById('sel-year').value  = viewYear;

  renderCalGrid();
  renderTaskList();
  renderStats();
}

function renderTaskList() {
  const tasks    = loadTasks();
  const today    = todayKey();
  const dayTasks = tasks[selectedKey] || [];
  const done     = dayTasks.filter(t => t.done).length;
  const total    = dayTasks.length;
  const pct      = total ? Math.round(done / total * 100) : 0;

  // Update progress ring
  const circumference = 2 * Math.PI * 15.9;
  const filled = (pct / 100) * circumference;
  const ring = document.getElementById('ring-fill');
  ring.setAttribute('stroke-dasharray', `${filled.toFixed(1)} ${circumference.toFixed(1)}`);
  document.getElementById('ring-pct').textContent = pct + '%';

  // Update progress bar (mobile)
  document.getElementById('progress-fill').style.width = pct + '%';

  // Day title
  const selD    = new Date(selectedKey + 'T12:00:00');
  const isToday = selectedKey === today;
  const label   = isToday
    ? 'Hoy'
    : capitalize(DAYS_LONG[selD.getDay()]) + ' ' + selD.getDate() + ' de ' + MONTHS_ES[selD.getMonth()];
  document.getElementById('day-title').textContent = label;

  // Task count
  const countEl = document.getElementById('day-count');
  if (!total) {
    countEl.textContent = '';
    countEl.className = 'day-count';
  } else {
    countEl.textContent = done + '/' + total + ' completadas';
    countEl.className = 'day-count' + (done === total ? ' all-done' : '');
  }

  // Task list
  const listEl = document.getElementById('task-list');

  if (!dayTasks.length) {
    listEl.innerHTML = `
      <div class="vacio-msg">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Sin tareas para este día
      </div>`;
    return;
  }

  const nowStr = new Date().toTimeString().slice(0, 5);
  listEl.innerHTML = '';

  dayTasks.forEach((t, i) => {
    const taskCats  = Array.isArray(t.cats) ? t.cats : [];
    const isOverdue = t.time && t.time < nowStr && isToday && !t.done;
    const tagsHtml  = taskCats.map(c =>
      `<span class="tag" style="background:${hex2rgba(c.color, 0.13)};color:${c.color}">${escHtml(c.name)}</span>`
    ).join('');

    const item = document.createElement('div');
    item.className = 'tarea';
    item.innerHTML =
      `<div class="check ${t.done ? 'hecho' : ''}" role="checkbox" aria-checked="${t.done}" tabindex="0"></div>` +
      `<div class="tarea-info">` + // Corregido: Clase coincidente con CSS
        `<div class="tarea-texto ${t.done ? 'hecho' : ''}">${escHtml(t.text)}</div>` + // Corregido: Clase coincidente
        `<div class="tarea-meta">` +
          (t.time ? `<span class="tarea-hora ${isOverdue ? 'vencida' : ''}">${t.time}${isOverdue ? ' · vencida' : ''}</span>` : '') +
          tagsHtml +
        `</div>` +
      `</div>` +
      `<button class="btn-borrar" aria-label="Eliminar tarea">` + // Corregido: Clase para el event listener
        `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>` +
      `</button>`;

    item.querySelector('.check').addEventListener('click', () => toggleTask(i));
    item.querySelector('.check').addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleTask(i); }
    });
    // Corregido: Ahora el selector coincide con la clase del botón creado arriba
    item.querySelector('.btn-borrar').addEventListener('click', () => deleteTask(i));

    listEl.appendChild(item);
  });
}

function renderStats() {
  const tasks   = loadTasks();
  const today   = todayKey();
  const todayT  = tasks[today] || [];
  const now     = new Date();
  const dow     = now.getDay();
  const mon     = addDays(now, -(dow === 0 ? 6 : dow - 1));
  let weekTotal = 0;
  for (let i = 0; i < 7; i++) {
    weekTotal += (tasks[dateKey(addDays(mon, i))] || []).length;
  }
  document.getElementById('stat-done').textContent    = todayT.filter(t => t.done).length;
  document.getElementById('stat-pending').textContent = todayT.filter(t => !t.done).length;
  document.getElementById('stat-week').textContent    = weekTotal;
}

/* ══════════════════════════════
   EVENT LISTENERS
══════════════════════════════ */
document.getElementById('cat-picker-btn').addEventListener('click', openCatPicker);
document.addEventListener('click', closeCatPickerOutside);

document.getElementById('notif-allow-btn').addEventListener('click', requestNotifPermission);

document.getElementById('cats-toggle').addEventListener('click', () => {
  const body   = document.getElementById('cats-body');
  const btn    = document.getElementById('cats-toggle');
  const isOpen = !body.hidden;
  body.hidden  = isOpen;
  btn.textContent = isOpen ? 'Categorías ▾' : 'Categorías ▴';
});

document.getElementById('add-cat-btn').addEventListener('click', addCat);
document.getElementById('new-cat-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') addCat();
});

document.getElementById('add-btn').addEventListener('click', addTask);
document.getElementById('new-task').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

document.getElementById('goto-today').addEventListener('click', () => {
  const now   = new Date();
  viewYear    = now.getFullYear();
  viewMonth   = now.getMonth();
  selectedKey = todayKey();
  render();
});

/* ══════════════════════════════
   BOOT
══════════════════════════════ */
initView();
buildDateSelects();
buildDowLabels();
renderCatPicker();
renderCatsList();
checkNotifBanner();
render();

// Verificar notificaciones cada 30s
setInterval(checkNotifications, 30000);
checkNotifications();
