# Signal Room

# 주식 종목을 여러 관점으로 비교하여 투자 판단을 돕는 AI 주식 정보 웹페이지

`Signal Room`은 사용자가 특정 종목을 선택하면, 여러 투자 성향의 AI 페르소나가 같은 데이터를 두고 토론을 진행하고, 그 결과를 타이밍 카드와 최종 리포트로 정리해 보여주는 웹 서비스입니다.  
핵심은 단순히 답을 주는 것이 아니라, **서로 다른 관점이 충돌하는 판단 과정을 직접 보여주는 것**에 있습니다.

**비 로그인**으로 없이 누구나 메인 페이지에서 시장 흐름을 보고, 종목을 검색하고, AI 토론을 생성하거나 다시 재생할 수 있습니다.

# 실행
```
npm install
npm run dev
```

.env 또는 .env.local에 환경변수를 넣어 사용할 수 있습니다. API 키가 없어도 mock fallback으로 기본 화면과 분석 플로우는 동작합니다.

# 환경변수
```
LLM_PROVIDER=mock
GUARD_MODE=off | monitor | enforce
TWELVE_DATA_API_KEY
NAVER_CLIENT_ID
NAVER_CLIENT_SECRET
OPEN_DART_API_KEY
KIS_APP_KEY
KIS_APP_SECRET
```

테스트
```
npm test
npm run typecheck
```