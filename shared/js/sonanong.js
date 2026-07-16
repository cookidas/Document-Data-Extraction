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

// ── 소농직불금 판정 ──────────────────────────────────────────────

// 소농직불금 전체 조건 통과 여부 (pass / fail / unknown)
// 숫자 4조건은 OCR 실측값 기준, 가구소득은 셀프접수 자기신고(meta)가 있을 때만 반영
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

// ── 사실확인서 농지 표 합산 ──────────────────────────────────────

// plotArea/plotOwner/plotType_Lx 필드에서 면적 정보 집계
// 반환: { appliedSqm(본인 소유 합), ownedSqm(가구 전체 합), riceSqm, fieldSqm(본인 소유의 논/밭 분리) }
function sumPlots(fields) {
  let appliedSqm = 0, ownedSqm = 0, riceSqm = 0, fieldSqm = 0;
  for (let i = 1; i <= PLOT_ROW_COUNT; i++) {
    const area = parseKoreanNumber(getFieldValue(fields, `plotArea_L${i}`));
    if (!area) continue;
    ownedSqm += area;
    const owner = getFieldValue(fields, `plotOwner_L${i}`).trim();
    if (owner.includes('본인')) {
      appliedSqm += area;
      const type = getFieldValue(fields, `plotType_L${i}`).trim();
      if (type.includes('논')) riceSqm += area;
      else fieldSqm += area; // 논이 아니면 밭으로 취급 (보수적 단가)
    }
  }
  return { appliedSqm, ownedSqm, riceSqm, fieldSqm };
}

// ── 면적직불금 계산 (논/밭 각각 독립 누진 후 합산) ──────────────

// 단일 지목의 누진 계산: 구간별로 잘라 각 구간 단가 적용 (소득세 방식)
function calcProgressive(ha, tiers) {
  if (!ha || ha <= 0) return 0;
  let total = 0, prev = 0;
  for (const t of tiers) {
    const span = Math.min(ha, t.upToHa) - prev;
    if (span <= 0) break;
    total += span * t.ratePerHa;
    prev = t.upToHa;
  }
  return Math.round(total);
}

function calcAreaPayment(riceHa, fieldHa) {
  return calcProgressive(riceHa, PAYMENT_RATE_TIERS_RICE) +
         calcProgressive(fieldHa, PAYMENT_RATE_TIERS_FIELD);
}

// 두 직불금 비교: { areaAmount, sonanongAmount(자격 없으면 null), recommended: 'sonanong'|'area' }
function calcExpectedPayment(riceHa, fieldHa, sonanongEligible) {
  const areaAmount = calcAreaPayment(riceHa, fieldHa);
  if (!sonanongEligible) return { areaAmount, sonanongAmount: null, recommended: 'area' };
  return {
    areaAmount,
    sonanongAmount: SONANONG_PAYMENT,
    recommended: areaAmount > SONANONG_PAYMENT ? 'area' : 'sonanong',
  };
}

// 담당자 화면용: 신청서에서 면적직불금 예상액 산출
// 필지 정보(지목 포함)가 있으면 정확 계산, 없으면(창구 종이접수) appliedArea 전체를
// 밭 단가로 보수적 추정
function estimateAreaPaymentForApp(app) {
  const fields = getAppFields(app);
  const plots = sumPlots(fields);
  if (plots.appliedSqm > 0) {
    return { amount: calcAreaPayment(plots.riceSqm / 10000, plots.fieldSqm / 10000), exact: true };
  }
  const sqm = parseKoreanNumber(getFieldValue(fields, 'appliedArea'));
  if (!sqm) return { amount: null, exact: false };
  return { amount: calcAreaPayment(0, sqm / 10000), exact: false };
}

// ── 기타 ─────────────────────────────────────────────────────────

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

// 접수유형 4분류 (표시용)
function getReceptionType(app) {
  if (app.reapplyType === 'no_change') return { key: 'reapply_no_change', label: '재신청·변경없음', icon: '♻️' };
  if (app.reapplyType === 'changed')   return { key: 'reapply_changed',   label: '재신청·변경있음', icon: '🔄' };
  if (app.source === 'citizen' && app.assistedByStaff)
    return { key: 'assisted', label: '현장 도움접수', icon: '🧑‍💼' };
  if (app.source === 'citizen') return { key: 'citizen', label: '셀프접수', icon: '📱' };
  return { key: 'staff', label: '현장 종이접수', icon: '🏢' };
}
