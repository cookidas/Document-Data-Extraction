if (sessionStorage.getItem('isLoggedIn') !== 'true') {
  location.href = 'index.html';
}
document.getElementById('user-name').textContent =
  sessionStorage.getItem('userName') || '';

let currentTab = 'review';
let pendingFileItems = [];
let isProcessingBatch = false;

// 서버에서 받아온 목록 캐시 (renderList가 갱신)
let cachedApps = [];
let cachedTrash = [];

// ── API 상태 표시 ─────────────────────────────────────────────────
function updateApiStatusPill() {
  const pill = document.getElementById('api-status-pill');
  const ok = !!getSecretKey();
  pill.textContent = ok ? 'API 연결됨' : 'API 미연결';
  pill.className = 'api-status ' + (ok ? 'connected' : 'disconnected');
}
updateApiStatusPill();

// ── 설정 모달 ────────────────────────────────────────────────────
function openSettings() {
  document.getElementById('secret-key-input').value = getSecretKey();
  document.getElementById('settings-modal').classList.remove('hidden');
}
function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}
function saveSettings() {
  setSecretKey(document.getElementById('secret-key-input').value.trim());
  updateApiStatusPill();
  closeSettings();
}
document.getElementById('settings-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('settings-modal')) closeSettings();
});

// ── 파일 업로드 (배치) ───────────────────────────────────────────
function getPagesPerApp() {
  return parseInt(document.getElementById('pages-per-app').value, 10) || 2;
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
}
function handleDragLeave(e) {
  document.getElementById('upload-zone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  if (e.dataTransfer.files.length) setFiles(e.dataTransfer.files);
}
function handleFileSelect(e) {
  if (e.target.files.length) setFiles(e.target.files);
}

async function setFiles(fileList) {
  pendingFileItems = [];
  document.getElementById('upload-zone').classList.remove('has-file');
  document.getElementById('upload-hint').textContent = '⏳ 파일 읽는 중...';
  renderUploadPreview();
  for (const file of Array.from(fileList)) {
    const dataURL = await fileToDataURL(file);
    const base64 = await fileToBase64(file);
    pendingFileItems.push({
      file,
      dataURL,
      base64,
      format: getImageFormat(file),
    });
    renderUploadPreview();
  }
  document.getElementById('upload-zone').classList.add('has-file');
  document.getElementById('upload-hint').textContent = '';
  checkBatchReady();
}

function renderUploadPreview() {
  const listEl = document.getElementById('upload-file-list');
  const countEl = document.getElementById('upload-count-label');
  if (!listEl) return;
  const ppa = getPagesPerApp();
  const total = pendingFileItems.length;
  const pairs = Math.floor(total / ppa);
  countEl.textContent = total > 0 ? `${total}개 선택됨 → ${pairs}쌍` : '';
  listEl.innerHTML = pendingFileItems
    .map((f) => `<div class="upload-file-item">✓ ${f.file.name}</div>`)
    .join('');
}

function checkBatchReady() {
  const ppa = getPagesPerApp();
  const total = pendingFileItems.length;
  const pairs = Math.floor(total / ppa);
  const btn = document.getElementById('ocr-btn');
  const summary = document.getElementById('pair-summary');

  btn.disabled = pairs < 1 || isProcessingBatch;
  btn.textContent = pairs > 0 ? `🔍 ${pairs}쌍 OCR 시작` : '🔍 OCR 시작';

  if (!summary) return;
  if (pairs < 1) {
    summary.textContent = '';
    summary.className = 'pair-summary';
  } else if (total % ppa !== 0) {
    const ignored = total - pairs * ppa;
    summary.textContent = `⚠️ ${total}개는 ${ppa}장으로 나누어 떨어지지 않습니다 — ${pairs}쌍만 처리됩니다 (${ignored}개 무시)`;
    summary.className = 'pair-summary warn';
  } else {
    summary.textContent = `✅ ${pairs}쌍 준비됨`;
    summary.className = 'pair-summary ready';
  }
}

function getImageDimensions(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: null, height: null });
    img.src = dataURL;
  });
}

