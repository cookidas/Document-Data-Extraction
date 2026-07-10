// [2]~[3] 서류 촬영 · 인식 결과 확인
window.STEPS = window.STEPS || {};

// ── 촬영 슬롯 정의 ───────────────────────────────────────────────
const CAPTURE_SLOTS = {
  idCard: {
    title: '신분증을<br>촬영해주세요',
    sub: '성함과 주민등록번호를 확인하는 데 사용해요',
    tts: '신분증을 촬영해 주세요.',
    filename: '신분증 촬영본',
    tmpl: null, // 신분증 전용 OCR 템플릿 없음 — 증빙 이미지로만 보관
  },
  page1: {
    title: '신청서 1장을<br>촬영해주세요',
    sub: '성함·주소·계좌가 적힌 첫 장이에요',
    tts: '직불금 신청서 첫 장을 촬영해 주세요.',
    filename: '신청서 1장 촬영본',
    tmpl: 'page1',
  },
  page2: {
    title: '신청서 2장을<br>촬영해주세요',
    sub: '면적과 영농 기간이 적힌 둘째 장이에요',
    tts: '직불금 신청서 둘째 장을 촬영해 주세요.',
    filename: '신청서 2장 촬영본',
    tmpl: 'page2',
  },
  evidence: {
    title: '증빙서류를<br>촬영해주세요',
    sub: '임대차계약서, 경작사실확인서 등이에요',
    tts: '임대차계약서나 경작사실확인서 등 증빙서류를 촬영해 주세요.',
    filename: '증빙서류 촬영본',
    tmpl: null,
  },
};

Object.keys(CAPTURE_SLOTS).forEach(slot => {
  const cfg = CAPTURE_SLOTS[slot];
  STEPS[`capture:${slot}`] = {
    tts: () => cfg.tts,
    html: () => {
      const photo = state.photos[slot];
      return `
        <div class="tts-row">🔊 음성 안내 중</div>
        <h1 class="h1">${cfg.title}</h1>
        <p class="sub">${cfg.sub}</p>
        <div class="cam-preview" id="cam-preview">
          ${photo ? `<img src="${photo.dataURL}" alt="촬영된 ${cfg.filename}">` : '📷 아직 촬영 전이에요'}
          <div class="cam-loading" id="cam-loading" style="display:none;">🔍 확인하고 있어요...</div>
        </div>
        ${photo
          ? `<button class="btn" onclick="goNext()">다음으로</button>
             <button class="btn ghost" onclick="takePhoto('${slot}', true)">다시 촬영하기</button>`
          : `<button class="btn" onclick="takePhoto('${slot}', true)">📷 촬영하기</button>`}
        <div class="linkrow">
          <button class="link" onclick="takePhoto('${slot}', false)">갤러리에서 선택</button>
          <button class="link" onclick="skipCapture('${slot}')">이 항목 건너뛰기</button>
        </div>
      `;
    },
  };
});

function skipCapture(slot) {
  delete state.photos[slot];
  goNext();
}

function takePhoto(slot, useCamera) {
  requestPhoto(useCamera, async (photo) => {
    state.photos[slot] = photo;
    render(); // 미리보기 표시

    // 신청서 페이지는 기존 CLOVA 템플릿으로 즉시 OCR
    const cfg = CAPTURE_SLOTS[slot];
    if (cfg.tmpl && getSecretKey()) {
      const loading = document.getElementById('cam-loading');
      if (loading) loading.style.display = 'flex';
      try {
        const base64 = photo.dataURL.split(',')[1];
        const res = await callClovaOCR(base64, 'jpeg', CLOVA_TEMPLATE_IDS[cfg.tmpl]);
        state.ocrFields[cfg.tmpl] = parseOCRResponse(res);
        // OCR로 새로 얻은 키는 파생값 캐시 무효화 → 확인 화면에서 새 값 사용
        state.ocrFields[cfg.tmpl].forEach(f => delete state.values[f.key]);
      } catch (err) {
        console.error('OCR 실패:', err);
      }
      render();
    }
  });
}

// ── 인식 결과 확인 화면 ──────────────────────────────────────────
// 값 우선순위: 사용자가 수정한 값 > OCR > 마이데이터 > 빈 값(직접 입력)
function ensureValue(key) {
  if (state.values[key]) return state.values[key];
  let v = null;
  for (const slot of ['page1', 'page2']) {
    const f = (state.ocrFields[slot] || []).find(f => f.key === key);
    if (f) { v = { value: f.value, confidence: f.confidence, boundingPoly: f.boundingPoly, pageSlot: slot }; break; }
  }
  if (!v && state.mydata?.fields[key] != null) {
    v = { value: state.mydata.fields[key], confidence: 1, boundingPoly: null, pageSlot: null };
  }
  if (!v) v = { value: '', confidence: 0, boundingPoly: null, pageSlot: null };
  state.values[key] = v;
  return v;
}

function updateValue(key, value) {
  ensureValue(key).value = value;
}

const CONFIRM_SCREENS = [
  {
    id: 'identity', title: '인식된 정보가<br>맞으신가요?', sub: '다르면 직접 고치거나 다시 촬영해주세요',
    keys: ['name', 'residentId'], retake: 'capture:idCard',
    tts: () => '인식된 성함과 주민등록번호가 맞으신지 확인해 주세요.',
  },
  {
    id: 'phone', title: '전화번호가<br>맞으신가요?', sub: '연락 가능한 번호로 적어주세요',
    keys: ['phone'], retake: null,
    tts: () => '전화번호를 확인해 주세요.',
  },
  {
    id: 'address', title: '주소가<br>맞으신가요?', sub: '주민등록상 주소를 확인해주세요',
    keys: ['address'], retake: null,
    tts: () => '주소를 확인해 주세요.',
  },
  {
    id: 'account', title: '지원금 받으실 계좌가<br>맞으신가요?', sub: '은행명과 계좌번호를 함께 적어주세요',
    keys: ['accountNumber_bankName'], retake: null,
    tts: () => '지원금을 받으실 계좌를 확인해 주세요.',
  },
  {
    id: 'farm', title: '농지 정보가<br>맞으신가요?', sub: '신청서 둘째 장에서 읽어온 값이에요',
    keys: ['appliedArea', 'ownedArea', 'farmingYears', 'residenceYears'], retake: 'capture:page2',
    tts: () => '농지 면적과 영농 기간을 확인해 주세요.',
  },
];

CONFIRM_SCREENS.forEach(cfg => {
  STEPS[`confirm:${cfg.id}`] = {
    tts: cfg.tts,
    html: () => `
      <div class="tts-row">🔊 음성 안내 중</div>
      <h1 class="h1">${cfg.title}</h1>
      <p class="sub">${cfg.sub}</p>
      <div class="stack">
        ${cfg.keys.map(key => {
          const v = ensureValue(key);
          const unit = CONDITIONS[key]?.unit || '';
          return `
            <div class="valuecard">
              <span class="k">${FIELD_LABELS[key] || key}${unit ? ` (${unit})` : ''}</span>
              <input type="text" value="${v.value}" placeholder="직접 입력"
                oninput="updateValue('${key}', this.value)">
            </div>`;
        }).join('')}
      </div>
      <p class="value-hint">값을 누르면 바로 고칠 수 있어요</p>
      <div class="spacer"></div>
      <button class="btn" onclick="goNext()">맞아요</button>
      ${cfg.retake ? `<button class="btn ghost" onclick="goTo('${cfg.retake}')">다시 촬영</button>` : ''}
    `,
  };
});
