if (sessionStorage.getItem('isLoggedIn') !== 'true') {
  location.href = 'index.html';
}

const appId = sessionStorage.getItem('reviewId');
if (!appId) location.href = 'dashboard.html';

let app = null; // init()에서 서버 조회

// ── 페이지 네비게이션 (0 = 1장, 1 = 2장) ─────────────────────────
let currentPageIndex = 0;
let pageCount = 1;
let offCanvases = [];

// ── 캔버스 설정 (크롭 툴팁용 오프스크린, 페이지별) ───────────────
const canvas  = document.getElementById('form-canvas');
const formImg = document.getElementById('form-img');

function loadOffscreenPage(pageIndex) {
  if (pageIndex >= pageCount) return;
  const img = new Image();
  img.onload = () => {
    const oc = offCanvases[pageIndex];
    oc.canvas.width  = img.naturalWidth;
    oc.canvas.height = img.naturalHeight;
    oc.ctx.drawImage(img, 0, 0);
    oc.loaded = true;
  };
  img.src = pageImageUrl(app.id, pageIndex);
}

function changePage(pageIndex) {
  if (pageIndex < 0 || pageIndex >= pageCount) return;
  currentPageIndex = pageIndex;
  const page = app.pages?.[pageIndex];

  formImg.style.display = 'none';
  formImg.onload  = () => { formImg.style.display = 'block'; };
  formImg.onerror = () => { formImg.style.display = 'none'; }; // 이미지 없는 페이지(셀프접수 입력값 등)
  formImg.src = pageImageUrl(app.id, pageIndex);
  canvas.style.display = 'none';

  document.getElementById('filename-label').textContent = page?.filename || '';
  document.getElementById('page-indicator').textContent = `${pageIndex + 1} / ${pageCount}`;
  document.getElementById('btn-prev-page').classList.toggle('active', pageIndex === 0);
  document.getElementById('btn-next-page').classList.toggle('active', pageIndex === pageCount - 1);
}

function initDisplay() {
  for (let i = 0; i < pageCount; i++) loadOffscreenPage(i);
  changePage(0);
}

// ── 크롭 툴팁 ────────────────────────────────────────────────────
const tooltip      = document.getElementById('crop-tooltip');
const tooltipCanvas = document.getElementById('tooltip-canvas');
const tCtx         = tooltipCanvas.getContext('2d');

function getBboxOnCanvas(field, pageIndex) {
  const page = app.pages?.[pageIndex];
  if (!page) return null;
  if (field.boundingPoly?.vertices && page.imageWidth && page.imageHeight) {
    const v  = field.boundingPoly.vertices;
    const oc = offCanvases[pageIndex];
    const sx = oc.canvas.width  / page.imageWidth;
    const sy = oc.canvas.height / page.imageHeight;
    return {
      x: v[0].x * sx,
      y: v[0].y * sy,
      w: (v[1].x - v[0].x) * sx,
      h: (v[2].y - v[0].y) * sy,
    };
  }
  return null;
}

function showTooltip(field, pageIndex, e) {
  const oc   = offCanvases[pageIndex];
  if (!oc?.loaded) return;
  const bbox = getBboxOnCanvas(field, pageIndex);
  if (!bbox) return;

  const pad = 18;
  const sx  = Math.max(0, bbox.x - pad);
  const sy  = Math.max(0, bbox.y - pad);
  const sw  = Math.min(oc.canvas.width  - sx, bbox.w + pad * 2);
  const sh  = Math.min(oc.canvas.height - sy, bbox.h + pad * 2);
  const scale = 2.5;

  tooltipCanvas.width  = sw * scale;
  tooltipCanvas.height = sh * scale;
  tCtx.fillStyle = '#fff';
  tCtx.fillRect(0, 0, tooltipCanvas.width, tooltipCanvas.height);
  tCtx.drawImage(oc.canvas, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);
  tCtx.strokeStyle = '#E74C3C';
  tCtx.lineWidth   = 2;
  tCtx.strokeRect((bbox.x - sx) * scale, (bbox.y - sy) * scale, bbox.w * scale, bbox.h * scale);

  tooltip.style.display = 'block';
  moveTooltip(e);
}

