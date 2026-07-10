const CLOVA_INVOKE_URL = '/api/ocr';

function getSecretKey() {
  return localStorage.getItem('clova_secret_key') || '';
}
function setSecretKey(key) {
  localStorage.setItem('clova_secret_key', key.trim());
}

// 페이지별 템플릿 ID
const CLOVA_TEMPLATE_IDS = {
  page1: 42351,
  page2: 42354,
};

// 소농 지급요건 판정 기준 (2026 공익직불금 안내서 기준)
// min이 있으면 하한도 함께 체크
const CONDITIONS = {
  appliedArea:    { op: '<=', threshold: 5000,  min: 1000, unit: '㎡', label: '① 신청(경영) 면적의 합', desc: '1,000~5,000㎡' },
  ownedArea:      { op: '<',  threshold: 15500, unit: '㎡', label: '①-1 소유면적의 합',     desc: '15,500㎡ 미만' },
  farmingYears:   { op: '>=', threshold: 3,     unit: '년', label: '② 영농 종사 기간',      desc: '3년 이상' },
  residenceYears: { op: '>=', threshold: 3,     unit: '년', label: '② 농촌 거주 기간',      desc: '3년 이상' },
};

// 면적직불금 단가표 (논+밭 합산 총면적 기준, 원/ha)
const PAYMENT_RATE_TIERS = [
  { maxHa: 2, ratePerHa: 2150000 },
  { maxHa: 6, ratePerHa: 2070000 },
  { maxHa: Infinity, ratePerHa: 1980000 },
];

// 소농직불금 정액 (원)
const SONANONG_PAYMENT = 1300000;

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
};

// 마이데이터 데모 프로필 (시연용 Mock — 실제 API 연동 전까지 사용)
// 필드 키는 FIELD_LABELS와 동일하게 유지할 것 (실연동 시에도 이 모양 유지)
const MYDATA_DEMO_PROFILES = [
  {
    profileId: 'demo-1',
    label: '김농부님',
    sub: '동탄면 · 농업경영체 등록',
    fields: {
      name: '김농부',
      residentId: '551010-1******',
      address: '경기도 화성시 동탄면 농로1길 23',
      phone: '010-1234-5678',
      appliedArea: '3000',
      ownedArea: '4500',
      farmingYears: '12',
      residenceYears: '15',
    },
  },
  {
    profileId: 'demo-2',
    label: '이화성님',
    sub: '봉담읍 · 농업경영체 등록',
    fields: {
      name: '이화성',
      residentId: '480505-2******',
      address: '경기도 화성시 봉담읍 들판로 45',
      phone: '010-9876-5432',
      appliedArea: '4800',
      ownedArea: '14000',
      farmingYears: '30',
      residenceYears: '30',
    },
  },
];