async function startBatchOCR() {
  const ppa = getPagesPerApp();
  const count = Math.floor(pendingFileItems.length / ppa);
  if (count < 1) return;

  isProcessingBatch = true;
  const btn = document.getElementById('ocr-btn');
  const status = document.getElementById('upload-status');
  btn.disabled = true;
  status.textContent = `⏳ OCR 처리 중... (0 / ${count})`;

  const batchTs = Date.now();
  for (let i = 0; i < count; i++) {
    const pages = pendingFileItems.slice(i * ppa, (i + 1) * ppa);
    await processPair(pages, i, count, batchTs);
    const done = i + 1;
    status.textContent =
      done < count
        ? `⏳ OCR 처리 중... (${done} / ${count})`
        : `✅ ${count}쌍 OCR 완료`;
  }

  isProcessingBatch = false;
  pendingFileItems = [];
  document.getElementById('upload-zone').classList.remove('has-file');
  document.getElementById('upload-file').value = '';
  document.getElementById('upload-hint').textContent =
    '📂 클릭 또는 드래그하여 신청서 이미지 전체 업로드';
  renderUploadPreview();
  checkBatchReady();
  renderList();
}

// 이미지를 최대 1500px, JPEG 0.82로 압축 (전송/저장 용량 절약)
// imageWidth/Height는 원본 크기를 유지해 바운딩박스 좌표 스케일이 자동 보정됨
function compressForStorage(dataURL, maxPx = 1500, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(
        1,
        maxPx / Math.max(img.naturalWidth, img.naturalHeight),
      );
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL('image/jpeg', quality));
    };
    img.src = dataURL;
  });
}

async function processPair(pages, index, total, batchTs) {
  // 파일명 기반 1장/2장 순서 정렬: '1장' → index 0, '2장' → index 1
  if (pages.length === 2) {
    const rank = (name) => {
      if (/1장/.test(name)) return 0;
      if (/2장/.test(name)) return 1;
      return -1;
    };
    if (rank(pages[0].file.name) === 1 && rank(pages[1].file.name) === 0) {
      pages = [pages[1], pages[0]];
    }
  }
  const id = 'APP-' + batchTs + '-' + String(index).padStart(3, '0');
  const now = new Date().toLocaleString('ko-KR', { hour12: false });

  try {
    // 처리 중 상태로 먼저 생성 (목록에 즉시 노출)
    await createApplication({
      id,
      applicantName: `처리 중... (${index + 1}/${total})`,
      status: 'processing',
      source: 'staff',
      uploadedAt: now,
      completedAt: null,
      pages: pages.map((p) => ({
        filename: p.file.name,
        fields: [],
        imageWidth: null,
        imageHeight: null,
      })),
    });
    renderList();

    const templateKeys = Object.keys(CLOVA_TEMPLATE_IDS);
    // 원본 크기 측정 + 압축 병렬 처리
    const [dims, compressedURLs] = await Promise.all([
      Promise.all(pages.map((p) => getImageDimensions(p.dataURL))),
      Promise.all(pages.map((p) => compressForStorage(p.dataURL))),
    ]);

    let fieldSets = pages.map(() => []);
    if (getSecretKey()) {
      const ocrPromises = pages.map((p, pi) => {
        const tmplId = CLOVA_TEMPLATE_IDS[templateKeys[pi]] || null;
        return callClovaOCR(p.base64, p.format, tmplId);
      });
      const results = await Promise.all(ocrPromises);
      fieldSets = results.map((r) => parseOCRResponse(r));
    }

    // 압축 이미지를 서버에 업로드
    await Promise.all(
      compressedURLs.map((url, pi) => uploadPageImage(id, pi, url)),
    );

    const applicantName =
      fieldSets
        .flat()
        .find((f) => f.key === 'name')
        ?.value?.trim() || '이름미상';
    await updateApplication(id, {
      applicantName,
      status: 'review',
      pages: pages.map((p, pi) => ({
        filename: p.file.name,
        fields: fieldSets[pi],
        imageWidth: dims[pi].width, // 원본 크기 유지 (바운딩박스 스케일용)
        imageHeight: dims[pi].height,
      })),
    });
  } catch (err) {
    try {
      await updateApplication(id, { status: 'review', applicantName: '오류' });
    } catch {}
    console.error(`OCR 오류 (${index + 1}/${total}):`, err);
  }
  renderList();
}

