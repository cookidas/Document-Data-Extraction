// 신청자 셀프접수 마법사 오케스트레이터
// 화면 정의는 js/steps/*.js 가 STEPS 레지스트리에 등록, 여기서는 흐름/전환만 관리

window.STEPS = window.STEPS || {};

const state = {
  idx: 0,
  mydata: null,        // 선택된 마이데이터 프로필 (Mock)
  landChanged: null,   // 농지 변동/신규·관외경작 여부
  photos: {},          // slot → { dataURL, width, height }
  ocrFields: { page1: [], page2: [] },
  values: {},          // key → { value, confidence, boundingPoly, pageSlot }
  answers: { basicIncomeOk: null, farmingOnLand: null, newFarmerOneYear: null, sonanongAsk: null, checks: {} },
  paddyHa: '',
  fieldHa: '',
  expected: null,      // { amount, type }
  noticeAgreed: false,
  submitting: false,
  appId: null,
};

// ── 단계 흐름 (상태에 따라 동적으로 분기) ────────────────────────
function computeFlow() {
  const flow = ['start', 'mydata', 'landchange',
    'capture:idCard', 'capture:page1', 'capture:page2'];
  if (state.landChanged === true) flow.push('capture:evidence');
  flow.push('confirm:identity', 'confirm:phone', 'confirm:address', 'confirm:account', 'confirm:farm');
  flow.push('elig:q1', 'elig:q2');
  if (state.landChanged === true) flow.push('elig:q3');
  flow.push('sonanong:ask');
  if (state.answers.sonanongAsk === '예') flow.push('sonanong:check');
  flow.push('payment', 'notice', 'verify', 'summary', 'done');
  return flow;
}

// ── 렌더링 ───────────────────────────────────────────────────────
const container = document.getElementById('step-container');
const topBar = document.getElementById('wiz-top');
const progressEl = document.getElementById('progress');

function render() {
  const flow = computeFlow();
  if (state.idx >= flow.length) state.idx = flow.length - 1;
  const step = STEPS[flow[state.idx]];

  topBar.style.display = step.hideTop ? 'none' : 'flex';
  container.innerHTML = step.html();
  renderProgress(flow);
  step.mount?.();
}

function renderProgress(flow) {
  // start/done 제외한 진행 구간 기준
  const total = flow.length - 2;
  const current = Math.max(0, Math.min(state.idx, total));
  progressEl.innerHTML = Array.from({ length: total },
    (_, i) => `<i class="${i < current ? 'on' : ''}"></i>`).join('');
}

function goNext() {
  const flow = computeFlow();
  // 최종요약에서 "수정"으로 진입한 확인 화면은 완료 후 요약으로 복귀
  if (state.returnTo && flow[state.idx].startsWith('confirm:')) {
    const dest = state.returnTo;
    state.returnTo = null;
    goTo(dest);
    return;
  }
  if (state.idx < flow.length - 1) {
    state.idx++;
    render();
    speakCurrent();
  }
}

// 최종요약의 [수정] 버튼: 해당 확인 화면으로 점프, 확인 후 요약으로 복귀
function editFrom(stepId) {
  state.returnTo = 'summary';
  goTo(stepId);
}

function goBack() {
  if (state.idx > 0) {
    state.idx--;
    render();
    speakCurrent();
  }
}

function goTo(stepId) {
  const flow = computeFlow();
  const i = flow.indexOf(stepId);
  if (i >= 0) {
    state.idx = i;
    render();
    speakCurrent();
  }
}

// ── TTS 음성 안내 ────────────────────────────────────────────────
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR';
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

function speakCurrent() {
  const step = STEPS[computeFlow()[state.idx]];
  speak(step.tts?.());
}

// ── 카메라/갤러리 촬영 ───────────────────────────────────────────
const cameraInput = document.getElementById('camera-input');
let pendingPhotoCb = null;

function requestPhoto(useCamera, cb) {
  pendingPhotoCb = cb;
  if (useCamera) cameraInput.setAttribute('capture', 'environment');
  else cameraInput.removeAttribute('capture');
  cameraInput.value = '';
  cameraInput.click();
}

cameraInput.addEventListener('change', async () => {
  const file = cameraInput.files[0];
  if (!file || !pendingPhotoCb) return;
  const raw = await fileToDataURL(file);
  const photo = await compressPhoto(raw);
  const cb = pendingPhotoCb;
  pendingPhotoCb = null;
  cb(photo);
});

// 최대 1500px JPEG 압축.
// 신청자 흐름은 OCR 입력과 저장 이미지가 모두 이 압축본이므로,
// 바운딩박스 좌표계가 일치하도록 압축본 크기를 imageWidth/Height로 기록한다.
function compressPhoto(dataURL, maxPx = 1500, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * scale);
      cv.height = Math.round(img.naturalHeight * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      resolve({
        dataURL: cv.toDataURL('image/jpeg', quality),
        width: cv.width,
        height: cv.height,
      });
    };
    img.src = dataURL;
  });
}

// ── 시작 ─────────────────────────────────────────────────────────
render();
