# 농업직불금 자동화 시스템

## 프로젝트 구조

```
.
├── index.html            # 로그인
├── dashboard.html        # 대시보드 (업로드·목록·통계·휴지통)
├── review.html           # 검수 화면 (좌 원본 / 우 추출 폼)
├── completed.html        # 검수 완료 목록 · 내보내기
├── server.py             # Flask — CLOVA OCR 프록시
├── css/
│   └── style.css         # 디자인 토큰 + 전체 스타일
└── js/
    ├── config.js         # CLOVA 템플릿 ID · 소농 판정 기준 · 필드 라벨
    ├── ocr.js            # CLOVA 호출 · 응답 파싱 · 한국어 숫자 파싱 · 자격 판정
    ├── mock-data.js      # localStorage CRUD · 휴지통 · 신뢰도 헬퍼
    ├── imageDB.js        # IndexedDB — 원본 페이지 이미지 저장/조회
    ├── dashboard.js      # 업로드·배치 OCR·목록·통계·내보내기
    ├── review.js         # 캔버스 크롭 툴팁·형식 검증·Human Gate·저장
    └── completed.js      # 완료 목록·마스킹·내보내기
```

## 시작하기

### 1. 요구 사항
- Python 3.8+
- NAVER CLOUD Platform — CLOVA OCR (Template) 도메인 및 Secret Key

### 2. 설치 및 실행
```bash
pip install flask flask-cors requests
```

```bash
# 정적 파일 구조에 맞게 배치 (css/, js/ 폴더 포함)
# 서버 실행
python server.py
# → http://localhost:5000
```

### 3. 로그인 (데모 계정)
```
ID: admin
PW: admin1234
```

### 4. CLOVA OCR 연결
1. NAVER CLOUD Platform에서 CLOVA OCR **Template** 도메인 생성
2. 신청서 양식을 업로드해 **템플릿 영역(필드)** 지정
   - 1장(신청인 정보) / 2장(소농 지급요건)에 각각 템플릿 ID 부여
3. `js/config.js`의 템플릿 ID를 본인 값으로 교체
   ```js
   const CLOVA_TEMPLATE_IDS = { page1: 42351, page2: 42354 };
   ```
4. `server.py`의 `CLOVA_URL`을 발급받은 **APIGW Invoke URL**로 교체
5. 대시보드 우상단 설정 버튼에서 **Secret Key** 입력 (브라우저 로컬에만 저장)

> 템플릿의 필드 이름은 `config.js`의 `FIELD_LABELS` 키(`name`, `residentId`, `appliedArea` 등)와 일치시켜야 합니다.

---

## 화면 구성

| 화면 | 설명 |
|---|---|
| **로그인** | 세션 기반 접근 통제 |
| **대시보드** | 신청서 업로드, 처리 현황 통계, 검수 대기/완료/휴지통 목록 |
| **검수 화면** | 좌측 원본 이미지 + 우측 OCR 추출 폼(색상·돋보기·형식 검증·Human Gate) |
| **완료 목록** | 마스킹된 검수 완료 데이터, 소농 자격 판정, CSV/Excel 내보내기 |

## 라이선스

MIT License (필요에 따라 변경하세요)

---

<p align="center"><i>AI는 의심 지점을 좁혀줄 뿐, 결정은 사람이 한다.</i></p>