// ── 통계 카드 ─────────────────────────────────────────────────────
function renderStats() {
  const apps = cachedApps;
  const now = new Date();
  const todayPrefix = `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`;
  const todayCount = apps.filter((a) =>
    a.uploadedAt?.startsWith(todayPrefix),
  ).length;
  const completedApps = apps.filter((a) => a.status === 'completed');
  const sonanongCount = completedApps.filter(
    (a) => getSonanongResult(a) === 'pass',
  ).length;
  document.getElementById('stat-today').textContent = todayCount;
  document.getElementById('stat-completed').textContent = completedApps.length;
  document.getElementById('stat-sonanong').textContent = sonanongCount;
}

// ── 탭 전환 ──────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document
    .querySelectorAll('.tab')
    .forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('tab-actions-completed').style.display =
    tab === 'completed' ? 'flex' : 'none';
  document.getElementById('tab-actions-trash').style.display =
    tab === 'trash' ? 'flex' : 'none';
  renderList();
}

// ── 신청서 목록 렌더링 ────────────────────────────────────────────
async function renderList() {
  try {
    [cachedApps, cachedTrash] = await Promise.all([
      loadApplications(),
      loadTrash(),
    ]);
  } catch (err) {
    document.getElementById('app-list').innerHTML =
      `<div class="empty-state">⚠️ 서버 연결 실패: ${err.message}</div>`;
    return;
  }

  const apps = cachedApps;
  const trash = cachedTrash;
  const q = (document.getElementById('search-input').value || '')
    .trim()
    .toLowerCase();

  const reviewCount = apps.filter((a) => a.status !== 'completed').length;
  const completedCount = apps.filter((a) => a.status === 'completed').length;
  document.getElementById('count-review').textContent = reviewCount;
  document.getElementById('count-completed').textContent = completedCount;
  document.getElementById('count-trash').textContent = trash.length;

  let items = [];
  let isTrash = false;
  if (currentTab === 'review') {
    items = apps.filter((a) => a.status !== 'completed');
  } else if (currentTab === 'completed') {
    items = apps.filter((a) => a.status === 'completed');
  } else {
    items = trash;
    isTrash = true;
  }

  if (q)
    items = items.filter((a) =>
      (a.applicantName || '').toLowerCase().includes(q),
    );

  const list = document.getElementById('app-list');
  if (items.length === 0) {
    const msg = isTrash
      ? '휴지통이 비어 있습니다.'
      : q
        ? '검색 결과가 없습니다.'
        : '신청서가 없습니다.';
    list.innerHTML = `<div class="empty-state">${msg}</div>`;
    renderStats();
    return;
  }
  list.innerHTML = items.map((a) => buildRow(a, isTrash)).join('');
  renderStats();
}

// 접수경로 배지
function sourceBadgeHTML(app) {
  return app.source === 'citizen'
    ? '<span class="status-badge" style="background:#E6F7EC;color:#1F9D57;">📱 셀프접수</span>'
    : '<span class="status-badge" style="background:var(--gray-100);color:var(--gray-500);">🏢 창구접수</span>';
}

