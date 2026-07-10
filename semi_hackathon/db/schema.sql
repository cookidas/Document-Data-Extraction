-- 화성시 농업직불금 자동화 시스템 스키마
-- pages_json: 기존 프론트엔드의 pages[] 구조를 그대로 JSON 직렬화
--   [{ filename, fields:[{key,label,value,confidence,boundingPoly}], imageWidth, imageHeight }]
-- meta_json: 신청자 셀프접수 자기신고 응답 (landChanged, answers, expectedPayment 등)

CREATE TABLE IF NOT EXISTS applications (
  id             TEXT PRIMARY KEY,
  applicant_name TEXT,
  status         TEXT NOT NULL DEFAULT 'review',  -- processing | review | completed
  source         TEXT NOT NULL DEFAULT 'staff',   -- citizen | staff
  uploaded_at    TEXT,
  completed_at   TEXT,
  pages_json     TEXT NOT NULL DEFAULT '[]',
  meta_json      TEXT
);

CREATE TABLE IF NOT EXISTS trash (
  id             TEXT PRIMARY KEY,
  applicant_name TEXT,
  status         TEXT,
  source         TEXT,
  uploaded_at    TEXT,
  completed_at   TEXT,
  pages_json     TEXT,
  meta_json      TEXT,
  deleted_at     TEXT
);
