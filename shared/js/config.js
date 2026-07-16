const CLOVA_INVOKE_URL = '/api/ocr';

function getSecretKey() {
  return localStorage.getItem('clova_secret_key') || '';
}
function setSecretKey(key) {
  localStorage.setItem('clova_secret_key', key.trim());
}

// CLOVA 커스텀 템플릿 ID
// page1/page2: 창구접수용 종이 직불금 신청서 (담당자 스캔)
// factSheet1/factSheet2: 신청자 셀프접수용 농업경영체 사실확인서 1·2쪽
const CLOVA_TEMPLATE_IDS = {
  page1: 42351,
  page2: 42354,
  factSheet1: 42772,
  factSheet2: 42773,
};

// 사실확인서 2쪽 농지 표 최대 행 수 (plotArea_L1 ~ L4)
const PLOT_ROW_COUNT = 4;

// 소농직불금 지급요건 판정 기준 (2026 공익직불금 안내서 기준)
// min이 있으면 하한도 함께 체크
const CONDITIONS = {
  appliedArea:    { op: '<=', threshold: 5000,  min: 1000, unit: '㎡', label: '① 신청(경영) 면적의 합', desc: '1,000~5,000㎡' },
  ownedArea:      { op: '<',  threshold: 15500, unit: '㎡', label: '①-1 소유면적의 합',     desc: '15,500㎡ 미만' },
  farmingYears:   { op: '>=', threshold: 3,     unit: '년', label: '② 영농 종사 기간',      desc: '3년 이상' },
  residenceYears: { op: '>=', threshold: 3,     unit: '년', label: '② 농촌 거주 기간',      desc: '3년 이상' },
};

// 면적직불금 누진 단가표 (원/ha) — 논/밭 각각 독립 구간 계산 후 합산
// 예: 밭 3ha → 2ha×150만 + 1ha×143만 = 443만원
const PAYMENT_RATE_TIERS_RICE = [
  { upToHa: 2, ratePerHa: 1870000 },
  { upToHa: 6, ratePerHa: 1790000 },
  { upToHa: Infinity, ratePerHa: 1700000 },
];
const PAYMENT_RATE_TIERS_FIELD = [
  { upToHa: 2, ratePerHa: 1500000 },
  { upToHa: 6, ratePerHa: 1430000 },
  { upToHa: Infinity, ratePerHa: 1360000 },
];

// 소농직불금 정액 (원)
const SONANONG_PAYMENT = 1300000;

// 현장 도움접수(직원 동반) 게이트용 담당자 코드 — 프로토타입 고정 PIN
const STAFF_ASSIST_PIN = '2026';

// OCR 필드 key → 한국어 레이블
const FIELD_LABELS = {
  name: '성명',
  residentId: '주민등록번호',
  accountNumber_bankName: '계좌번호(은행명)',
  address: '주소',
  phone: '전화번호',
  famRel_L1: '관계', famName_L1: '성명', famId_L1: '주민등록번호',
  famRel_L2: '관계', famName_L2: '성명', famId_L2: '주민등록번호',
  famRel_L3: '관계', famName_L3: '성명', famId_L3: '주민등록번호',
  famRel_L4: '관계', famName_L4: '성명', famId_L4: '주민등록번호',
  famRel_L5: '관계', famName_L5: '성명', famId_L5: '주민등록번호',
  famRel_L6: '관계', famName_L6: '성명', famId_L6: '주민등록번호',
  famRel_L7: '관계', famName_L7: '성명', famId_L7: '주민등록번호',
  famRel_L8: '관계', famName_L8: '성명', famId_L8: '주민등록번호',
  appliedArea: '신청(경영) 면적의 합',
  ownedArea: '소유면적의 합',
  farmingYears: '영농 종사 기간',
  residenceYears: '농촌 거주 기간',
  plotArea_L1: '필지1 경작면적', plotOwner_L1: '필지1 소유자', plotType_L1: '필지1 지목',
  plotArea_L2: '필지2 경작면적', plotOwner_L2: '필지2 소유자', plotType_L2: '필지2 지목',
  plotArea_L3: '필지3 경작면적', plotOwner_L3: '필지3 소유자', plotType_L3: '필지3 지목',
  plotArea_L4: '필지4 경작면적', plotOwner_L4: '필지4 소유자', plotType_L4: '필지4 지목',
};
