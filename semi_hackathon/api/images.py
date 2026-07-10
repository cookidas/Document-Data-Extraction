import base64
import re
from pathlib import Path

from flask import Blueprint, jsonify, request, send_file

bp = Blueprint('images', __name__, url_prefix='/api')

UPLOADS_DIR = Path(__file__).resolve().parent.parent / 'uploads'

# data URL 형식: data:image/jpeg;base64,....
DATA_URL_RE = re.compile(r'^data:image/(\w+);base64,(.+)$', re.DOTALL)

MIME_BY_EXT = {'jpeg': 'image/jpeg', 'jpg': 'image/jpeg',
               'png': 'image/png', 'gif': 'image/gif', 'bmp': 'image/bmp'}


def _page_path(app_id, page_index):
    """저장된 페이지 이미지 파일 경로 탐색 (확장자 무관)"""
    app_dir = UPLOADS_DIR / app_id
    for ext in MIME_BY_EXT:
        p = app_dir / f'p{page_index}.{ext}'
        if p.is_file():
            return p
    return None


@bp.post('/applications/<app_id>/pages/<int:page_index>/image')
def upload_image(app_id, page_index):
    data_url = (request.get_json() or {}).get('dataURL', '')
    m = DATA_URL_RE.match(data_url)
    if not m:
        return jsonify({'error': 'dataURL 형식이 아닙니다'}), 400
    ext, b64 = m.group(1).lower(), m.group(2)
    if ext not in MIME_BY_EXT:
        return jsonify({'error': f'지원하지 않는 이미지 형식: {ext}'}), 400

    app_dir = UPLOADS_DIR / app_id
    app_dir.mkdir(parents=True, exist_ok=True)
    (app_dir / f'p{page_index}.{ext}').write_bytes(base64.b64decode(b64))
    return jsonify({'ok': True})


@bp.get('/applications/<app_id>/pages/<int:page_index>/image')
def get_image(app_id, page_index):
    path = _page_path(app_id, page_index)
    if path is None:
        return jsonify({'error': '이미지가 없습니다'}), 404
    return send_file(path, mimetype=MIME_BY_EXT[path.suffix[1:]])
