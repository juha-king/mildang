# juha — LOCALLY AI 창업 입지 시뮬레이터

**프론트엔드 v1.0 · 백엔드 API 통합 직전 단계**

React + Vite + React Leaflet 기반 대시보드로, 업종·안양시 위치를 선택해 예시 매출을 분석하고 후보지를 비교하는 웹사이트입니다.

> ⚠️ **현재 제공되는 매출, 유동인구, 경쟁업체, 접근성 및 GPT 리포트는 실제 측정·예측 결과가 아닙니다.** 백엔드의 ML/GPT 모델과 연결하기 전에 UI를 시험하기 위한 가상 응답입니다. 임시 사각형은 실제 안양시 행정구역이 아닙니다.

## 1. 실행하기 (프론트엔드 담당자)

1. [Node.js LTS](https://nodejs.org/) 설치
2. 이 프로젝트 폴더를 VS Code에서 열기
3. VS Code 메뉴 **터미널 → 새 터미널**
4. 아래 명령어 입력

```bash
npm install
npm run dev
```

5. 웹브라우저에서 **http://localhost:8000** 접속
6. 업종 선택 → 지도 클릭 또는 '빠른 위치 선택' → **AI 입지 분석하기** 클릭 → **후보지 저장** → **리포트 생성하기**

종료는 터미널에서 `Ctrl + C`. React/Vite이므로 HTML 파일만 더블클릭하면 실행되지 않습니다.

### 자동 테스트

```bash
npm test
npm run build
```

`npm test`는 React 패키지 설치 전에라도 실행할 수 있도록 Node.js 기본 테스트 도구만 사용합니다. `npm run build`는 `npm install`이 성공해야 실행됩니다.

## 2. 기능 완성 범위

| 기능 | 구현 |
|---|---|
| 업종 선택, 클릭 위치/좌표 선택, 분석 반경 | ✅ |
| 지도 표시, 위치 마커, 반경 표시 | ✅ OpenStreetMap / Leaflet 기본 |
| 카카오맵 선택형 구현 | ✅ 키·웹 도메인 설정 후 사용 가능 (실행 검증 필요) |
| 안양시 범위 판정 | ✅ 폴리곤 GeoJSON 처리 코드 / 실제 경계 파일 미설치 |
| 경계선 클릭 포함 규칙 | ✅ 단위 테스트 |
| 분석 로딩, 취소, 잘못된 입력, 오류 메시지 | ✅ |
| 예상 월매출, 경쟁 점포, 유동인구, 접근성 화면 | ✅ 예시 데이터 |
| 없거나 `null`인 선택 지표 → '자료 없음' | ✅ |
| 후보지 저장·삭제·비교 그래프 | ✅ 업종/반경/데모 모드별 최대 3개 |
| 페이지 새로고침 후 비교 후보 유지 | ✅ 현재 탭의 `sessionStorage` (탭을 닫으면 삭제) |
| 별도 GPT 리포트 요청·결과 | ✅ 예시 응답 |
| HTTP JSON 요청·응답 타입 검증 | ✅ |
| 서버 없이 에러 상황 테스트 UI | ✅ |
| 실제 ML 예측 / 실제 GPT / 실제 카카오 장소 검색 | ❌ 백엔드 및 모델 담당 작업 |
| 최신 공식 안양시 경계 데이터 | ❌ 데이터 확보·검증 필요 |

## 3. 폴더 구조

```text
locally-frontend-ready/
├── index.html
├── package.json
├── .env.example              # 환경변수 견본
├── src/
│   ├── main.jsx              # React 진입
│   ├── App.jsx               # 화면 및 사용자 흐름
│   ├── styles.css            # UI 스타일
│   ├── components/
│   │   ├── AnyangMap.jsx     # Leaflet / 카카오맵 선택
│   │   └── KakaoMap.jsx      # 카카오맵 JS API (옵션)
│   ├── services/
│   │   ├── api.js            # 분석/GPT Mock ↔ 실서버 전환
│   │   └── http.js           # 요청·오류·타임아웃
│   └── lib/
│       ├── contracts.js      # 업종/JSON 검증, 금액 표시
│       ├── geo.js            # 지도 범위 및 폴리곤 포함 판정
│       └── history.js        # 브라우저에 후보지 저장
├── public/boundary/          # 안양시 공식 GeoJSON 추가 위치
├── tests/                    # npm test
├── tools/mock_api_server.py  # 서버 통신 연습용, 실제 백엔드 아님
└── docs/
    ├── API_CONTRACT.md      # 백엔드 조원에게 반드시 전달
    ├── QA_CHECKLIST.md      # 직접 클릭하며 검증할 항목
    ├── BEGINNER_GUIDE.md    # 파일별 읽는 순서/연습 방법
    └── GITHUB_WORKFLOW.md   # 팀 GitHub 작업 방식
```

분석 결과와 비교 후보는 백엔드 계정에 저장되지 않습니다. 비교 후보는 현재 브라우저 탭의 `sessionStorage`에만 보관되며, 탭을 닫으면 사라집니다.

## 4. 백엔드 연동 구조

- 화면은 `src/services/api.js`의 `analyzeLocation` 및 `generateReport`만 호출합니다.
- `VITE_USE_MOCK=true`이면 시연 응답을 사용하고, `false`이면 `VITE_API_BASE_URL`의 `/api/analyze`, `/api/report`로 요청합니다.
- `src/services/http.js`가 JSON 전송, 타임아웃, 취소 및 서버 오류를 처리하고, `src/lib/contracts.js`가 요청/응답 필드와 타입을 검증합니다.
- API 경로나 필드가 확정되면 서비스와 계약 검증, `docs/API_CONTRACT.md`, `docs/fixtures/`를 함께 갱신합니다. 화면 컴포넌트는 API 세부사항을 직접 다루지 않도록 유지합니다.

## 5. 백엔드 없이 화면 테스트

기본값은 코드에서 Mock(가짜 API)을 사용하도록 설정돼 있습니다. `.env`가 없어도 작동합니다.

창업 조건 설정창 아래쪽의 **'개발자 테스트 · 오류 상황 확인'**을 펼치면 데이터 없음, 모델 실패, 응답 형식 오류, 느린 응답, GPT 오류를 재현할 수 있습니다.

모든 시험 값은 가짜 데이터입니다.

## 6. HTTP 통신까지 먼저 시험하기

실제 백엔드가 개발되기 전에 요청/응답이 오가는 것만 검증하고 싶다면:

1. `.env.example` 파일을 복사하여 `.env` 생성
2. `.env`에 다음 내용 설정

```env
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8001
VITE_MAP_PROVIDER=osm
```

3. **새 터미널**에서 Python 표준 라이브러리 기반 테스트 서버 실행

```bash
python tools/mock_api_server.py
```

4. 다른 터미널에서 `npm run dev` 재시작
5. 지도에서 위치 선택 후 분석하여 HTTP 연결 검증

이 Python 서버는 실제 모델 예측/API가 아닙니다. 백엔드 조원의 FastAPI가 준비되면 **테스트 서버를 끄고 FastAPI를 실행**하면 됩니다. API 필드와 오류 형식은 `docs/API_CONTRACT.md`에 정의돼 있습니다.

## 7. 카카오맵으로 교체하기

현재는 별도 키 없이 실행 가능한 OpenStreetMap/Leaflet 지도를 기본으로 사용합니다. 팀이 원래 기획한 카카오맵으로 교체할 때는 다음처럼 환경변수를 설정하세요.

```env
VITE_MAP_PROVIDER=kakao
VITE_KAKAO_MAP_JS_KEY=카카오_웹_JavaScript_키
```

- 카카오 개발자 콘솔에서 **JavaScript 키와 웹 도메인**(`http://localhost:8000` 및 배포한 Vercel 도메인 등)을 등록해야 합니다.
- 카카오 JavaScript 키는 브라우저에서 SDK를 불러오기 위해 사용되는 클라이언트 키로, `VITE_` 환경변수이므로 브라우저에 노출됩니다. 도메인 제한을 적용하세요.
- **GPT API 키, 카카오 REST API 비밀키**는 여기에 넣지 않고 반드시 백엔드에서 관리하세요.
- 환경변수를 바꾸면 `npm run dev`를 재시작하세요.

## 8. 실제 안양시 경계 연결

`public/boundary/anyang.geojson` 파일이 있으면 자동으로 불러와 지도에 폴리곤을 표시하고 범위 판정에 사용합니다. 없을 때 Mock 모드에서는 **임시 사각형**, 실제 API 모드에서는 백엔드 판정이 최종 기준입니다.

- 파일은 WGS84(EPSG:4326)의 `Polygon`/`MultiPolygon`/`FeatureCollection` GeoJSON이어야 합니다.
- 실제 경계 데이터의 **원천, 기준 일자, 좌표계**를 확인해야 하며, 임의의 직사각형을 실제 시 경계로 사용하지 않습니다.
- 경계선 위 좌표를 내부로 취급하는 폴리곤 판정 로직에 단위 테스트가 있습니다.
- 백엔드도 반드시 같은 행정구역 경계를 별도로 검증해야 합니다.

## 9. 팀원과 공유할 것

- 백엔드 담당자: **`docs/API_CONTRACT.md`** 와 **`docs/fixtures/`**
- 전체 팀: **`docs/GITHUB_WORKFLOW.md`**
- 프론트 담당자: **`docs/QA_CHECKLIST.md`**, **`docs/BEGINNER_GUIDE.md`**

## 10. 팀 공유용 웹사이트 배포 (Vercel)

저장소를 Vercel에 연결하면 `main` 브랜치가 갱신될 때마다 빌드·배포되고 공유 URL이 생성됩니다.

1. Vercel에서 **Add New → Project**를 선택하고 GitHub 저장소 `ysr4tb92th-maker/juha`를 가져옵니다.
2. Framework Preset은 **Vite**, Build Command는 `npm run build`, Output Directory는 `dist`로 설정합니다.
3. 현재는 시연 데이터를 사용하므로 별도 환경변수 없이 배포할 수 있습니다. 카카오맵을 쓸 경우 환경변수 `VITE_MAP_PROVIDER=kakao`, `VITE_KAKAO_MAP_JS_KEY`를 Vercel Project Settings → Environment Variables에 추가합니다.
4. 배포가 끝나면 Vercel의 도메인(예: `https://<프로젝트명>.vercel.app`)을 팀원과 공유하고, 카카오 개발자 콘솔의 JavaScript 키 허용 도메인에도 추가합니다.
5. 실제 백엔드를 연결할 때만 `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=https://<공개-백엔드-주소>`를 설정하고, 백엔드 CORS에 배포 도메인을 허용합니다. `localhost` 주소는 배포 환경에서 사용할 수 없습니다.

프런트엔드 개발 서버는 `http://localhost:8000`, 백엔드 개발 API는 `http://localhost:8001`을 사용합니다. 두 서버의 포트는 서로 다릅니다.

현재 API 규격은 **초안**입니다. 실제 데이터의 업종, 예측 단위, 지원 반경, 제공 가능한 통계가 확정되면 조원과 API 문서를 함께 수정하세요.
