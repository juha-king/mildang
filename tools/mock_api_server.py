"""서버 연동을 미리 연습하는 테스트용 HTTP API (실제 ML/GPT 아님).

실행: python tools/mock_api_server.py
프론트엔드 .env: VITE_USE_MOCK=false, VITE_API_BASE_URL=http://localhost:8000
백엔드 조원이 만든 FastAPI 서버를 대체하지 않습니다.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os

HOST = "127.0.0.1"
PORT = int(os.getenv("PORT", "8000"))


def analyze(data):
    try:
        lat = data["latitude"]
        lng = data["longitude"]
        industry = data["industry"]
        radius = data["radius_m"]
        if not all([isinstance(lat, (int, float)), isinstance(lng, (int, float))]):
            return 422, {"status": "error", "error_code": "INVALID_LOCATION", "message": "좌표 형식 오류"}
        if industry not in ("cafe", "korean", "chicken", "snack"):
            return 422, {"status": "error", "error_code": "UNSUPPORTED_INDUSTRY", "message": "미지원 업종"}
        if radius not in (300, 500, 1000):
            return 422, {"status": "error", "error_code": "INVALID_RADIUS", "message": "분석 반경 오류"}
        # 사각형은 테스트 전용. 실제 안양시 행정구역이 아닙니다.
        if not (37.350 <= lat <= 37.440 and 126.895 <= lng <= 126.995):
            return 422, {"status": "error", "error_code": "OUTSIDE_ANYANG", "message": "임시 범위 외부"}
        factor = {"cafe": 1, "korean": 1.25, "chicken": 0.90, "snack": 0.8}[industry]
        sales = round((21000000 + (round(lat * 10000) % 20) * 330000) * factor)
        return 200, {
            "status": "success", "analysis_id": f"mock-http-{industry}-{lat:.5f}-{lng:.5f}",
            "predicted_monthly_sales_krw": sales,
            "sales_unit": "KRW/month", "analysis_level": "HTTP 연동 테스트 · 가상 추정",
            "competitor_count": 13, "estimated_daily_foot_traffic": None,
            "accessibility_score": None, "radius_m": radius,
            "model_name": "MOCK HTTP SERVER", "mock": True,
        }
    except (KeyError, TypeError, ValueError):
        return 422, {"status": "error", "error_code": "INVALID_REQUEST", "message": "필수 입력이 누락되었습니다."}


class Handler(BaseHTTPRequestHandler):
    def _headers(self, status):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "http://localhost:5173")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._headers(204)

    def do_POST(self):
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size > 10240:
                self._headers(413)
                self.wfile.write(b'{}')
                return
            data = json.loads(self.rfile.read(size))
        except (json.JSONDecodeError, ValueError):
            self._headers(400)
            self.wfile.write(b'{"status":"error","error_code":"INVALID_JSON"}')
            return
        if self.path == "/api/analyze":
            status, payload = analyze(data)
        elif self.path == "/api/report":
            if not data.get("analysis_id"):
                status, payload = 422, {"status": "error", "error_code": "INVALID_REQUEST", "message": "analysis_id 필요"}
            else:
                status, payload = 200, {
                    "status": "success", "mock": True,
                    "strengths": "HTTP 연동이 정상 작동합니다. 실제 AI 분석은 아닙니다.",
                    "risks": "가상 매출이므로 실제 의사결정에는 사용할 수 없습니다.",
                    "strategy": "백엔드의 실제 GPT 응답으로 교체해 주세요.",
                }
        else:
            status, payload = 404, {"status": "error", "error_code": "NOT_FOUND"}
        result = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._headers(status)
        self.wfile.write(result)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"테스트 전용 API 서버: http://{HOST}:{PORT}  (종료: Ctrl+C)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
