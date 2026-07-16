// 신청자 셀프접수 마법사 오케스트레이터
// 화면 정의는 js/steps/*.js 가 STEPS 레지스트리에 등록, 여기서는 흐름/전환만 관리

window.STEPS = window.STEPS || {};

const state = {
  idx: 0,
  applyType: null,           // 'new' | 'reapply_no_change' | 'reapply_changed'
  pass: { name: '', phone: '', rrn: '', verified: false }, // PASS Mock (재신청 조회 외 저장 안 함)
  pinOk: false,              // 현장 도움접수 담당자 코드 통과 여부
  photos: {},                // slot → { dataURL, width, height }
  ocrFields: { factSheet1: [], factSheet2: [] },
  ocrBusy: null,             // OCR 진행 중인 슬롯
  values: {},                // key → { value, confidence, boundingPoly, pageSlot }
  answers: { householdIncomeOk: null }, // '예' | '아니오' | '잘 모르겠어요'
  selectedPayment: null,     // 'sonanong' | 'area'
  expected: null,            // { areaAmount, sonanongAmount, recommended }
  prevApp: null,             // 재신청 시 이전 완료 신청서
  noticeAgreed: false,
  submitting: false,
  appId: null,
  returnTo: null,
};

// ── 단계 흐름 (신청 유형에 따라 동적 분기) ───────────────────────
function computeFlow() {
  const flow = ['start', 'pass', 'apply-type'];

  if (state.applyType === 'reapply_no_change') {
    flow.push('reapply-lookup', 'done');
    return flow;
  }
  if (state.applyType === 'new') flow.push('staff-pin');
  flow.push('prep');
  flow.push('capture:factSheet1', 'capture:factSheet2');
  flow.push('confirm:identity', 'confirm:contact', 'confirm:family', 'confirm:farm');
  flow.push('elig:income', 'payment', 'notice', 'summary', 'done');
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
  const total = flow.length - 2; // start/done 제외
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

// 최종요약의 [수정] 버튼: 해당 확인 화면으로 점프, 확인 후 요약으로 복귀
function editFrom(stepId) {
  state.returnTo = 'summary';
  goTo(stepId);
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

// ── 인증 완료 등 안내 팝업 ───────────────────────────────────────
function showModal(title, bodyHTML, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">${title}</div>
      <div class="modal-body">${bodyHTML}</div>
      <button class="btn" id="modal-ok">확인</button>
    </div>`;
  document.body.appendChild(overlay);
  speak(title.replace(/[✅✓]/g, ''));
  document.getElementById('modal-ok').onclick = () => {
    overlay.remove();
    onConfirm?.();
  };
}

// ── 카메라/갤러리/파일 촬영 ──────────────────────────────────────
const cameraInput = document.getElementById('camera-input');
let pendingPhotoCb = null;
let pendingPdfPageHint = 1; // PDF 업로드 시 뽑아낼 페이지 (사실확인서 2쪽 슬롯이면 2)

function requestPhoto(useCamera, cb, pdfPageHint = 1) {
  pendingPhotoCb = cb;
  pendingPdfPageHint = pdfPageHint;
  if (useCamera) cameraInput.setAttribute('capture', 'environment');
  else cameraInput.removeAttribute('capture'); // 갤러리 선택 / PC에선 파일 선택 창
  cameraInput.value = '';
  cameraInput.click();
}

cameraInput.addEventListener('change', async () => {
  const file = cameraInput.files[0];
  if (!file || !pendingPhotoCb) return;
  let raw;
  if (file.type === 'application/pdf') {
    if (!window.pdfjsLib) {
      alert('PDF를 읽을 수 없는 환경이에요. 사진 파일로 올려주세요.');
      pendingPhotoCb = null;
      return;
    }
    try {
      raw = await pdfPageToDataURL(file, pendingPdfPageHint);
    } catch (err) {
      alert('PDF를 여는 데 실패했어요. 사진 파일로 올려주세요.\n(' + err.message + ')');
      pendingPhotoCb = null;
      return;
    }
  } else {
    raw = await fileToDataURL(file);
  }
  const photo = await compressPhoto(raw);
  const cb = pendingPhotoCb;
  pendingPhotoCb = null;
  cb(photo);
});

// PDF의 특정 페이지를 이미지로 변환 (페이지 수 부족 시 1페이지로 폴백)
async function pdfPageToDataURL(file, pageNum) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(Math.min(pageNum, pdf.numPages));
  const viewport = page.getViewport({ scale: 2 });
  const cv = document.createElement('canvas');
  cv.width = viewport.width;
  cv.height = viewport.height;
  await page.render({ canvasContext: cv.getContext('2d'), viewport }).promise;
  return cv.toDataURL('image/jpeg', 0.9);
}

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
