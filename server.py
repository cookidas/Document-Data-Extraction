from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

CLOVA_URL = 'https://45fw7pqzt7.apigw.ntruss.com/custom/v1/54446/86c6eb930b0f6b09d7f7635f42e52fb3dbd5dbdeb15d842c539c83397eca358c/infer'

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/ocr', methods=['POST'])
def ocr_proxy():
    secret = request.headers.get('X-OCR-SECRET', '')
    if not secret:
        return jsonify({'error': 'Secret Key가 없습니다'}), 400
    try:
        resp = requests.post(
            CLOVA_URL,
            headers={'X-OCR-SECRET': secret, 'Content-Type': 'application/json'},
            json=request.get_json(),
            timeout=30
        )
        return jsonify(resp.json()), resp.status_code
    except requests.exceptions.Timeout:
        return jsonify({'error': 'OCR 요청 시간 초과'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print('서버 시작: http://localhost:5000')
    app.run(port=5000, debug=True)
