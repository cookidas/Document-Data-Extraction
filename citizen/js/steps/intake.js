// [0]~[3] 시작 · PASS 본인인증(Mock) · 신청유형 선택 · 담당자 코드 · 준비물 안내 · 재신청(변경없음)
window.STEPS = window.STEPS || {};

STEPS['start'] = {
  hideTop: true,
  tts: () => '안녕하세요. 화성시 농업 직불금 간편 신청을 시작합니다.',
  html: () => `
    <div class="hero">
      <div class="logo">🌾</div>
      <h1>화성시 농업 직불금<br>간편 신청</h1>
      <p>농업인의 소득 안정을 위해<br>보조금을 지원하는 제도입니다</p>
    </div>
    <button class="btn" onclick="goNext()">농업 직불금 신청하기 →</button>
  `,
};

// ── PASS 본인인증 (시연용 Mock — 입력값은 재신청 조회 외에는 저장하지 않음) ──
STEPS['pass'] = {
  tts: () => '본인 확인을 위해 이름과 휴대전화 번호, 주민등록번호를 입력해 주세요.',
  html: () => `
    <div class="tag">⚠ 시연용 화면입니다 (실제 PASS 연동 아님)</div>
    <div class="pass-head">
      <span class="pass-logo">PASS</span>
      <span class="pass-sub">간편 본인확인</span>
    </div>
    <h1 class="h1">본인확인을<br>진행할게요</h1>
    <p class="sub">입력하신 정보로 본인 여부만 확인해요</p>
    <div class="stack">
      <div class="biginput"><label>이름</label>
        <input type="text" id="pass-name" value="${state.pass.name}" placeholder="홍길동"
          oninput="state.pass.name = this.value"></div>
      <div class="biginput"><label>전화</label>
        <input type="tel" id="pass-phone" value="${state.pass.phone}" placeholder="010-0000-0000"
          oninput="state.pass.phone = this.value"></div>
      <div class="biginput"><label>주민번호</label>
        <input type="text" id="pass-rrn" value="${state.pass.rrn}" placeholder="000000-0000000"
          oninput="state.pass.rrn = this.value"></div>
    </div>
    <div class="spacer"></div>
    <button class="btn" id="pass-btn" onclick="requestPassVerify()">인증 요청하기</button>
  `,
};

function requestPassVerify() {
  if (!state.pass.name.trim() || !state.pass.phone.trim() || !state.pass.rrn.trim()) {
    alert('이름, 전화번호, 주민등록번호를 모두 입력해주세요.');
    return;
  }
  const btn = document.getElementById('pass-btn');
  btn.disabled = true;
  btn.textContent = '인증 대기 중...';
  speak('인증을 요청했어요. 잠시만 기다려주세요.');
  setTimeout(() => {
    state.pass.verified = true;
    showModal('✅ 인증이 완료되었습니다', '본인확인이 끝났어요.<br>다음 단계로 넘어갈게요.', () => goNext());
  }, 2000);
}

// ── 신청 유형 선택 ───────────────────────────────────────────────
STEPS['apply-type'] = {
  tts: () => '직불금 신청이 처음이신가요? 해당하는 항목을 선택해 주세요.',
  html: () => `
    <h1 class="h1">직불금 신청이<br>처음이신가요?</h1>
    <p class="sub">상황에 맞는 항목을 눌러주세요</p>
    <div class="stack">
      <button class="opt ${state.applyType === 'new' ? 'sel' : ''}" onclick="pickApplyType('new')">
        <span class="name"><b>처음 신청해요</b><span>행정복지센터에서 담당자와 함께 진행해요</span></span>
      </button>
      <button class="opt ${state.applyType === 'reapply_no_change' ? 'sel' : ''}" onclick="pickApplyType('reapply_no_change')">
        <span class="name"><b>이전에도 신청했어요</b><span>바뀐 내용이 없으면 서류 없이 바로 접수돼요</span></span>
      </button>
      <button class="opt ${state.applyType === 'reapply_changed' ? 'sel' : ''}" onclick="pickApplyType('reapply_changed')">
        <span class="name"><b>이전 신청 정보가 바뀌었어요</b><span>바뀐 내용이 담긴 서류를 제출해주세요</span></span>
      </button>
    </div>
  `,
};

function pickApplyType(type) {
  state.applyType = type;
  goNext();
}

// ── 담당자 코드 (처음 신청 = 방문 필수, 직원 동반 게이트) ───────
STEPS['staff-pin'] = {
  tts: () => '처음 신청은 담당자와 함께 진행해요. 담당자에게 코드를 요청해 주세요.',
  html: () => `
    <h1 class="h1">담당자와 함께<br>진행하는 접수예요</h1>
    <p class="sub">첫 신청은 규정상 방문 접수가 필요해요.<br>창구 담당자에게 코드를 받아 입력해주세요.</p>
    <div class="biginput">
      <label>코드</label>
      <input type="password" id="staff-pin" inputmode="numeric" placeholder="담당자 코드 4자리" maxlength="8">
    </div>
    <div class="field-error" id="pin-error" style="color:#D14343;font-size:14px;margin-top:8px;"></div>
    <div class="spacer"></div>
    <button class="btn" onclick="checkStaffPin()">확인</button>
  `,
};

