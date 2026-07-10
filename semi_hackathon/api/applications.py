import shutil
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request

from db import repository

bp = Blueprint('applications', __name__, url_prefix='/api')

UPLOADS_DIR = Path(__file__).resolve().parent.parent / 'uploads'


def _now_kr():
    return datetime.now().strftime('%Y. %m. %d. %H:%M:%S')


def _delete_images(app_id):
    app_dir = UPLOADS_DIR / app_id
    if app_dir.is_dir():
        shutil.rmtree(app_dir, ignore_errors=True)


@bp.get('/applications')
def list_applications():
    return jsonify(repository.list_applications())


@bp.get('/applications/<app_id>')
def get_application(app_id):
    app = repository.get_application(app_id)
    if app is None:
        return jsonify({'error': '신청서를 찾을 수 없습니다'}), 404
    return jsonify(app)


@bp.post('/applications')
def create_application():
    app = request.get_json()
    if not app or not app.get('id'):
        return jsonify({'error': 'id가 필요합니다'}), 400
    repository.insert_application(app)
    return jsonify(repository.get_application(app['id'])), 201


@bp.patch('/applications/<app_id>')
def update_application(app_id):
    updates = request.get_json() or {}
    app = repository.update_application(app_id, updates)
    if app is None:
        return jsonify({'error': '신청서를 찾을 수 없습니다'}), 404
    return jsonify(app)


@bp.delete('/applications/<app_id>')
def delete_application(app_id):
    """휴지통으로 이동 (soft delete)"""
    if not repository.move_to_trash(app_id, _now_kr()):
        return jsonify({'error': '신청서를 찾을 수 없습니다'}), 404
    return jsonify({'ok': True})


@bp.get('/trash')
def list_trash():
    return jsonify(repository.list_trash())


@bp.post('/trash/<app_id>/restore')
def restore_application(app_id):
    if not repository.restore_from_trash(app_id):
        return jsonify({'error': '휴지통에서 찾을 수 없습니다'}), 404
    return jsonify({'ok': True})


@bp.delete('/trash/<app_id>')
def hard_delete(app_id):
    repository.hard_delete_from_trash(app_id)
    _delete_images(app_id)
    return jsonify({'ok': True})


@bp.delete('/trash')
def empty_trash():
    for app_id in repository.empty_trash():
        _delete_images(app_id)
    return jsonify({'ok': True})
