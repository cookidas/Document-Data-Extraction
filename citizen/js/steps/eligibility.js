// 자격요건(가구소득 자기신고) · 예상 지원금 비교 · 주의사항
window.STEPS = window.STEPS || {};

// ── 가구 종합소득 자기신고 (유일하게 서류로 확인 불가한 조건) ────
STEPS['elig:income'] = {
  tts: () => '가구 전체의 농업 외 소득이 4,500만원보다 적으신가요?',
  html: () => `
    <div class="tts-row">🔊 음성 안내 중</div>
    <h1 class="h1">가구 전체 소득이<br>4,500만원 미만인가요?</h1>
    <p class="sub">농사 외 소득 기준이에요. 소농직불금 자격 확인에 필요해요</p>
    <div class="stack">
      ${['예', '아니오', '잘 모르겠어요'].map(opt => `
        <button class="opt ${state.answers.householdIncomeOk === opt ? 'sel' : ''}"
          onclick="pickIncomeAnswer('${opt}')">${opt}</button>`).join('')}
    </div>
  `,
};

function pickIncomeAnswer(value) {
  state.answers.householdIncomeOk = value;
  goNext();
}

// ── 소농 자격 자동 판정 (자기신고 아님 — OCR/확인된 실측값 기준) ──
function isSonanongEligible() {
  if (state.answers.householdIncomeOk === '아니오') return false;
  const condKeys = ['appliedArea', 'ownedArea', 'farmingYears', 'residenceYears'];
  return condKeys.every(key =>
    evaluateCondition(key, ensureValue(key).value)?.status === 'pass');
}

// ── 예상 지원금: 두 직불금 비교 + 유리한 쪽 추천 ─────────────────
STEPS['payment'] = {
  tts: () => {
    const e = computeExpected();
    if (!e.sonanongAmount) return '면적직불금 예상 금액을 알려드릴게요.';
    return e.recommended === 'sonanong'
      ? '소농직불금으로 신청하시면 더 많이 받을 수 있어요.'
      : '면적직불금으로 신청하시면 더 많이 받을 수 있어요.';
  },
  html: () => {
    const e = computeExpected();
    const won = n => n == null ? '' : n.toLocaleString() + '원';
    const unsure = state.answers.householdIncomeOk === '잘 모르겠어요';

    const sonanongCard = e.sonanongAmount != null
      ? `<div class="paycard ${e.recommended === 'sonanong' ? 'best' : ''}">
          <span class="k">소농직불금 ${e.recommended === 'sonanong' ? '⭐ 추천' : ''}</span>
          <b>${won(e.sonanongAmount)}</b>
          ${unsure ? '<span class="s">소득 요건은 담당자가 확인해드려요</span>' : ''}
        </div>`
      : `<div class="paycard off">
          <span class="k">소농직불금</span>
          <b style="font-size:16px;">소농 자격이 아니십니다</b>
        </div>`;

    const areaCard = `
      <div class="paycard ${e.sonanongAmount != null && e.recommended === 'area' ? 'best' : (e.sonanongAmount == null ? 'best' : '')}">
        <span class="k">면적직불금 ${e.sonanongAmount != null && e.recommended === 'area' ? '⭐ 추천' : ''}</span>
        <b>${won(e.areaAmount) || '계산 불가'}</b>
      </div>`;

    // 버튼: 추천 직불금 = 메인(초록), 나머지 = 보조(회색)
    let buttons;
    if (e.sonanongAmount != null) {
      const main  = e.recommended === 'sonanong' ? 'sonanong' : 'area';
      const other = main === 'sonanong' ? 'area' : 'sonanong';
      const nameOf = t => t === 'sonanong' ? '소농직불금' : '면적직불금';
      buttons = `
        <button class="btn" onclick="choosePayment('${main}')">${nameOf(main)}을 신청하시겠습니까?</button>
        <button class="btn ghost" onclick="choosePaymentOther('${other}', '${nameOf(main)}')">
          ${nameOf(other)}을 신청하시겠습니까?</button>`;
    } else {
      buttons = `<button class="btn" onclick="choosePayment('area')">면적직불금을 신청하시겠습니까?</button>`;
    }

    return `
      <div class="tts-row">🔊 음성 안내 중</div>
      <h1 class="h1">받으실 수 있는<br>예상 금액이에요</h1>
      <p class="sub">둘 중 하나만 신청할 수 있어요</p>
      <div class="stack">${sonanongCard}${areaCard}</div>
      ${e.sonanongAmount != null ? `
        <div class="bignum" style="margin:14px 0 4px;">
          <div class="cap" style="font-size:16px;font-weight:700;color:var(--green);">
            ${e.recommended === 'sonanong' ? '소농직불금' : '면적직불금'}으로 신청하면
            ${Math.abs((e.sonanongAmount || 0) - (e.areaAmount || 0)).toLocaleString()}원 더 받아요!
          </div>
        </div>` : ''}
      <div class="note">실제 지급액은 담당자 검토 후 확정됩니다</div>
      <div class="spacer"></div>
      ${buttons}
    `;
  },
};

function computeExpected() {
  const split = getAreaSplitHa();
  state.expected = calcExpectedPayment(split.riceHa, split.fieldHa, isSonanongEligible());
  return state.expected;
}

function choosePayment(type) {
  state.selectedPayment = type;
  goNext();
}

function choosePaymentOther(type, recommendedName) {
  if (!confirm(`${recommendedName}이 더 유리해요.\n그래도 이대로 신청하시겠어요?`)) return;
  choosePayment(type);
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
