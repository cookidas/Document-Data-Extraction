-- 화성시 농업직불금 자동화 시스템 스키마
-- pages_json: 기존 프론트엔드의 pages[] 구조를 그대로 JSON 직렬화
--   [{ filename, fields:[{key,label,value,confidence,boundingPoly}], imageWidth, imageHeight }]
-- meta_json: 신청자 셀프접수 자기신고 응답 (landChanged, answers, expectedPayment 등)

-- 접수유형 4분류는 컬럼 조합으로 파생:
--   현장종이: source=staff
--   현장모바일(직원동반): source=citizen, assisted_by_staff=1
--   재신청-변경없음: reapply_type='no_change'
--   재신청-변경있음: reapply_type='changed'
CREATE TABLE IF NOT EXISTS applications (
  id                      TEXT PRIMARY KEY,
  applicant_name          TEXT,
  status                  TEXT NOT NULL DEFAULT 'review',  -- processing | review | completed
  source                  TEXT NOT NULL DEFAULT 'staff',   -- citizen | staff
  assisted_by_staff       INTEGER NOT NULL DEFAULT 0,      -- 창구 태블릿 직원 동반 접수 여부
  reapply_type            TEXT,                            -- NULL | no_change | changed
  previous_application_id TEXT,                            -- 재신청 시 비교 대상 이전 신청서 id
  uploaded_at             TEXT,
  completed_at            TEXT,
  pages_json              TEXT NOT NULL DEFAULT '[]',
  meta_json               TEXT
);

CREATE TABLE IF NOT EXISTS trash (
  id                      TEXT PRIMARY KEY,
  applicant_name          TEXT,
  status                  TEXT,
  source                  TEXT,
  assisted_by_staff       INTEGER,
  reapply_type            TEXT,
  previous_application_id TEXT,
  uploaded_at             TEXT,
  completed_at            TEXT,
  pages_json              TEXT,
  meta_json               TEXT,
  deleted_at              TEXT
);
