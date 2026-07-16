import json
import re
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / 'direct_payment.db'
SCHEMA_PATH = Path(__file__).resolve().parent / 'schema.sql'

COLUMNS = ['id', 'applicant_name', 'status', 'source', 'assisted_by_staff',
           'reapply_type', 'previous_application_id',
           'uploaded_at', 'completed_at', 'pages_json', 'meta_json']


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with _connect() as conn:
        conn.executescript(SCHEMA_PATH.read_text(encoding='utf-8'))


def _row_to_app(row):
    if row is None:
        return None
    app = {
        'id': row['id'],
        'applicantName': row['applicant_name'],
        'status': row['status'],
        'source': row['source'],
        'assistedByStaff': bool(row['assisted_by_staff']),
        'reapplyType': row['reapply_type'],
        'previousApplicationId': row['previous_application_id'],
        'uploadedAt': row['uploaded_at'],
        'completedAt': row['completed_at'],
        'pages': json.loads(row['pages_json'] or '[]'),
        'meta': json.loads(row['meta_json']) if row['meta_json'] else None,
    }
    if 'deleted_at' in row.keys():
        app['deletedAt'] = row['deleted_at']
    return app


def _app_to_row(app):
    return {
        'id': app['id'],
        'applicant_name': app.get('applicantName'),
        'status': app.get('status', 'review'),
        'source': app.get('source', 'staff'),
        'assisted_by_staff': 1 if app.get('assistedByStaff') else 0,
        'reapply_type': app.get('reapplyType'),
        'previous_application_id': app.get('previousApplicationId'),
        'uploaded_at': app.get('uploadedAt'),
        'completed_at': app.get('completedAt'),
        'pages_json': json.dumps(app.get('pages', []), ensure_ascii=False),
        'meta_json': json.dumps(app['meta'], ensure_ascii=False) if app.get('meta') else None,
    }


def list_applications():
    with _connect() as conn:
        rows = conn.execute(
            'SELECT * FROM applications ORDER BY uploaded_at DESC, id DESC').fetchall()
    return [_row_to_app(r) for r in rows]


def get_application(app_id):
    with _connect() as conn:
        row = conn.execute(
            'SELECT * FROM applications WHERE id = ?', (app_id,)).fetchone()
    return _row_to_app(row)


def insert_application(app):
    row = _app_to_row(app)
    with _connect() as conn:
        conn.execute(
            f"INSERT INTO applications ({', '.join(COLUMNS)}) VALUES ({', '.join('?' * len(COLUMNS))})",
            [row[c] for c in COLUMNS])


def update_application(app_id, updates):
    """updates: 프론트엔드 camelCase 키의 부분 업데이트. 병합 후 저장."""
    app = get_application(app_id)
    if app is None:
        return None
    app.update(updates)
    row = _app_to_row(app)
    sets = ', '.join(f'{c}=?' for c in COLUMNS if c != 'id')
    with _connect() as conn:
        conn.execute(
            f'UPDATE applications SET {sets} WHERE id=?',
            [row[c] for c in COLUMNS if c != 'id'] + [app_id])
    return app


def _digits(value):
    return re.sub(r'\D', '', value or '')


def find_latest_completed_by_resident_id(resident_id):
    """주민번호로 가장 최근 완료 신청서 조회 (재신청자 이전 데이터 불러오기용).
    OCR 값에 마스킹(뒷자리 ******)이 있을 수 있어 앞 7자리 숫자만 비교한다."""
    key = _digits(resident_id)[:7]
    if len(key) < 7:
        return None
    for app in list_applications():  # uploaded_at DESC 정렬 상태
        if app['status'] != 'completed':
            continue
        for page in app['pages']:
            for f in page.get('fields', []):
                if f.get('key') == 'residentId' and _digits(f.get('value'))[:7] == key:
                    return app
    return None


def move_to_trash(app_id, deleted_at):
    with _connect() as conn:
        row = conn.execute(
            'SELECT * FROM applications WHERE id = ?', (app_id,)).fetchone()
        if row is None:
            return False
        conn.execute(
            f"INSERT OR REPLACE INTO trash ({', '.join(COLUMNS)}, deleted_at) "
            f"VALUES ({', '.join('?' * (len(COLUMNS) + 1))})",
            [row[c] for c in COLUMNS] + [deleted_at])
        conn.execute('DELETE FROM applications WHERE id = ?', (app_id,))
    return True


def list_trash():
    with _connect() as conn:
        rows = conn.execute(
            'SELECT * FROM trash ORDER BY deleted_at DESC').fetchall()
    return [_row_to_app(r) for r in rows]


def restore_from_trash(app_id):
    with _connect() as conn:
        row = conn.execute('SELECT * FROM trash WHERE id = ?', (app_id,)).fetchone()
        if row is None:
            return False
        conn.execute(
            f"INSERT OR REPLACE INTO applications ({', '.join(COLUMNS)}) "
            f"VALUES ({', '.join('?' * len(COLUMNS))})",
            [row[c] for c in COLUMNS])
        conn.execute('DELETE FROM trash WHERE id = ?', (app_id,))
    return True


def hard_delete_from_trash(app_id):
    with _connect() as conn:
        conn.execute('DELETE FROM trash WHERE id = ?', (app_id,))


def empty_trash():
    """휴지통 전체 비우기. 삭제된 신청서 id 목록 반환(이미지 정리용)."""
    with _connect() as conn:
        ids = [r['id'] for r in conn.execute('SELECT id FROM trash').fetchall()]
        conn.execute('DELETE FROM trash')
    return ids
