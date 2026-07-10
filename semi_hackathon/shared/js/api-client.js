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

// ── 마이데이터 조회 (현재 Mock) ──────────────────────────────────
// 실제 연동 확정 시 이 함수 내부만 교체한다 (API 프록시 or 서버사이드 데이터셋 조회).
// 반환 형태: { profileId, label, fields: {name, residentId, address, phone,
//              appliedArea, ownedArea, farmingYears, residenceYears} }

async function fetchMyDataProfile(profileId) {
  const profile = MYDATA_DEMO_PROFILES.find(p => p.profileId === profileId);
  if (!profile) throw new Error('프로필을 찾을 수 없습니다');
  return profile;
}
