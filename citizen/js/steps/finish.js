// [5]~[7] 본인확인 · 최종 요약 · 제출 완료
window.STEPS = window.STEPS || {};

STEPS['verify'] = {
  tts: () => `${ensureValue('name').value || '신청인'}님이 맞으신가요?`,
  html: () => `
    <div class="tts-row">🔊 음성 안내 중</div>
    <h1 class="h1" style="margin-top:40px;text-align:center;">
      ${ensureValue('name').value || '신청인'} 님이<br>맞으신가요?</h1>
    <div class="spacer"></div>
    <button class="btn" onclick="goNext()">예</button>
    <button class="btn ghost" onclick="editFrom('confirm:identity')">아니오</button>
  `,
};

STEPS['summary'] = {
  tts: () => '입력하신 내용을 마지막으로 확인해 주세요.',
  html: () => {
    const rows = [
      { k: '이름',   v: ensureValue('name').value,                          edit: 'confirm:identity' },
      { k: '주민등록번호', v: maskResidentId(ensureValue('residentId').value), edit: 'confirm:identity' },
      { k: '전화번호', v: ensureValue('phone').value,                        edit: 'confirm:phone' },
      { k: '주소',   v: ensureValue('address').value,                        edit: 'confirm:address' },
      { k: '계좌',   v: ensureValue('accountNumber_bankName').value,         edit: 'confirm:account' },
      { k: '신청면적', v: ensureValue('appliedArea').value ? ensureValue('appliedArea').value + '㎡' : '', edit: 'confirm:farm' },
    ];
    return `
      <div class="tts-row">🔊 음성 안내 중</div>
      <h1 class="h1">입력하신 내용이에요</h1>
      <p class="sub">누르면 바로 고칠 수 있어요</p>
      <div class="rows">
        ${rows.map(r => `
          <div class="row">
            <span class="k">${r.k}</span>
            <span style="display:flex;align-items:center;">
              <span class="v">${r.v || '<span style="color:#B0B8C1;">입력 안 함</span>'}</span>
              <button class="edit" onclick="editFrom('${r.edit}')">수정</button>
            </span>
          </div>`).join('')}
        ${state.expected?.amount ? `
          <div class="row">
            <span class="k">예상 지원금</span>
            <span class="v" style="color:var(--green);">${state.expected.amount.toLocaleString()}원</span>
          </div>` : ''}
      </div>
      <div class="spacer"></div>
      <button class="btn" id="submit-btn" onclick="submitApplication()"
        ${state.submitting ? 'disabled' : ''}>${state.submitting ? '접수 중...' : '제출하기 ✓'}</button>
    `;
  },
};

STEPS['done'] = {
  hideTop: true,
  tts: () => '접수가 완료되었습니다. 검토 후 담당자가 연락드리겠습니다.',
  html: () => `
    <div class="hero">
      <div class="check">✓</div>
      <h1>접수가 완료되었어요!</h1>
      <p>검토 후 담당자가<br>연락드리겠습니다</p>
      <div class="receipt">접수번호 ${state.appId}</div>
    </div>
  `,
};

// ── 제출 ─────────────────────────────────────────────────────────
async function submitApplication() {
  if (state.submitting) return;
  state.submitting = true;
  render();

  try {
    const id = 'APP-' + Date.now() + '-C00';
    const now = new Date().toLocaleString('ko-KR', { hour12: false });

    // 촬영된 사진을 순서대로 페이지로 구성
    const slots = ['idCard', 'page1', 'page2', 'evidence'].filter(s => state.photos[s]);
    const pages = slots.map(slot => ({
      filename: CAPTURE_SLOTS[slot].filename,
      fields: [],
      imageWidth: state.photos[slot].width,
      imageHeight: state.photos[slot].height,
    }));

    // 확정된 값(사용자 확인 완료)을 필드로 변환해 페이지에 배치
    // OCR로 읽은 필드는 원래 페이지에(바운딩박스 유지), 나머지는 첫 페이지에
    const allKeys = ['name', 'residentId', 'phone', 'address', 'accountNumber_bankName',
                     'appliedArea', 'ownedArea', 'farmingYears', 'residenceYears'];
    if (pages.length === 0) {
      pages.push({ filename: '셀프접수 입력값 (사진 없음)', fields: [], imageWidth: null, imageHeight: null });
      slots.push(null);
    }
    allKeys.forEach(key => {
      const v = state.values[key];
      if (!v || !v.value) return;
      const field = {
        key,
        label: FIELD_LABELS[key] || key,
        value: v.value,
        confidence: v.confidence,
        boundingPoly: v.boundingPoly,
      };
      const pageIdx = v.pageSlot ? slots.indexOf(v.pageSlot) : -1;
      pages[pageIdx >= 0 ? pageIdx : 0].fields.push(field);
    });

    const app = {
      id,
      applicantName: ensureValue('name').value || '이름미상',
      status: 'review',
      source: 'citizen',
      uploadedAt: now,
      completedAt: null,
      pages,
      meta: {
        landChanged: state.landChanged,
        answers: {
          basicIncomeOk: state.answers.basicIncomeOk,
          farmingOnLand: state.answers.farmingOnLand,
          newFarmerOneYear: state.answers.newFarmerOneYear,
          householdIncomeOk: state.answers.sonanongAsk === '예'
            ? (state.answers.checks.income ? '충족' : '미충족')
            : null,
        },
        paddyHa: state.paddyHa,
        fieldHa: state.fieldHa,
        expectedPayment: state.expected?.amount || null,
      },
    };

    await createApplication(app);
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] && state.photos[slots[i]]) {
        await uploadPageImage(id, i, state.photos[slots[i]].dataURL);
      }
    }

    state.appId = id;
    goTo('done');
  } catch (err) {
    alert('접수에 실패했습니다. 통신 상태를 확인하고 다시 시도해주세요.\n(' + err.message + ')');
    state.submitting = false;
    render();
  }
}
