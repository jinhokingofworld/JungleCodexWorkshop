# Signal Room

무로그인 공개형 주식 AI 토론 웹서비스 프로토타입입니다.

## 주요 기능

- 홈 대시보드: 시장 요약, 인기 종목, 인기 분석, 최근 공개 분석
- 공개 게시판: 다른 사용자가 만든 분석을 인기순/최신순으로 다시 보기
- 종목 분석 페이지: AI 전문가 토론, 타이밍 카드, 근거 패널, 최종 리포트
- SSE 기반 토론 재생: 사람이 읽기 좋은 속도로 메시지 스트리밍
- `GUARD_MODE` 기반 보호 모드 분리: 테스트 단계에서는 기본 `off`

## 실행

```bash
npm install
npm run dev
```

`.env` 또는 `.env.local`에 환경변수를 넣어 사용할 수 있습니다. 기본값이 필요하면 `.env.example`을 참고하면 되고, API 키가 없어도 mock fallback으로 기본 화면과 분석 플로우는 동작합니다.

## 환경변수

- `LLM_PROVIDER=mock`
- `GUARD_MODE=off | monitor | enforce`
- `ALPHA_VANTAGE_API_KEY`
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `OPEN_DART_API_KEY`
- `KIS_APP_KEY`
- `KIS_APP_SECRET`

## 테스트

```bash
npm test
npm run typecheck
```
