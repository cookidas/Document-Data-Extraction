// OCR 필드별 텍스트 정제 (저장 전 호출)
function cleanOCRValue(key, value) {
  if (!value) return value;
  let v = value.trim();
  if (key === 'name') {
    // "성명 김동하" → "김동하"
    v = v.replace(/^성\s*명\s*/g, '').trim();
  } else if (key === 'appliedArea' || key === 'ownedArea') {
    // "(3000m2)" → "3000",  "17000㎡" → "17000"
    v = v.replace(/m2|m²|㎡/gi, '').replace(/[^0-9만천백십]/g, '').trim();
  } else if (key === 'farmingYears' || key === 'residenceYears') {
    // "5년" → "5"
    v = v.replace(/년/g, '').trim();
  }
  return v;
}

// 한국어 혼합 숫자 파싱: "5천", "4천800", "1만5천500", "5000", "(17000m2)" → 정수
function parseKoreanNumber(str) {
  if (!str) return null;
  // m2/㎡ 먼저 제거 후 숫자+한글 단위만 남기기 (m 제거 시 뒤 2가 숫자로 합쳐지는 버그 방지)
  const s = str.replace(/m2|m²|㎡/gi, '').replace(/[^\d만천백십]/g, '').trim();
  if (!s) return null;

  if (/^\d+$/.test(s)) return parseInt(s, 10);

  const units = { 만: 10000, 천: 1000, 백: 100, 십: 10 };
  let result = 0;
  let remaining = s;

  remaining = remaining.replace(/(\d+)(만|천|백|십)/g, (_, n, u) => {
    result += parseInt(n, 10) * units[u];
    return '';
  });

  if (/^\d+$/.test(remaining)) result += parseInt(remaining, 10);
  return result > 0 ? result : null;
}

// 소농 지급요건 단일 조건 판정
function evaluateCondition(key, rawValue) {
  const cond = CONDITIONS[key];
  if (!cond) return null;

  const val = parseKoreanNumber(rawValue);
  if (val === null) return { status: 'unknown', val: null };

  let pass;
  if (cond.op === '<=') pass = val <= cond.threshold;
  else if (cond.op === '<')  pass = val <  cond.threshold;
  else if (cond.op === '>=') pass = val >= cond.threshold;

  return { status: pass ? 'pass' : 'fail', val };
}

// CLOVA OCR API 호출
// templateId: 42351(1장) or 42354(2장). null이면 두 템플릿 모두 전송
async function callClovaOCR(base64Data, format = 'jpeg', templateId = null) {
  const secretKey = getSecretKey();
  if (!secretKey) throw new Error('Secret Key가 설정되지 않았습니다. 헤더의 ⚙️ 버튼에서 입력해주세요.');

  const ids = templateId
    ? [templateId]
    : Object.values(CLOVA_TEMPLATE_IDS);

  const res = await fetch(CLOVA_INVOKE_URL, {
    method: 'POST',
    headers: {
      'X-OCR-SECRET': secretKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'V2',
      requestId: `req-${Date.now()}`,
      timestamp: Date.now(),
      images: [{ format, name: 'form', data: base64Data }],
      templateIds: ids,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OCR API 오류 ${res.status}: ${text}`);
  }
  return res.json();
}

// CLOVA 응답에서 필드 배열 추출 (label 포함)
function parseOCRResponse(response) {
  const image = response?.images?.[0];
  if (!image || image.inferResult !== 'SUCCESS') return [];

  return (image.fields || []).map(f => ({
    key: f.name,
    label: FIELD_LABELS[f.name] || f.name,
    value: cleanOCRValue(f.name, f.inferText || ''),
    confidence: typeof f.inferConfidence === 'number' ? f.inferConfidence : 0,
    boundingPoly: f.boundingPoly || null,
  }));
}

// 이미지 File → base64 문자열
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 이미지 File → data URL (img.src 표시용)
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 파일 포맷 추출 (CLOVA API format 파라미터용)
function getImageFormat(file) {
  const type = file.type.toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('gif')) return 'gif';
  if (type.includes('bmp')) return 'bmp';
  return 'jpeg';
}
