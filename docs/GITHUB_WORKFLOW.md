# 팀 GitHub 협업 가이드

## 추천 저장소 구조

```text
startup-ai-team/
├── frontend/       # 이 ZIP 내부의 파일 전체를 여기에 복사
├── backend/        # 조원의 FastAPI
├── ml/             # 다른 조원의 모델 학습 코드
└── README.md
```

**주의:** `frontend/frontend/`처럼 폴더가 이중으로 들어가지 않도록 복사합니다. `frontend/` 아래에 `package.json`이 바로 보여야 합니다.

## 처음 작업할 때

팀장 또는 한 사람이 GitHub에서 공용 저장소를 만들고 팀원들을 협업자로 초대합니다. 이미 저장소가 있다면 새로 만들 필요가 없습니다.

```bash
git clone https://github.com/팀이름/저장소이름.git
cd 저장소이름
```

다운받은 프론트엔드 프로젝트 파일을 **`frontend/` 폴더**로 복사합니다 (`node_modules`, `dist`, `.env` 제외).

```bash
git checkout -b feat/frontend-ready
git add frontend
git commit -m "feat(frontend): complete pre-integration UI"
git push -u origin feat/frontend-ready
```

그 후 GitHub에서 Pull Request를 열어 팀원에게 리뷰받고 `main` 브랜치에 병합합니다.

## 이후 매일 작업할 때

```bash
git checkout main
git pull origin main
git checkout -b feat/frontend-개선할기능
```

작업 후:

```bash
cd frontend
npm test
npm run build
cd ..
git add frontend
git commit -m "feat(frontend): describe change"
git push -u origin feat/frontend-개선할기능
```

GitHub Pull Request로 병합합니다. 직접 `main`에 여러 명이 동시에 수정하는 것은 충돌 가능성이 커서 권장하지 않습니다.

## 백엔드가 준비된 뒤

- 프론트엔드 담당자와 백엔드 담당자가 `docs/API_CONTRACT.md`부터 검토합니다.
- 프론트엔드의 `.env`에서 API URL을 설정합니다.
- 백엔드 담당자는 CORS 개발용 출처에 `http://localhost:8000`을 추가합니다.
- 요청/응답 구조를 변경하면 API 문서를 먼저 수정하고, 두 사람이 함께 관련 코드를 수정합니다.
- `.env`, API 비밀키, 대용량 원본 CSV와 모델 파일은 공개 저장소에 업로드하지 않습니다.
