// [0]~[1b] 시작 · 마이데이터 선택 · 농지 변동 질문
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
    <button class="btn" onclick="goNext()">신청 시작하기 →</button>
  `,
};

STEPS['mydata'] = {
  tts: () => '본인 정보를 빠르게 불러올까요? 화면의 프로필을 선택하시거나, 건너뛰고 직접 촬영하실 수 있어요.',
  html: () => `
    <div class="tag">⚠ 시연용 가상 프로필입니다</div>
    <h1 class="h1">본인 정보를 빠르게<br>불러올까요?</h1>
    <p class="sub">마이데이터로 인적사항·경작지 정보를 미리 채워드려요</p>
    <div class="stack">
      ${MYDATA_DEMO_PROFILES.map(p => `
        <button class="opt ${state.mydata?.profileId === p.profileId ? 'sel' : ''}"
          onclick="pickMyData('${p.profileId}')">
          <span class="avatar"></span>
          <span class="name"><b>${p.label}</b><span>${p.sub}</span></span>
        </button>`).join('')}
    </div>
    <div class="spacer"></div>
    <button class="btn ghost" onclick="skipMyData()">건너뛰고 직접 촬영할게요</button>
  `,
};

async function pickMyData(profileId) {
  state.mydata = await fetchMyDataProfile(profileId);
  // 프로필이 바뀌면 파생된 값 캐시 초기화 (사진 OCR 결과는 유지)
  state.values = {};
  goNext();
}

function skipMyData() {
  state.mydata = null;
  state.values = {};
  goNext();
}

STEPS['landchange'] = {
  tts: () => '농지에 변동이 있으신가요? 새로 경작하시거나 관할 밖 농지가 있으면 알려주세요.',
  html: () => `
    <h1 class="h1">농지에 변동이<br>있으신가요?</h1>
    <p class="sub">새로 경작하시거나 관할 밖 농지가 있으면 알려주세요</p>
    <div class="stack">
      <button class="opt ${state.landChanged === false ? 'sel' : ''}" onclick="pickLandChange(false)">
        아니요, 변동 없어요
      </button>
      <button class="opt ${state.landChanged === true ? 'sel' : ''}" onclick="pickLandChange(true)">
        네, 변동이 있어요
      </button>
    </div>
    <div id="landchange-note">
      ${state.landChanged === true ? `
        <div class="note">📋 신규·변동 농지는 규정상 행정복지센터 방문 확인이 필요해요.<br>
        서류를 미리 촬영해두시면 <b>방문 시간이 크게 단축</b>됩니다.</div>` : ''}
      ${state.landChanged === false ? `
        <div class="note ok">✓ 변동 없음 — 이대로 간편하게 진행할게요</div>` : ''}
    </div>
    <div class="spacer"></div>
    <button class="btn" onclick="goNext()" ${state.landChanged === null ? 'disabled' : ''}>다음으로</button>
  `,
};

function pickLandChange(changed) {
  state.landChanged = changed;
  render(); // 선택 표시 + 안내문 갱신
}
