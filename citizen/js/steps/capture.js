// 농업경영체 사실확인서 촬영 · 인식 결과 확인 (그룹 화면)
window.STEPS = window.STEPS || {};

// ── 촬영 슬롯 정의 ───────────────────────────────────────────────
const CAPTURE_SLOTS = {
  factSheet1: {
    title: '사실확인서 <b>1쪽</b>을<br>제출해주세요',
    sub: '성함·주소·계좌·영농이력이 적힌 첫 장이에요',
    tts: '농업경영체 사실확인서 첫 장을 촬영하거나 사진을 올려주세요.',
    filename: '농업경영체 사실확인서 1쪽',
    tmpl: 'factSheet1',
  },
  factSheet2: {
    title: '사실확인서 <b>2쪽</b>을<br>제출해주세요',
    sub: '농지 목록이 적힌 둘째 장이에요',
    tts: '농업경영체 사실확인서 둘째 장을 촬영하거나 사진을 올려주세요.',
    filename: '농업경영체 사실확인서 2쪽',
    tmpl: 'factSheet2',
  },
};

Object.keys(CAPTURE_SLOTS).forEach(slot => {
  const cfg = CAPTURE_SLOTS[slot];
  STEPS[`capture:${slot}`] = {
    tts: () => cfg.tts,
    html: () => {
      const photo = state.photos[slot];
      const reading = state.ocrBusy === slot;
      return `
        <div class="tts-row">🔊 음성 안내 중</div>
        <h1 class="h1">${cfg.title}</h1>
        <p class="sub">${cfg.sub}</p>
        <div class="cam-preview" id="cam-preview">
          ${photo ? `<img src="${photo.dataURL}" alt="촬영된 ${cfg.filename}">`
                  : '📷 촬영하거나<br>사진·PDF 파일을 올려주세요'}
          <div class="cam-loading" id="cam-loading" style="display:${reading ? 'flex' : 'none'};">
            📖 정보를 읽고 있어요.<br>잠시만 기다려주세요</div>
        </div>
        ${photo && !reading
          ? `<button class="btn" onclick="goNext()">다음으로</button>
             <button class="btn ghost" onclick="takePhoto('${slot}', true)">다시 촬영하기</button>`
          : `<button class="btn" onclick="takePhoto('${slot}', true)" ${reading ? 'disabled' : ''}>📷 촬영하기</button>`}
        <div class="linkrow">
          <button class="link" onclick="takePhoto('${slot}', false)">앨범/파일에서 올리기</button>
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
  // 사실확인서 PDF(2쪽짜리) 업로드 시 슬롯에 맞는 페이지를 자동 추출
  const pdfPageHint = slot === 'factSheet2' ? 2 : 1;
  requestPhoto(useCamera, async (photo) => {
    state.photos[slot] = photo;
    const cfg = CAPTURE_SLOTS[slot];
    if (cfg.tmpl && getSecretKey()) {
      state.ocrBusy = slot;
      render();
      speak('정보를 읽고 있어요. 잠시만 기다려주세요.');
      try {
        const base64 = photo.dataURL.split(',')[1];
        const res = await callClovaOCR(base64, 'jpeg', CLOVA_TEMPLATE_IDS[cfg.tmpl]);
        state.ocrFields[cfg.tmpl] = parseOCRResponse(res);
        // 새 OCR 결과가 온 키는 파생값 캐시 무효화
        state.ocrFields[cfg.tmpl].forEach(f => delete state.values[f.key]);
        // 농지 합산 파생값도 무효화 (2쪽이 갱신되면 면적 재계산)
        delete state.values.appliedArea;
        delete state.values.ownedArea;
      } catch (err) {
        console.error('OCR 실패:', err);
      }
      state.ocrBusy = null;
    }
    render();
  }, pdfPageHint);
}

// 해당 슬롯에서 OCR로 읽어낸 값이 하나라도 있는가 (건너뛰기/인식실패 문구 분기용)
function hasOcr(slot) {
  return (state.ocrFields[slot] || []).some(f => f.value);
}

// ── 값 접근: 사용자가 수정한 값 > OCR > 필지 합산 파생값 > 빈 값 ──
function ensureValue(key) {
  if (state.values[key]) return state.values[key];
  let v = null;
  for (const slot of ['factSheet1', 'factSheet2']) {
    const f = (state.ocrFields[slot] || []).find(f => f.key === key);
    if (f) { v = { value: f.value, confidence: f.confidence, boundingPoly: f.boundingPoly, pageSlot: slot }; break; }
  }
  // 신청면적/소유면적은 2쪽 농지 표에서 합산해 파생
  if (!v && (key === 'appliedArea' || key === 'ownedArea')) {
    const plots = sumPlots(state.ocrFields.factSheet2 || []);
    const sqm = key === 'appliedArea' ? plots.appliedSqm : plots.ownedSqm;
    if (sqm > 0) {
      // 파생값 신뢰도 = 원천 필지 행들의 최저 신뢰도
      const rowConfs = (state.ocrFields.factSheet2 || [])
        .filter(f => f.key.startsWith('plotArea_'))
        .map(f => f.confidence || 0);
      v = { value: String(sqm), confidence: rowConfs.length ? Math.min(...rowConfs) : 0,
            boundingPoly: null, pageSlot: null, derived: true };
    }
  }
  if (!v) v = { value: '', confidence: 0, boundingPoly: null, pageSlot: null };
  state.values[key] = v;
  return v;
}

function updateValue(key, value) {
  ensureValue(key).value = value;
}

// ── 논/밭 면적 분리 (예상 지원금 계산용) ─────────────────────────
// 필지 표(지목 포함)가 있으면 정확 분리, 없으면 사용자가 확인한 appliedArea 전체를 밭으로 보수 추정
function getAreaSplitHa() {
  const plots = sumPlots(state.ocrFields.factSheet2 || []);
  if (plots.appliedSqm > 0) {
    return { riceHa: plots.riceSqm / 10000, fieldHa: plots.fieldSqm / 10000 };
  }
  const sqm = parseKoreanNumber(ensureValue('appliedArea').value) || 0;
  return { riceHa: 0, fieldHa: sqm / 10000 };
}

// ── 인식 결과 확인 화면 (2~3항목 그룹) ───────────────────────────
const CONFIRM_SCREENS = [
  {
    id: 'identity', srcSlot: 'factSheet1',
    title: '인식된 정보가<br>맞으신가요?', sub: '틀린 곳은 눌러서 바로 고칠 수 있어요',
    tts: '인식된 성함과 주민등록번호, 전화번호가 맞는지 확인해 주세요.',
    manualTitle: '성함과 연락처를<br>알려주세요', manualSub: '서류 제출을 건너뛰셔서 직접 입력이 필요해요',
    manualTts: '성함과 주민등록번호, 전화번호를 입력해 주세요.',
    keys: ['name', 'residentId', 'phone'], retake: 'capture:factSheet1',
  },
  {
    id: 'contact', srcSlot: 'factSheet1',
    title: '주소와 계좌가<br>맞으신가요?', sub: '지원금이 입금될 계좌예요',
    tts: '주소와 지원금 받으실 계좌를 확인해 주세요.',
    manualTitle: '주소와 계좌번호를<br>알려주세요', manualSub: '지원금이 입금될 계좌예요. 직접 적어주세요',
    manualTts: '주소와 지원금 받으실 계좌번호를 입력해 주세요.',
    keys: ['address', 'accountNumber_bankName'], retake: 'capture:factSheet1',
  },
  {
    id: 'farm', srcSlot: 'factSheet2',
    title: '영농 정보가<br>맞으신가요?', sub: '직불금 자격 확인에 쓰이는 정보예요',
    tts: '농촌 거주 기간과 농업 종사 기간, 본인 소유 농지 면적을 확인해 주세요.',
    manualTitle: '영농 정보를<br>알려주세요', manualSub: '직불금 자격 확인에 필요해요. 아는 만큼 적어주세요',
    manualTts: '농촌 거주 기간과 농업 종사 기간, 본인 소유 농지 면적을 입력해 주세요.',
    keys: ['residenceYears', 'farmingYears', 'appliedArea'], retake: 'capture:factSheet2',
  },
];

CONFIRM_SCREENS.forEach(cfg => {
  STEPS[`confirm:${cfg.id}`] = {
    tts: () => hasOcr(cfg.srcSlot) ? cfg.tts : cfg.manualTts,
    html: () => {
      const ocr = hasOcr(cfg.srcSlot);
      return `
      <div class="tts-row">🔊 음성 안내 중</div>
      <h1 class="h1">${ocr ? cfg.title : cfg.manualTitle}</h1>
      <p class="sub">${ocr ? cfg.sub : cfg.manualSub}</p>
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
      <p class="value-hint">${ocr ? '값을 누르면 바로 고칠 수 있어요' : '칸을 눌러 입력해주세요'}</p>
      <div class="spacer"></div>
      <button class="btn" onclick="goNext()">${ocr ? '맞아요' : '입력했어요'}</button>
      <button class="btn ghost" onclick="goTo('${cfg.retake}')">${ocr ? '서류 다시 촬영' : '서류 제출하러 가기'}</button>
    `;
    },
  };
});

// ── 세대원(가족관계) 확인 — 표 하나로 통합 ───────────────────────
STEPS['confirm:family'] = {
  tts: () => hasOcr('factSheet1')
    ? '함께 사는 세대원 정보를 확인해 주세요.'
    : '함께 농사짓는 가족이 있으면 알려주세요. 없으면 그대로 다음으로 넘어가시면 돼요.',
  html: () => {
    const ocr = hasOcr('factSheet1');
    const rows = [];
    for (let i = 1; i <= 8; i++) {
      const rel = ensureValue(`famRel_L${i}`).value;
      const nm  = ensureValue(`famName_L${i}`).value;
      const rid = ensureValue(`famId_L${i}`).value;
      if (rel || nm || rid) rows.push(i);
    }
    // 직접 입력 모드(서류 건너뜀)에서는 빈 입력 행 2개 제공
    if (!ocr && rows.length < 2) {
      for (let i = 1; rows.length < 2 && i <= 8; i++) {
        if (!rows.includes(i)) rows.push(i);
      }
      rows.sort((a, b) => a - b);
    }
    const table = rows.length
      ? `<div class="fam-grid">
          <div class="fam-head">관계</div><div class="fam-head">성명</div><div class="fam-head">주민등록번호</div>
          ${rows.map((i, rowIdx) => ['famRel_L', 'famName_L', 'famId_L'].map(prefix => {
            const key = `${prefix}${i}`;
            const relExamples = ['예: 배우자', '예: 아들', '예: 딸'];
            const ph = prefix === 'famRel_L' ? (relExamples[rowIdx] || '관계') : '';
            return `<input class="fam-cell" type="text" value="${ensureValue(key).value}"
              placeholder="${ph}" oninput="updateValue('${key}', this.value)">`;
          }).join('')).join('')}
        </div>
        <p class="value-hint">${ocr ? '칸을 누르면 바로 고칠 수 있어요' : '없으면 비워두고 넘어가셔도 돼요'}</p>`
      : `<div class="note">등록된 세대원 정보가 없어요.<br>혼자 경영하시는 경우 그대로 진행하시면 돼요.</div>`;
    return `
      <div class="tts-row">🔊 음성 안내 중</div>
      <h1 class="h1">${ocr ? '함께 사는 가족<br>정보가 맞으신가요?' : '함께 농사짓는 가족이<br>있으신가요?'}</h1>
      <p class="sub">${ocr ? "사실확인서의 '경영주 외의 농업인' 정보예요" : '있다면 관계·성함·주민번호를 적어주세요'}</p>
      ${table}
      <div class="spacer"></div>
      <button class="btn" onclick="goNext()">${ocr ? '맞아요' : '다음으로'}</button>
      <button class="btn ghost" onclick="goTo('capture:factSheet1')">${ocr ? '서류 다시 촬영' : '서류 제출하러 가기'}</button>
    `;
  },
};
