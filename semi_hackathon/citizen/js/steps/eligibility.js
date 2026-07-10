// [4] 자격요건 · 소농 체크 · 예상 지원금 · 주의사항
window.STEPS = window.STEPS || {};

// ── 기본 자격 질문 (한 화면 한 질문, "잘 모르겠어요" 포함) ──────
const ELIG_QUESTIONS = [
  {
    id: 'q1', answerKey: 'basicIncomeOk',
    title: '농업 외 종합소득이<br>3,700만원 미만이신가요?',
    sub: '공익직불금 기본 신청 자격을 확인할게요',
    tts: '농업 외 종합소득이 3,700만원 미만이신가요?',
  },
  {
    id: 'q2', answerKey: 'farmingOnLand',
    title: '지급대상 농지에서<br>농업에 종사 중이신가요?',
    sub: '1,000㎡(0.1ha) 이상의 농지 기준이에요',
    tts: '0.1헥타르 이상의 지급대상 농지에서 농업에 종사 중이신가요?',
  },
  {
    id: 'q3', answerKey: 'newFarmerOneYear', onlyIfLandChanged: true,
    title: '1년 이상 지급대상 농지에서<br>경작하셨나요?',
    sub: '신규 신청 시 필요한 요건이에요',
    tts: '1년 이상 지급대상 농지에서 경작하셨나요?',
  },
];

ELIG_QUESTIONS.forEach(q => {
  STEPS[`elig:${q.id}`] = {
    tts: () => q.tts,
    html: () => `
      <div class="tts-row">🔊 음성 안내 중</div>
      <h1 class="h1">${q.title}</h1>
      <p class="sub">${q.sub}</p>
      <div class="stack">
        ${['예', '아니오', '잘 모르겠어요'].map(opt => `
          <button class="opt ${state.answers[q.answerKey] === opt ? 'sel' : ''}"
            onclick="pickAnswer('${q.answerKey}', '${opt}')">${opt}</button>`).join('')}
      </div>
    `,
  };
});

function pickAnswer(key, value) {
  state.answers[key] = value;
  goNext(); // 토스 패턴: 선택 즉시 다음 화면으로
}

// ── 소농 자격 분기 ───────────────────────────────────────────────
STEPS['sonanong:ask'] = {
  tts: () => '소농직불금은 소규모 농가에 정액 130만원을 지급해요. 자격을 살펴볼까요?',
  html: () => `
    <div class="tts-row">🔊 음성 안내 중</div>
    <h1 class="h1">소농 자격도<br>살펴볼까요?</h1>
    <p class="sub">소규모 농가라면 면적과 상관없이 정액 130만원을 받을 수 있어요</p>
    <div class="stack">
      <button class="opt ${state.answers.sonanongAsk === '예' ? 'sel' : ''}"
        onclick="pickAnswer('sonanongAsk', '예')">예, 살펴볼래요</button>
      <button class="opt ${state.answers.sonanongAsk === '아니오' ? 'sel' : ''}"
        onclick="pickAnswer('sonanongAsk', '아니오')">아니요, 넘어갈래요</button>
    </div>
  `,
};

const SONANONG_CHECKS = [
  { key: 'area',      label: '경작면적이 1,000~5,000㎡ 사이예요' },
  { key: 'owned',     label: '가구 전체 소유면적이 1.55ha 미만이에요' },
  { key: 'farming',   label: '영농에 3년 이상 종사했어요' },
  { key: 'residence', label: '농촌에 3년 이상 거주했어요' },
  { key: 'income',    label: '가구 전체 소득이 4,500만원 미만이에요' },
];

STEPS['sonanong:check'] = {
  tts: () => '해당하는 항목에 모두 체크해 주세요.',
  html: () => `
    <div class="tts-row">🔊 음성 안내 중</div>
    <h1 class="h1">소농 자격을<br>확인해볼게요</h1>
    <p class="sub">해당하는 항목에 모두 체크해주세요 (담당자가 서류로 다시 확인해요)</p>
    <div class="stack checklist">
      ${SONANONG_CHECKS.map(c => `
        <button class="opt ${state.answers.checks[c.key] ? 'sel' : ''}" onclick="toggleCheck('${c.key}')">
          <span class="box">${state.answers.checks[c.key] ? '✓' : ''}</span>
          <span>${c.label}</span>
        </button>`).join('')}
    </div>
    <div class="spacer"></div>
    <button class="btn" onclick="goNext()">다음으로</button>
  `,
};