function checkStaffPin() {
  const input = document.getElementById('staff-pin');
  if (input.value.trim() === STAFF_ASSIST_PIN) {
    state.pinOk = true;
    goNext();
  } else {
    document.getElementById('pin-error').textContent = '코드가 올바르지 않아요. 담당자에게 다시 확인해주세요.';
    input.value = '';
  }
}

// ── 준비물 안내 ──────────────────────────────────────────────────
STEPS['prep'] = {
  tts: () => '신분증과 농업경영체 사실확인서를 준비해 주세요.',
  html: () => `
    <div class="tts-row">🔊 음성 안내 중</div>
    <h1 class="h1">이것만 준비하면<br>바로 끝나요</h1>
    <p class="sub">두 가지를 손에 들고 시작해주세요</p>
    <div class="stack">
      <div class="opt" style="cursor:default;"><span style="font-size:26px;">🪪</span>
        <span class="name"><b>신분증</b><span>주민등록증 또는 운전면허증</span></span></div>
      <div class="opt" style="cursor:default;"><span style="font-size:26px;">📄</span>
        <span class="name"><b>농업경영체 사실확인서</b><span>국립농산물품질관리원 발급 서류</span></span></div>
    </div>
    <div class="spacer"></div>
    <button class="btn" onclick="goNext()">준비 완료</button>
  `,
};

// ── 재신청(변경없음): 서류 없이 이전 데이터 복사 접수 ────────────
STEPS['reapply-lookup'] = {
  tts: () => '이전 신청 내역을 확인할게요.',
  html: () => {
    if (state.prevApp) {
      return `
        <div class="tts-row">🔊 음성 안내 중</div>
        <h1 class="h1">이전 신청 내역을<br>찾았어요</h1>
        <p class="sub">바뀐 내용이 없으면 이대로 바로 접수돼요</p>
        <div class="stack">
          <div class="valuecard row"><span class="k">신청인</span><b>${state.prevApp.applicantName || '-'}</b></div>
          <div class="valuecard row"><span class="k">이전 접수일</span><b style="font-size:15px;">${state.prevApp.uploadedAt || '-'}</b></div>
        </div>
        <div class="note ok">✓ 제출하실 서류는 없어요. 담당자가 이전 내용 그대로 확인해드려요.</div>
        <div class="spacer"></div>
        <button class="btn" id="reapply-submit-btn" onclick="submitNoChangeReapply()"
          ${state.submitting ? 'disabled' : ''}>${state.submitting ? '접수 중...' : '이대로 접수하기 ✓'}</button>
      `;
    }
    return `
      <div class="tts-row">🔊 음성 안내 중</div>
      <h1 class="h1">이전 신청 내역을<br>확인할게요</h1>
      <p class="sub">본인확인 때 입력하신 주민등록번호로 찾아드려요</p>
      <div id="lookup-status" class="note" style="display:none;"></div>
      <div class="spacer"></div>
      <button class="btn" id="lookup-btn" onclick="runReapplyLookup()">이전 신청 내역 불러오기</button>
    `;
  },
};

async function runReapplyLookup() {
  const btn = document.getElementById('lookup-btn');
  const status = document.getElementById('lookup-status');
  btn.disabled = true;
  btn.textContent = '찾고 있어요...';
  try {
    const prev = await lookupPreviousApplication(state.pass.rrn);
    if (!prev) {
      status.style.display = 'block';
      status.innerHTML = '이전 신청 기록을 찾을 수 없어요.<br>담당자(📞 1334)에게 문의하시거나, 뒤로 가서 다른 유형을 선택해주세요.';
      btn.disabled = false;
      btn.textContent = '다시 시도하기';
      return;
    }
    state.prevApp = prev;
    render();
    speakCurrent();
  } catch (err) {
    status.style.display = 'block';
    status.textContent = '조회 중 문제가 생겼어요: ' + err.message;
    btn.disabled = false;
    btn.textContent = '다시 시도하기';
  }
}

async function submitNoChangeReapply() {
  if (state.submitting) return;
  state.submitting = true;
  render();
  try {
    const id = 'APP-' + Date.now() + '-R00';
    await createApplication({
      id,
      applicantName: state.prevApp.applicantName,
      status: 'review',
      source: 'citizen',
      assistedByStaff: false,
      reapplyType: 'no_change',
      previousApplicationId: state.prevApp.id,
      uploadedAt: new Date().toLocaleString('ko-KR', { hour12: false }),
      completedAt: null,
      pages: state.prevApp.pages, // 이전 데이터 그대로 복사 (이미지는 이전 신청서 것을 참조)
      meta: { applyType: 'reapply_no_change' },
    });
    state.appId = id;
    goTo('done');
  } catch (err) {
    alert('접수에 실패했습니다. 다시 시도해주세요.\n(' + err.message + ')');
    state.submitting = false;
    render();
  }
}
