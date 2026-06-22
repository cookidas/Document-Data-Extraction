const CLOVA_INVOKE_URL = '/ocr';

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

// 소농 지급요건 판정 기준
const CONDITIONS = {
  appliedArea:    { op: '<=', threshold: 5000,  unit: '㎡', label: '① 신청(경영) 면적의 합', desc: '5,000㎡ 이하' },
  ownedArea:      { op: '<',  threshold: 15500, unit: '㎡', label: '①-1 소유면적의 합',     desc: '15,500㎡ 미만' },
  farmingYears:   { op: '>=', threshold: 3,     unit: '년', label: '② 영농 종사 기간',      desc: '3년 이상' },
  residenceYears: { op: '>=', threshold: 3,     unit: '년', label: '② 농촌 거주 기간',      desc: '3년 이상' },
};

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
