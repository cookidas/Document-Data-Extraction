from pathlib import Path

from flask import Flask, redirect, send_from_directory
from flask_cors import CORS

from api.applications import bp as applications_bp
from api.images import bp as images_bp
from api.ocr import bp as ocr_bp
from db.repository import init_db

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__, static_folder=None)
CORS(app)

init_db()
app.register_blueprint(applications_bp)
app.register_blueprint(images_bp)
app.register_blueprint(ocr_bp)


@app.route('/')
def root():
    return redirect('/staff/index.html')


@app.route('/staff/<path:filename>')
def staff_files(filename):
    return send_from_directory(BASE_DIR / 'staff', filename)


@app.route('/citizen/<path:filename>')
def citizen_files(filename):
    return send_from_directory(BASE_DIR / 'citizen', filename)


@app.route('/shared/<path:filename>')
def shared_files(filename):
    return send_from_directory(BASE_DIR / 'shared', filename)


if __name__ == '__main__':
    print('서버 시작: http://localhost:5000')
    print('  담당자: http://localhost:5000/staff/index.html')
    print('  신청자: http://localhost:5000/citizen/apply.html')
    app.run(host='0.0.0.0', port=5000, debug=True)