function toggleCheck(key) {
  state.answers.checks[key] = !state.answers.checks[key];
  render();
}

function isSonanongSelfChecked() {
  return state.answers.sonanongAsk === '예' &&
    SONANONG_CHECKS.every(c => state.answers.checks[c.key]);
}

// ── 예상 지원금 ──────────────────────────────────────────────────
STEPS['payment'] = {
  tts: () => '논과 밭 면적을 입력하시면 예상 지원금을 계산해 드려요.',
  html: () => {
    // 신청면적(㎡)이 있으면 논 면적 기본값으로 제안 (ha 환산)
    if (state.paddyHa === '' && state.fieldHa === '') {
      const sqm = parseKoreanNumber(ensureValue('appliedArea').value);
      if (sqm) state.paddyHa = String(Math.round((sqm / 10000) * 100) / 100);
    }
    return `
      <div class="tts-row">🔊 음성 안내 중</div>
      <h1 class="h1">논과 밭 면적을<br>알려주세요</h1>
      <p class="sub">예상 지원금을 계산해드려요 (모르시면 0으로 두세요)</p>
      <div class="biginput">
        <label>논</label>
        <input type="number" inputmode="decimal" min="0" step="0.01" value="${state.paddyHa}"
          placeholder="0" oninput="updateArea('paddyHa', this.value)">
        <span class="unit">ha</span>
      </div>
      <div class="biginput">
        <label>밭</label>
        <input type="number" inputmode="decimal" min="0" step="0.01" value="${state.fieldHa}"
          placeholder="0" oninput="updateArea('fieldHa', this.value)">
        <span class="unit">ha</span>
      </div>
      <div class="bignum" id="payment-result">${paymentResultHTML()}</div>
      <div class="note">실제 지급액은 담당자 검토 후 확정됩니다</div>
      <div class="spacer"></div>
      <button class="btn" onclick="goNext()">다음으로</button>
    `;
  },
};

function updateArea(key, value) {
  state[key] = value;
  const el = document.getElementById('payment-result');
  if (el) el.innerHTML = paymentResultHTML();
}

function paymentResultHTML() {
  const totalHa = (parseFloat(state.paddyHa) || 0) + (parseFloat(state.fieldHa) || 0);
  const result = calcExpectedPayment(totalHa, isSonanongSelfChecked());
  state.expected = result;
  if (!result.amount) {
    return `<div class="cap">면적을 입력하시면 예상 금액이 나와요</div>`;
  }
  const typeLabel = result.type === 'sonanong'
    ? '소농직불금 기준 · 면적직불금보다 유리해요'
    : '면적직불금 기준';
  return `
    <div class="cap">예상 지원금은</div>
    <div class="amt">${result.amount.toLocaleString()}원</div>
    <div class="cap">${typeLabel}</div>
  `;
}

// ── 주의사항 동의 ────────────────────────────────────────────────
STEPS['notice'] = {
  tts: () => '신청 전에 꼭 확인해 주세요.',
  html: () => `
    <div class="tts-row">🔊 음성 안내 중</div>
    <h1 class="h1">꼭 확인해주세요</h1>
    <p class="sub">감액되거나 지급되지 않는 경우가 있어요</p>
    <div class="warnrow"><span class="ic">⚠</span>
      폐경지·묘지·주차장·건축물·채석장·양어장으로 쓰이는 농지는 <b>10% 감액</b>돼요</div>
    <div class="warnrow"><span class="ic">⚠</span>
      농로·농막·간이저온저장고, 농지대장에 없는 임야는 <b>지급되지 않아요</b></div>
    <div class="stack checklist" style="margin-top:8px;">
      <button class="opt ${state.noticeAgreed ? 'sel' : ''}" onclick="toggleNotice()">
        <span class="box">${state.noticeAgreed ? '✓' : ''}</span>
        <span>확인했어요</span>
      </button>
    </div>
    <div class="spacer"></div>
    <button class="btn" onclick="goNext()" ${state.noticeAgreed ? '' : 'disabled'}>다음으로</button>
  `,
};

function toggleNotice() {
  state.noticeAgreed = !state.noticeAgreed;
  render();
}
