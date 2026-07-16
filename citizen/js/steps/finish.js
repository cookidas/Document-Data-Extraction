// 최종 요약 · 제출 · 완료
window.STEPS = window.STEPS || {};

STEPS['summary'] = {
  tts: () => '입력하신 내용을 마지막으로 확인해 주세요.',
  html: () => {
    const paymentName = state.selectedPayment === 'sonanong' ? '소농직불금' : '면적직불금';
    const amount = state.selectedPayment === 'sonanong'
      ? state.expected?.sonanongAmount : state.expected?.areaAmount;
    const rows = [
      { k: '이름',   v: ensureValue('name').value,                            edit: 'confirm:identity' },
      { k: '주민등록번호', v: maskResidentId(ensureValue('residentId').value), edit: 'confirm:identity' },
      { k: '전화번호', v: ensureValue('phone').value,                          edit: 'confirm:identity' },
      { k: '주소',   v: ensureValue('address').value,                          edit: 'confirm:contact' },
      { k: '계좌',   v: ensureValue('accountNumber_bankName').value,           edit: 'confirm:contact' },
      { k: '농지면적', v: ensureValue('appliedArea').value ? ensureValue('appliedArea').value + '㎡' : '', edit: 'confirm:farm' },
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
        <div class="row">
          <span class="k">신청 직불금</span>
          <span class="v" style="color:var(--green);">${paymentName}
            ${amount ? ' · ' + amount.toLocaleString() + '원' : ''}</span>
        </div>
      </div>
      <div class="spacer"></div>
      <button class="btn" id="submit-btn" onclick="submitApplication()"
        ${state.submitting ? 'disabled' : ''}>${state.submitting ? '접수 중...' : '제출하기 ✓'}</button>
    `;
  },
};

STEPS['done'] = {
  hideTop: true,
  tts: () => state.applyType === 'new'
    ? '접수가 완료되었습니다. 담당자님이 바로 확인해 드릴게요.'
    : '접수가 완료되었습니다. 검토 후 담당자가 연락드리겠습니다.',
  html: () => {
    const subMsg = state.applyType === 'new'
      ? '담당자님이 바로<br>확인해드릴게요'
      : state.applyType === 'reapply_no_change'
        ? '서류 없이 간편 접수됐어요.<br>검토 후 안내드릴게요'
        : '검토 후 담당자가<br>안내 문자 혹은 전화 드리겠습니다';
    return `
      <div class="hero">
        <div class="check">✓</div>
        <h1>신청이 완료되었습니다!</h1>
        <p>${subMsg}</p>
        <div class="receipt">접수번호 ${state.appId}</div>
      </div>
    `;
  },
};

// ── 제출 ─────────────────────────────────────────────────────────
async function submitApplication() {
  if (state.submitting) return;
  state.submitting = true;
  render();

  try {
    const id = 'APP-' + Date.now() + '-C00';
    const now = new Date().toLocaleString('ko-KR', { hour12: false });

    // 재신청(변경있음): PASS 주민번호로 이전 신청서를 찾아 비교 대상으로 연결
    if (state.applyType === 'reapply_changed' && !state.prevApp) {
      try { state.prevApp = await lookupPreviousApplication(state.pass.rrn); } catch {}
    }

    // 촬영된 사실확인서 페이지 구성
    const slots = ['factSheet1', 'factSheet2'].filter(s => state.photos[s]);
    const pages = slots.map(slot => ({
      filename: CAPTURE_SLOTS[slot].filename,
      fields: [],
      imageWidth: state.photos[slot].width,
      imageHeight: state.photos[slot].height,
    }));
    if (pages.length === 0) {
      pages.push({ filename: '셀프접수 입력값 (사진 없음)', fields: [], imageWidth: null, imageHeight: null });
      slots.push(null);
    }

    // 확인 완료된 값을 필드로 변환해 페이지에 배치
    // (OCR 원천 페이지 유지 → 바운딩박스/크롭 돋보기 동작, 파생·수기값은 첫 페이지에)
    const famKeys = [];
    for (let i = 1; i <= 8; i++) famKeys.push(`famRel_L${i}`, `famName_L${i}`, `famId_L${i}`);
    const plotKeys = [];
    for (let i = 1; i <= PLOT_ROW_COUNT; i++) plotKeys.push(`plotArea_L${i}`, `plotOwner_L${i}`, `plotType_L${i}`);
    const allKeys = ['name', 'residentId', 'phone', 'address', 'accountNumber_bankName',
                     'residenceYears', 'farmingYears', 'appliedArea', 'ownedArea',
                     ...famKeys, ...plotKeys];

    allKeys.forEach(key => {
      const v = ensureValue(key);
      if (!v.value) return;
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

    const split = getAreaSplitHa();
    const app = {
      id,
      applicantName: ensureValue('name').value || '이름미상',
      status: 'review',
      source: 'citizen',
      assistedByStaff: state.applyType === 'new',
      reapplyType: state.applyType === 'reapply_changed' ? 'changed' : null,
      previousApplicationId: state.prevApp?.id || null,
      uploadedAt: now,
      completedAt: null,
      pages,
      meta: {
        applyType: state.applyType,
        answers: {
          householdIncomeOk: state.answers.householdIncomeOk === '예' ? '충족'
            : state.answers.householdIncomeOk === '아니오' ? '미충족' : null,
        },
        selectedPayment: state.selectedPayment,
        expectedArea: state.expected?.areaAmount ?? null,
        expectedSonanong: state.expected?.sonanongAmount ?? null,
        riceHa: split.riceHa,
        fieldHa: split.fieldHa,
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
