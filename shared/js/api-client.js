// 서버 API 클라이언트 (구 mock-data.js의 localStorage 저장을 대체)
// 모든 함수는 비동기 — 신청자 폰과 담당자 PC가 서버 DB를 공유한다.

async function _api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API 오류 ${res.status}`);
  }
  return res.json();
}

// ── 신청서 CRUD ──────────────────────────────────────────────────

function loadApplications() {
  return _api('/api/applications');
}

function getApplication(id) {
  return _api(`/api/applications/${id}`);
}

function createApplication(app) {
  return _api('/api/applications', { method: 'POST', body: JSON.stringify(app) });
}

function updateApplication(id, updates) {
  return _api(`/api/applications/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
}

// ── 휴지통 ───────────────────────────────────────────────────────

function deleteApplication(id) {
  return _api(`/api/applications/${id}`, { method: 'DELETE' });
}

function loadTrash() {
  return _api('/api/trash');
}

function restoreApplication(id) {
  return _api(`/api/trash/${id}/restore`, { method: 'POST' });
}

function hardDeleteFromTrash(id) {
  return _api(`/api/trash/${id}`, { method: 'DELETE' });
}

function emptyTrash() {
  return _api('/api/trash', { method: 'DELETE' });
}

// ── 페이지 이미지 ────────────────────────────────────────────────

function uploadPageImage(appId, pageIndex, dataURL) {
  return _api(`/api/applications/${appId}/pages/${pageIndex}/image`, {
    method: 'POST',
    body: JSON.stringify({ dataURL }),
  });
}

function pageImageUrl(appId, pageIndex) {
  return `/api/applications/${appId}/pages/${pageIndex}/image`;
}

// ── 재신청자 이전 신청서 조회 ────────────────────────────────────
// PASS 본인인증 시 입력한 주민번호로 가장 최근 완료 신청서를 찾는다.
// 없으면 null 반환 (404를 예외로 던지지 않음 — 흐름 분기용)

async function lookupPreviousApplication(residentId) {
  const res = await fetch(`/api/applications/lookup?residentId=${encodeURIComponent(residentId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
  return res.json();
}