function moveTooltip(e) {
  const tw = tooltip.offsetWidth  || 320;
  const th = tooltip.offsetHeight || 120;
  let left = e.clientX + 20;
  let top  = e.clientY - th / 2;
  if (left + tw > window.innerWidth  - 10) left = e.clientX - tw - 20;
  if (top < 10)                             top  = 10;
  if (top + th > window.innerHeight - 10)  top  = window.innerHeight - th - 10;
  tooltip.style.left = left + 'px';
  tooltip.style.top  = top  + 'px';
}

function hideTooltip() { tooltip.style.display = 'none'; }

// ── 유효성 검사 ──────────────────────────────────────────────────
const VALIDATORS = {
  residentId: {
    fn: v => {
      const clean = v.replace(/\s/g, '');
      // 마이데이터 마스킹값(551010-1******)도 허용
      if (/^\d{6}-\d\*{6}$/.test(clean)) return true;
      if (!/^\d{6}-\d{7}$/.test(clean)) return false;
      const mm = parseInt(clean.slice(2, 4), 10);
      const dd = parseInt(clean.slice(4, 6), 10);
      return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
    },
    msg: '주민번호 오류: 앞 6자리-뒤 7자리 형식, 월(01~12)·일(01~31) 범위 확인',
  },
  phone: {
    fn:  v => /^0\d{1,2}-\d{3,4}-\d{4}$/.test(v.replace(/\s/g, '')),
    msg: '010-XXXX-XXXX 형식으로 입력하세요',
  },
  accountNumber_bankName: {
    fn:  v => v.trim().length >= 5,
    msg: '계좌번호와 은행명을 입력하세요',
  },
};

function validate(key) {
  const input = document.getElementById(`field-${key}`);
  const errEl = document.getElementById(`err-${key}`);
  if (!input || !errEl) return true;
  const rule = VALIDATORS[key];
  if (!rule) return true;
  const valid = rule.fn(input.value);
  errEl.textContent = valid ? '' : rule.msg;
  errEl.classList.toggle('visible', !valid);
  input.classList.toggle('input-error', !valid);
  updateSaveButton();
  return valid;
}

// ── 저장 버튼 활성화 ─────────────────────────────────────────────
function updateSaveButton() {
  const saveBtn = document.getElementById('save-btn');
  const hint    = document.getElementById('save-hint');

  const unchecked = Array.from(document.querySelectorAll('#form-scroll input[type="checkbox"]'))
    .filter(chk => !chk.checked);
  const hasError = !!document.querySelector('#form-scroll .field-error.visible');

  const canSave = unchecked.length === 0 && !hasError;
  saveBtn.disabled = !canSave;
  if (unchecked.length > 0)  hint.textContent = `확인 체크 필요 ${unchecked.length}개 남음`;
  else if (hasError)          hint.textContent = '형식 오류를 수정해주세요';
  else                        hint.textContent = '모든 항목 확인 완료 ✓';
}

function onCheckChange() { updateSaveButton(); }

// ── 소농 최종 판정 요약 배너 업데이트 ────────────────────────────
function updateCondSummary() {
  const el = document.getElementById('sonanong-summary');
  if (!el) return;
  const condKeys = ['appliedArea', 'ownedArea', 'farmingYears', 'residenceYears'];
  const results  = condKeys.map(key => {
    const input = document.getElementById(`field-${key}`);
    return evaluateCondition(key, input?.value || '');
  });
  const incomeFail = app.meta?.answers?.householdIncomeOk === '미충족';
  if (!incomeFail && results.every(r => r?.status === 'pass')) {
    el.className = 'sonanong-summary pass';
    el.textContent = '✅ 소농직불금 지급 요건 충족';
  } else if (incomeFail || results.some(r => r?.status === 'fail')) {
    el.className = 'sonanong-summary fail';
    el.textContent = '❌ 소농직불금 지급 요건 미충족';
  } else {
    el.className = 'sonanong-summary unknown';
    el.textContent = '? 판정 불가 — 값을 확인하세요';
  }
}

// ── 소농 조건 배지 ───────────────────────────────────────────────
function condBadgeHTML(key, value) {
  const result = evaluateCondition(key, value);
  if (!result)                      return '<span class="cond-badge unknown">—</span>';
  if (result.status === 'pass')     return `<span class="cond-badge pass">✅ 해당 (${result.val?.toLocaleString()})</span>`;
  if (result.status === 'fail')     return `<span class="cond-badge fail">❌ 미해당 (${result.val?.toLocaleString()})</span>`;
  return '<span class="cond-badge unknown">? 판독불가</span>';
}

