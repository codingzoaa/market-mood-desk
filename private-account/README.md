# 개인 계좌 분석 (격리형 베타)

이 폴더는 공개 GitHub Pages에 포함되지 않는 별도 개인용 계좌 분석 서비스의 설계·검토 자료입니다. 실제 실행 가능한 전체 Python 서버·UI 소스와 테스트용 자료는 이번 대화의 `private-account-dashboard.zip`에 있습니다. ZIP 소스는 리뷰 및 보안 점검 후 별도 사설 배포하세요.

## 현재 경계

- Market Mood Desk의 기존 디자인 토큰(숲색 #173c32, 연두색 #d6e98e, 배경 #f5f6f2)을 사용합니다.
- 소스는 공개되어도 계좌 데이터베이스, CSV, 비밀번호, LS App Secret, 인증 쿠키는 저장소에 넣지 않습니다.
- 계좌정보 조회는 별도의 **127.0.0.1 로컬 서버**에서만 수행합니다. 공개 사이트와 D1/Worker를 그대로 유지합니다.
- 로그인 상태는 서버의 세션으로 판단합니다. 프런트엔드에서 숨기는 것만으로는 개인정보를 보호하지 못합니다.
- 원격 접속이나 공개 사이트 내 개인 메뉴 연결은 **미구현**입니다. 추후 별도 도메인, TLS, Cloudflare Access를 서버 측에 구성한 뒤, Access 권한과 원본 API 인증을 검증해야 합니다.

## 로컬 실행

```powershell
$env:ACCOUNT_PASSWORD = Read-Host '12자 이상 비밀번호'
$env:ACCOUNT_DB = 'C:\\private-data\\private_trades.sqlite3'
python server.py
```

원본 구현은 다운로드 ZIP을 기준으로 검토합니다. 기존 `trade_risk.py`를 같은 폴더에 놓으면 분석 엔진을 재사용합니다. 계좌 원본은 별도 개인 경로에 둡니다.

## 미완료

실제 LS API 계좌 거래내역 수집, 개인 전용 HTTPS 배포, Cloudflare Access 구성, 운영 사이트 내비게이션 연결, 실계좌 수치 검증은 완료되지 않았습니다. 본 PR은 기존 운영 사이트를 변경하지 않습니다.
