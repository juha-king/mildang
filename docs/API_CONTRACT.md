# LOCALLY — 프론트엔드/백엔드 API 계약서 v1 (합의용)

> **계약서 초안**입니다. 모델 팀의 학습 데이터/타깃을 확인한 뒤 두 개발자가 확정해야 합니다.
> 예제 매출은 가상 값이며 실제 모델 검증이 끝났다는 뜻이 아닙니다.

## 기본 규칙

- Base URL: `http://localhost:8000` (개발용), `/api/...` (경로)
- 형식: `application/json; charset=utf-8`, UTF-8
- 위치 좌표: 위도(`latitude`), 경도(`longitude`), WGS84/EPSG:4326
- 반경: `radius_m`, 정수 미터 (`300`, `500`, `1000`은 **현재 프론트엔드 임시 옵션**)
- 매출: **KRW/month**, 서버는 **원 단위의 숫자**로 반환, 프론트에서 만원 단위로 표시
- 오류: 오류 시 4xx/5xx HTTP 코드와 공통 JSON 응답
- React 개발 서버 `http://localhost:5173` 를 FastAPI CORS 허용 출처에 추가
- GPT, 지도 장소 검색용 비밀키는 백엔드에서 관리. 브라우저에 보내지 않음
- **반경이 모델 입력인지, 주변 시설 검색에만 사용되는지 결정 필요.**

## API #1 · POST /api/analyze

프론트엔드 요청 예시 (`docs/fixtures/analyze-request.json`):

```json
{
  "industry": "cafe",
  "latitude": 37.389,
  "longitude": 126.952,
  "radius_m": 500
}
```

`industry`의 임시 허용값:

| 코드 | 화면 표시 | 확정 여부 |
|---|---|---|
| `cafe` | 카페 · 디저트 | ❌ 데이터 확인 전 |
| `korean` | 한식 음식점 | ❌ 데이터 확인 전 |
| `chicken` | 치킨 · 패스트푸드 | ❌ 데이터 확인 전 |
| `snack` | 분식 · 간편식 | ❌ 데이터 확인 전 |

성공 시 **HTTP 200** 응답 예시 (`docs/fixtures/analyze-response.json`):

```json
{
  "status": "success",
  "analysis_id": "analysis-123",
  "predicted_monthly_sales_krw": 28500000,
  "sales_unit": "KRW/month",
  "analysis_level": "상권별 예상 매출 예시",
  "competitor_count": 18,
  "estimated_daily_foot_traffic": null,
  "accessibility_score": null,
  "radius_m": 500,
  "model_name": "XGBoost",
  "mock": false
}
```

| 필드 | 타입 | 필수 여부 | 참고 |
|---|---|---|---|
| `status` | string | 필수 | `success` |
| `analysis_id` | string | 필수 | GPT 리포트 요청 시 사용. 비어 있으면 안 됨 |
| `predicted_monthly_sales_krw` | number | 필수 | 0 이상의 숫자. 문자열로 보내지 말 것 |
| `sales_unit` | string | 필수 | 반드시 `KRW/month` |
| `analysis_level` | string | 선택 | 점포/상권/행정동 중 무엇인지 반드시 설명하는 것을 추천 |
| `competitor_count` | number/null | 선택 | 제공 불가 시 `null` 또는 필드 생략, 0과 다름 |
| `estimated_daily_foot_traffic` | number/null | 선택 | 상기 동일 |
| `accessibility_score` | number/null | 선택 | 점수의 정의/산식은 별도 합의 필요 |
| `radius_m` | number | 선택 | 서버 결과에 적용된 반경 |
| `model_name` | string | 선택 | 알고리즘 이름/버전 권장 |
| `mock` | boolean | 선택 | 테스트 서버 시 `true`, 실제 예측 시 `false` |

데이터가 없을 때 `predicted_monthly_sales_krw:0` 또는 임의값을 반환하지 않고 아래 **DATA_UNAVAILABLE** 오류를 반환해야 합니다.

## API #2 · POST /api/report

기본 매출 분석에 성공한 뒤 **별도 버튼**을 눌렀을 때 요청합니다.

```json
{
  "analysis_id": "analysis-123",
  "industry": "cafe",
  "latitude": 37.389,
  "longitude": 126.952
}
```

성공 시 HTTP 200 응답:

```json
{
  "status": "success",
  "strengths": "모델/실제 주변 지표에 근거한 장점",
  "risks": "근거를 포함한 주의점",
  "strategy": "창업 준비 시 실행 가능한 전략",
  "mock": false
}
```

`strengths`, `risks`, `strategy`는 빈 문자열이 아닌 문자열. GPT가 실제 데이터에 없는 통계나 매출을 지어내지 않도록 백엔드에서 프롬프트/근거 데이터를 관리합니다.

## 오류 규약

모든 오류 응답은 `{status, error_code, message}` 세 필드를 포함합니다.

```json
{
  "status": "error",
  "error_code": "OUTSIDE_ANYANG",
  "message": "안양시 외부 지역입니다."
}
```

| HTTP | error_code | 상황 |
|---|---|---|
| 422 | `OUTSIDE_ANYANG` | 행정구역 외부 또는 경계 판정 실패 |
| 422 | `UNSUPPORTED_INDUSTRY` | 미지원 업종 |
| 422 | `INVALID_LOCATION` | 좌표 타입/범위 오류 |
| 422 | `INVALID_RADIUS` | 반경 미지원 |
| 404/422 | `DATA_UNAVAILABLE` | 예측에 필요한 데이터 없음 |
| 503 | `MODEL_UNAVAILABLE` | 예측 모델 로드/실행 실패 |
| 500 | `SERVER_ERROR` | 알 수 없는 서버 오류 |

프론트엔드에는 HTTP 연결 실패, 15초 타임아웃, 서버 응답 필수 필드 누락에도 안내 메시지가 나옵니다.

## 서버와 연결하는 방법

1. `.env.example` → `.env` 복사
2. `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=http://localhost:8000`
3. 먼저 `python tools/mock_api_server.py`로 **테스트 서버**와 HTTP 연결 확인
4. 그다음 실제 FastAPI 서버로 교체, 필드 불일치 여부 확인
5. 실제 행정구역 GeoJSON과 백엔드 공간 판정이 같은 기준인지 검증

## 팀 회의에서 **반드시** 확정할 미결정 사항

1. 모델 타깃은 상권별 월평균 매출인가, 점포 매출인가?
2. 클릭한 좌표를 어떤 행정동/상권/격자 데이터로 변환할 것인가?
3. 지원 업종 코드 매핑과 데이터셋의 업종 분류
4. `radius_m`가 모델 입력인지, 주변 점포 검색 반경인지, 사용하지 않는지
5. 경쟁업체/유동인구/접근성 지표의 정의, 수집 원천 및 제공 여부
6. 실제 안양시 행정구역 GeoJSON의 원천·기준 날짜·좌표계와 경계선 포함 규칙
7. 매출 단위, 검증 성능, 분석 기준/모델 버전
8. 긴 응답이나 실패 시 재시도/요청 상한 정책

**위의 미결정 항목을 임의로 구현하면, 화면이 작동해도 실제 AI 서비스를 정확하게 표현하지 못할 수 있습니다.**
