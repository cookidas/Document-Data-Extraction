// 스토리지 키 (v3: pages 배열 구조)
const STORAGE_KEY = 'hackathon_apps_v3';
const TRASH_KEY   = 'hackathon_trash_v3';

// ── 신청서 CRUD ──────────────────────────────────────────────────

function loadApplications() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveApplications(apps) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

function getApplication(id) {
  return loadApplications().find(a => a.id === id) || null;
}

function updateApplication(id, updates) {
  const apps = loadApplications();
  const i = apps.findIndex(a => a.id === id);
  if (i < 0) return;
  apps[i] = { ...apps[i], ...updates };
  saveApplications(apps);
}

// ── 휴지통 ───────────────────────────────────────────────────────

function loadTrash() {
  try { return JSON.parse(localStorage.getItem(TRASH_KEY)) || []; }
  catch { return []; }
}

function saveTrash(items) {
  localStorage.setItem(TRASH_KEY, JSON.stringify(items));
}

// 신청서 → 휴지통으로 이동
function deleteApplication(id) {
  const apps = loadApplications();
  const app  = apps.find(a => a.id === id);
  if (!app) return;
  saveApplications(apps.filter(a => a.id !== id));
  const trash = loadTrash();
  trash.unshift({ ...app, deletedAt: new Date().toLocaleString('ko-KR', { hour12: false }) });
  saveTrash(trash);
}

// 휴지통 → 신청서 목록으로 복원
function restoreApplication(id) {
  const trash = loadTrash();
  const app   = trash.find(a => a.id === id);
  if (!app) return;
  saveTrash(trash.filter(a => a.id !== id));
  const { deletedAt, ...restored } = app;
  const apps = loadApplications();
  apps.unshift(restored);
  saveApplications(apps);
}

// 휴지통 완전 비우기
function emptyTrash() { saveTrash([]); }

// 휴지통에서 단일 항목 영구 삭제
function hardDeleteFromTrash(id) {
  saveTrash(loadTrash().filter(a => a.id !== id));
}

// ── 헬퍼 ─────────────────────────────────────────────────────────

function getFieldValue(fields, key) {
  const f = (fields || []).find(f => f.key === key);
  return f?.value || '';
}

function getConfidenceClass(conf) {
  if (!conf || conf === 0) return 'unknown';
  if (conf >= 0.9) return 'high';
  if (conf >= 0.8) return 'mid';
  return 'low';
}

function getConfidenceLabel(conf) {
  if (!conf || conf === 0) return '';
  if (conf >= 0.9) return '자동 인식';
  if (conf >= 0.8) return '확인 권장';
  return '필수 확인';
}

function needsCheck(conf) {
  return conf > 0 && conf < 0.9;
}
