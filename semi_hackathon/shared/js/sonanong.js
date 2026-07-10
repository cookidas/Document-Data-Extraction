// 신청서 필드 접근/판정 공용 헬퍼 (담당자·신청자 공용)

function getFieldValue(fields, key) {
  const f = (fields || []).find(f => f.key === key);
  return f?.value || '';
}

// 신청서의 pages[].fields를 한 배열로 평탄화
function getAppFields(app) {
  return (app?.pages || []).flatMap(page => page.fields || []);
}

function getConfidenceClass(conf) {
  if (!conf || conf === 0) return 'unknown';
  if (conf >= 0.9) return 'high';
  if (conf >= 0.8) return 'mid';
  return 'low';
}

function getConfidenceLabel(conf) {
  if (!conf || conf === 0) return '';
  if (conf >= 0.9) return '자동 인식';
  if (conf >= 0.8) return '확인 권장';
  return '필수 확인';
}

function needsCheck(conf) {
  return conf > 0 && conf < 0.9;
}

// 소농직불금 전체 조건 통과 여부 (pass / fail / unknown)
// 숫자 4조건은 OCR/마이데이터 실측값 기준, 가구소득은 셀프접수 자기신고(meta)가 있을 때만 반영
function getSonanongResult(app) {
  const fields = getAppFields(app);
  const condKeys = ['appliedArea', 'ownedArea', 'farmingYears', 'residenceYears'];
  const results = condKeys.map(key =>
    evaluateCondition(key, getFieldValue(fields, key))?.status,
  );

  const income = app?.meta?.answers?.householdIncomeOk;
  if (income === '미충족') return 'fail';

  if (results.some(r => r === 'fail')) return 'fail';
  if (results.every(r => r === 'pass')) return 'pass';
  return 'unknown';
}

// 주민번호 뒷자리 마스킹
function maskResidentId(val) {
  if (!val) return '';
  const clean = val.replace(/\s/g, '');
  const m = clean.match(/^(\d{6})-?(\d)(\d{6})$/);
  if (m) return `${m[1]}-${m[2]}******`;
  const dash = clean.indexOf('-');
  if (dash > 0) return clean.substring(0, dash + 2) + '******';
  return clean.substring(0, 7) + '******';
}

// 면적직불금 계산 (총면적 ha 기준, 논+밭 합산)
function calcAreaPayment(totalHa) {
  if (!totalHa || totalHa < 0.1) return 0;
  const tier = PAYMENT_RATE_TIERS.find(t => totalHa <= t.maxHa);
  return Math.round(totalHa * tier.ratePerHa);
}

// 예상 지원금: 소농 요건 충족 시 소농직불금(정액)과 면적직불금 중 유리한 쪽
function calcExpectedPayment(totalHa, sonanongEligible) {
  const area = calcAreaPayment(totalHa);
  if (!sonanongEligible) return { amount: area, type: 'area' };
  return area > SONANONG_PAYMENT
    ? { amount: area, type: 'area' }
    : { amount: SONANONG_PAYMENT, type: 'sonanong' };
}