function buildRow(app, isTrash) {
  const name = (app.applicantName || '—') + '_신청서';
  const p1 = app.pages?.[0]?.filename || '';
  const p2 = app.pages?.[1]?.filename || '';

  if (isTrash) {
    return `<div class="app-row">
      <div class="app-row-name">${name}</div>
      <div class="app-row-meta">${app.deletedAt || ''} 삭제됨</div>
      <div class="app-row-actions">
        <button class="btn btn-outline btn-sm" onclick="doRestore('${app.id}')">↩ 복원</button>
        <button class="btn btn-sm btn-trash" onclick="doHardDelete('${app.id}')">영구 삭제</button>
      </div>
    </div>`;
  }

  const statusMap = {
    processing: '<span class="status-badge processing">⏳ 처리 중</span>',
    review: '<span class="status-badge review">🔍 검수 대기</span>',
    completed: '<span class="status-badge completed">✅ 완료</span>',
  };
  const badge = statusMap[app.status] || '';

  // 완료 탭: 소농 판정 뱃지 + 주민번호 마스킹 메타
  let sonanongBadge = '';
  let meta = `${app.uploadedAt} · ${p1}${p2 ? ' + ' + p2 : ''}`;
  if (app.status === 'completed') {
    const result = getSonanongResult(app);
    sonanongBadge =
      result === 'pass'
        ? '<span class="cond-badge pass" style="font-size:11px;margin-left:6px;">소농 해당</span>'
        : result === 'fail'
          ? '<span class="cond-badge fail" style="font-size:11px;margin-left:6px;">소농 미충족</span>'
          : '<span class="cond-badge unknown" style="font-size:11px;margin-left:6px;">판정 불가</span>';

    const maskedId = maskResidentId(getFieldValue(getAppFields(app), 'residentId'));
    meta =
      `완료: ${app.completedAt || app.uploadedAt}` +
      (maskedId ? ` · ${maskedId}` : '');
  }

  const actionBtn =
    app.status === 'processing'
      ? `<button class="btn btn-outline btn-sm" disabled>처리 중...</button>`
      : `<button class="btn btn-primary btn-sm" onclick="openReview('${app.id}')">검수하기 →</button>`;

  return `<div class="app-row">
    <div class="app-row-name">${name} ${badge}${sourceBadgeHTML(app)}${sonanongBadge}</div>
    <div class="app-row-meta">${meta}</div>
    <div class="app-row-actions">
      ${actionBtn}
      <button class="btn btn-sm btn-trash" title="휴지통으로 이동" onclick="doDelete('${app.id}')">🗑️</button>
    </div>
  </div>`;
}

function openReview(id) {
  sessionStorage.setItem('reviewId', id);
  location.href = 'review.html';
}

async function doDelete(id) {
  if (!confirm('이 신청서를 휴지통으로 이동하시겠습니까?')) return;
  await deleteApplication(id);
  renderList();
}

async function doRestore(id) {
  await restoreApplication(id);
  renderList();
}

async function doHardDelete(id) {
  if (!confirm('영구 삭제하면 복원할 수 없습니다. 삭제하시겠습니까?')) return;
  await hardDeleteFromTrash(id); // 서버가 이미지도 함께 정리
  renderList();
}

async function confirmEmptyTrash() {
  if (!cachedTrash.length) {
    alert('휴지통이 이미 비어 있습니다.');
    return;
  }
  if (
    !confirm(`휴지통의 신청서 ${cachedTrash.length}건을 모두 영구 삭제하시겠습니까?`)
  )
    return;
  await emptyTrash();
  renderList();
}

// ── 내보내기 ─────────────────────────────────────────────────────
function getExportRows() {
  return cachedApps
    .filter((a) => a.status === 'completed')
    .map((app) => {
      const fields = getAppFields(app);
      const fv = (key) => getFieldValue(fields, key);
      return {
        신청서ID: app.id,
        접수경로: app.source === 'citizen' ? '셀프접수' : '창구접수',
        신청인: app.applicantName,
        성명: fv('name'),
        주민등록번호: fv('residentId'),
        '계좌번호(은행명)': fv('accountNumber_bankName'),
        주소: fv('address'),
        전화번호: fv('phone'),
        '신청면적(㎡)': fv('appliedArea'),
        '소유면적(㎡)': fv('ownedArea'),
        '영농기간(년)': fv('farmingYears'),
        '거주기간(년)': fv('residenceYears'),
        '소농직불금 판정': getSonanongResult(app) === 'pass' ? '충족' : '미충족',
        완료일시: app.completedAt || '',
      };
    });
}

function exportCSV() {
  const rows = getExportRows();
  if (!rows.length) {
    alert('완료된 신청서가 없습니다.');
    return;
  }
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(','),
    ...rows.map((r) =>
      keys.map((k) => `"${(r[k] || '').replace(/"/g, '""')}"`).join(','),
    ),
  ].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `직불금_완료_${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
}

function exportExcel() {
  const rows = getExportRows();
  if (!rows.length) {
    alert('완료된 신청서가 없습니다.');
    return;
  }
  if (typeof XLSX === 'undefined') {
    alert('Excel 라이브러리가 로드되지 않았습니다.');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '완료목록');
  XLSX.writeFile(
    wb,
    `직불금_완료_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

// ── 로그아웃 ─────────────────────────────────────────────────────
function logout() {
  sessionStorage.clear();
  location.href = 'index.html';
}

// ── 초기화 ───────────────────────────────────────────────────────
renderList();