// ── 셀프접수 자기신고 배너 ───────────────────────────────────────
function selfReportHTML() {
  if (app.source !== 'citizen' || !app.meta) return '';
  const a = app.meta.answers || {};
  const items = [];
  if (a.basicIncomeOk)     items.push(`농업 외 종합소득 3,700만원 미만: <b>${a.basicIncomeOk}</b>`);
  if (a.farmingOnLand)     items.push(`0.1ha 이상 농지 영농 종사: <b>${a.farmingOnLand}</b>`);
  if (a.householdIncomeOk) items.push(`가구 종합소득 4,500만원 미만: <b>${a.householdIncomeOk}</b>`);
  if (app.meta.landChanged != null)
    items.push(`농지 변동/신규·관외경작: <b>${app.meta.landChanged ? '있음 — 방문 확인 필요' : '없음'}</b>`);
  if (app.meta.expectedPayment)
    items.push(`신청 시 안내된 예상 지원금: <b>${app.meta.expectedPayment.toLocaleString()}원</b>`);
  if (!items.length) return '';
  return `
    <div class="form-section">
      <div class="form-section-title">📱 셀프접수 자기신고 응답 (참고용 — 실제 판정은 아래 실측값 기준)</div>
      <ul style="font-size:12px;color:var(--gray-600);line-height:2;padding-left:18px;margin:4px 0;">
        ${items.map(i => `<li>${i}</li>`).join('')}
      </ul>
    </div>`;
}

// ── 폼 렌더링 ────────────────────────────────────────────────────
function renderReviewForm() {
  const scroll  = document.getElementById('form-scroll');
  const allFields = (app.pages || []).flatMap((page, pi) =>
    (page.fields || []).map(f => ({ ...f, pageIndex: pi }))
  );
  const fieldMap  = {};
  allFields.forEach(f => fieldMap[f.key] = f);

  // ① 신청인 기본 정보 (name 포함)
  const basicKeys = ['name', 'residentId', 'accountNumber_bankName', 'address', 'phone'];
  const basicHTML = basicKeys.map(key => {
    const f = fieldMap[key];
    if (!f) return '';
    return renderField(f);
  }).join('');

  // ④ 가족관계 (값 있는 행만)
  const famRows = [];
  for (let i = 1; i <= 8; i++) {
    const rel = fieldMap[`famRel_L${i}`];
    const nm  = fieldMap[`famName_L${i}`];
    const rid = fieldMap[`famId_L${i}`];
    if (rel?.value || nm?.value || rid?.value) famRows.push({ i, rel, nm, rid });
  }

  const famNeedsCheck = famRows.some(r =>
    [r.rel, r.nm, r.rid].some(f => f && f.confidence < 0.9)
  );

  const famHTML = famRows.length > 0
    ? `<table class="fam-table">
        <thead><tr><th style="width:80px">관계</th><th style="width:120px">성명</th><th>주민등록번호</th></tr></thead>
        <tbody>
          ${famRows.map(r => {
            const flds = [
              { f: r.rel, key: `famRel_L${r.i}` },
              { f: r.nm,  key: `famName_L${r.i}` },
              { f: r.rid, key: `famId_L${r.i}` },
            ];
            return `<tr>
              ${flds.map(({ f, key }) => {
                const fCls = f ? getConfidenceClass(f.confidence) : '';
                const bgStyle = fCls === 'high' ? 'background:var(--success-light)' :
                                fCls === 'mid'  ? 'background:var(--warning-light)' :
                                fCls === 'low'  ? 'background:var(--danger-light)' : '';
                const pct = f?.confidence > 0 ? Math.round(f.confidence * 100) + '%' : '';
                return `<td style="${bgStyle}" title="${pct}">
                  <input class="fam-input" id="field-${key}" type="text"
                    value="${f?.value || ''}" data-key="${key}" autocomplete="off">
                </td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div class="field-error" id="fam-error"></div>
      ${famNeedsCheck ? `
        <div class="review-field-check" style="margin-top:8px;">
          <input type="checkbox" id="chk-fam" onchange="onCheckChange()">
          <label for="chk-fam">가족관계 정보를 원본과 대조하여 확인했습니다</label>
        </div>` : ''}`
    : '<p style="font-size:12px;color:var(--gray-400);padding:8px 0;">작성된 가족관계 정보가 없습니다 (소농직접지불금 비신청)</p>';

  // 소농 지급요건 (2장 필드)
  const condKeys = ['appliedArea', 'ownedArea', 'farmingYears', 'residenceYears'];
  const condHTML = condKeys.map(key => {
    const f    = fieldMap[key];
    const cond = CONDITIONS[key];
    const val  = f?.value || '';

    // confidence=0이지만 필드 존재 시(bbox 있음) → 판독불가(low)로 강제 표시
    let cls = '', pctLabel = null;
    if (f) {
      if (f.confidence > 0) {
        cls = getConfidenceClass(f.confidence);
        pctLabel = Math.round(f.confidence * 100) + '%';
      } else {
        cls = 'low';
        pctLabel = '??';
      }
    }
    // 필드 존재 + (낮은 신뢰도 or 값 없음) → 체크박스 필수
    const requireCheck = f && (cls === 'low' || cls === 'mid' || !val);

    return `
      <div class="cond-row">
        <div class="cond-label">
          <div style="font-weight:600;font-size:12px;">${cond.label}</div>
          <div style="font-size:11px;color:var(--gray-400);">${cond.desc}</div>
        </div>
        <div class="cond-input-wrap">
          ${pctLabel ? `<span class="confidence-badge ${cls}" style="font-size:10px;">${pctLabel}</span>` : ''}
          <input class="form-input${cls ? ' confidence-' + cls : ''}" id="field-${key}"
            type="text" value="${val}" data-key="${key}"
            style="width:110px;text-align:right;padding:6px 8px;" autocomplete="off"
            placeholder="${f && !val ? '판독불가' : ''}">
          <span style="font-size:11px;color:var(--gray-400);">${cond.unit}</span>
        </div>
        <div id="cond-badge-wrap-${key}">${condBadgeHTML(key, val)}</div>
      </div>
      <div class="field-error" id="err-${key}"></div>
      ${requireCheck ? `
        <div class="review-field-check" style="margin-bottom:10px;margin-left:4px;">
          <input type="checkbox" id="chk-${key}" data-key="${key}" onchange="onCheckChange()">
          <label for="chk-${key}">원본 이미지와 대조 확인 완료</label>
        </div>` : ''}
    `;
  }).join('');

  const hasCond = condKeys.some(k => fieldMap[k]);

  scroll.innerHTML = `
    ${selfReportHTML()}
    <div class="form-section">
      <div class="form-section-title">① 신청인 기본 정보</div>
      ${basicHTML || '<p style="font-size:12px;color:var(--gray-400);">1장 OCR 결과가 없습니다.</p>'}
    </div>
    <div class="form-section">
      <div class="form-section-title">④ 가족관계 인적정보</div>
      ${famHTML}
    </div>
    <div class="form-section">
      <div class="form-section-title">소농 지급요건 자동 판정</div>
      ${hasCond ? condHTML : '<p style="font-size:12px;color:var(--gray-400);">2장 OCR 결과가 없습니다.</p>'}
      ${hasCond ? `<div id="sonanong-summary" class="sonanong-summary unknown">? 판정 불가 — 값을 확인하세요</div>` : ''}
      ${hasCond ? `<div class="cond-notice">⚠️ 위 판정은 OCR 인식 숫자 기준입니다. 신청서 원본의 체크박스 표시와 반드시 대조 확인하세요.</div>` : ''}
    </div>
  `;

  // 이벤트 연결
  allFields.forEach(f => {
    const input = document.getElementById(`field-${f.key}`);
    if (!input) return;
    input.addEventListener('blur',       () => validate(f.key));
    input.addEventListener('mouseenter', e  => showTooltip(f, f.pageIndex, e));
    input.addEventListener('mousemove',  e  => moveTooltip(e));
    input.addEventListener('mouseleave', ()  => hideTooltip());

    if (CONDITIONS[f.key]) {
      input.addEventListener('input', () => {
        const wrap = document.getElementById(`cond-badge-wrap-${f.key}`);
        if (wrap) wrap.innerHTML = condBadgeHTML(f.key, input.value);
        updateCondSummary();
      });
    }
  });

  // OCR 미추출 condKey 필드에만 추가 리스너 등록 (allFields 루프에서 이미 등록된 경우 제외)
  condKeys.forEach(key => {
    if (fieldMap[key]) return;
    const input = document.getElementById(`field-${key}`);
    if (!input) return;
    input.addEventListener('input', () => {
      const wrap = document.getElementById(`cond-badge-wrap-${key}`);
      if (wrap) wrap.innerHTML = condBadgeHTML(key, input.value);
      updateCondSummary();
    });
  });

  // OCR로 채워진 값에도 즉시 유효성 검사 + 소농 판정 배너 적용
  Object.keys(VALIDATORS).forEach(key => validate(key));
  updateCondSummary();
  updateSaveButton();
}

// 단일 필드 HTML
function renderField(f) {
  const cls = getConfidenceClass(f.confidence);
  const pct = Math.round(f.confidence * 100);
  const chk = needsCheck(f.confidence);
  return `
    <div class="review-field" data-key="${f.key}">
      <div class="review-field-label">
        <span class="label-text">${f.label || FIELD_LABELS[f.key] || f.key}</span>
        ${f.confidence > 0 ? `<span class="confidence-badge ${cls}">${pct}% · ${getConfidenceLabel(f.confidence)}</span>` : ''}
      </div>
      <input class="form-input confidence-${cls}" id="field-${f.key}"
        type="text" value="${f.value}" data-key="${f.key}" autocomplete="off">
      <div class="field-error" id="err-${f.key}"></div>
      ${chk ? `
        <div class="review-field-check">
          <input type="checkbox" id="chk-${f.key}" data-key="${f.key}" onchange="onCheckChange()">
          <label for="chk-${f.key}">원본 이미지와 대조하여 확인했습니다</label>
        </div>` : ''}
    </div>
  `;
}

// ── 저장 ─────────────────────────────────────────────────────────
async function saveApplication() {
  const updatedPages = app.pages.map((page) => ({
    ...page,
    fields: page.fields.map(f => {
      const input = document.getElementById(`field-${f.key}`);
      return { ...f, value: input ? input.value : f.value };
    }),
  }));

  // 수정된 이름을 applicantName에도 반영
  const nameInput = document.getElementById('field-name');
  const applicantName = nameInput?.value?.trim() || app.applicantName;

  await updateApplication(app.id, {
    status: 'completed',
    applicantName,
    completedAt: new Date().toLocaleString('ko-KR', { hour12: false }),
    pages: updatedPages,
  });

  const apps = await loadApplications();
  const next = apps.find(a => a.status === 'review' && a.id !== app.id);
  if (next) {
    sessionStorage.setItem('reviewId', next.id);
    location.reload();
  } else {
    alert('✅ 저장 완료!\n더 이상 검수 대기 중인 신청서가 없습니다.\n대시보드로 이동합니다.');
    location.href = 'dashboard.html';
  }
}

async function skipApplication() {
  const apps = await loadApplications();
  const next = apps.find(a => a.status === 'review' && a.id !== app.id);
  if (next) { sessionStorage.setItem('reviewId', next.id); location.reload(); }
  else location.href = 'dashboard.html';
}

// ── 키보드 단축키 ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    const btn = document.getElementById('save-btn');
    if (!btn.disabled) saveApplication();
  }
  if (e.code === 'Space' && document.activeElement.matches('input[type="text"]')) {
    const key = document.activeElement.dataset.key;
    if (key) {
      const chk = document.getElementById(`chk-${key}`);
      if (chk) { e.preventDefault(); chk.checked = !chk.checked; onCheckChange(); }
    }
  }
});

// ── 초기화 ───────────────────────────────────────────────────────
async function init() {
  try {
    app = await getApplication(appId);
  } catch {
    location.href = 'dashboard.html';
    return;
  }

  pageCount = app.pages?.length || 1;
  offCanvases = Array.from({ length: pageCount }, () => {
    const c = document.createElement('canvas');
    return { canvas: c, ctx: c.getContext('2d'), loaded: false };
  });

  document.getElementById('top-app-id').textContent = `${app.applicantName || app.id}_신청서`;
  document.getElementById('app-meta').textContent   = `${app.id} · 업로드: ${app.uploadedAt}`;

  initDisplay();
  renderReviewForm();
}

init();
