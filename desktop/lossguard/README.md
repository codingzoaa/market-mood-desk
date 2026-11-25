# 마켓노트 LS 손실 감지기 0.1.0

Windows 10/11 64비트용 신규 구현. 원본 KiwoomLossGuard.exe를 수정한 파일이 아니며 LS OPEN API로 국내주식 계좌 집계를 조회한다. 키움 로그인·OpenAPI+·HTS 설치가 필요하지 않다. 주문·자동 청산·PC 강제 종료 기능은 없다.

## 사용
1. ZIP을 압축 해제하고 MarketnoteLSLossGuard.exe 실행.
2. LS 연결 탭에 본인 국내주식 계좌에 연결된 LS OPEN API APP KEY와 APP SECRET 입력. `Windows 자격 증명에 저장`을 누르면 Windows Credential Manager에 저장한다. 채팅·메일에 키를 전송하지 않는다.
3. 손실·경고 설정에서 기본값(최초 순자산3%, 사전80%, 한도5분 반복)을 확인하고 저장.
4. 감시 시작. 최소화 상태에서도30초마다 조회한다. PC 절전·프로그램 종료·인터넷 단절 시 감시 불가.

**마켓노트 시세 수집과 같은 앱키를 동시에 사용하지 마세요.** 서로 다른 IP에서 OAuth를 발급하면 기존 수집 인증에 영향을 줄 수 있다. 별도 LS 감시용 앱키를 사용한다. 별도 키가 없으면 기존 시세 수집과 겹치지 않는 시간에만 실행한다.

- `realized`: 당일 실현손익.
- `combined`: 실현손익 + 현재 평가손익 − 최초 관측 평가손익.
- `percent`: 당일 최초 순자산 비율, `fixed`: 고정 원화 금액.
- 오후 기준 기본11:00. 지연 시작 시 관측 시각을 표시하며, 정확한11:00값이라고 간주하지 않는다.
- 오후 체결 주문 주의10회·강한 경고20회. 부분 체결·정정은 원주문 기준1회. 원주문 누락이나 조회 미완료이면 확인 불가.
- 수익 반납 주의30%·강한 경고50%. 오후 기준 실현수익이 양수일 때 계산.
- 조회3회 연속 실패 경고, 최대90일 마지막 관측값 기록, 최근20일 평균.
- 감시 상태·설정·손익은 `%LOCALAPPDATA%\MarketnoteLSLossGuard\state.dpapi`에 현재 Windows 사용자 DPAPI로 암호화 저장. 키는 Windows 자격 증명 관리자에 별도 저장. 마켓노트 웹과 기록은 자동 동기화하지 않는다.

웹의 계좌분석 열기 버튼은 로그인 없는 계좌분석 페이지를 연다. 웹은 페이지가 보이는 동안만 감시하며, 프로그램과 웹에서 같은 계좌를 각각 감시하면 경고가 중복될 수 있다.

## 소스 실행 / 빌드
Python3.11 이상, Windows:
```
python -m pip install -r requirements.txt
python -m unittest test_lossguard.py test_windows.py
python app.py
python -m PyInstaller --onefile --windowed --name MarketnoteLSLossGuard --collect-all keyring --hidden-import keyring.backends.Windows app.py
```

실계좌 손익은 첫 실행 때 LS HTS 같은 계좌의 실현손익·평가손익과 대조한다. 프로그램의 수치는 관측 시점 기준이며 당일 입출금·신용·타자산을 조정한 계좌 수익률이 아니다. 최초 기준을 다시 잡으면 당일 평가 변화·순자산 기준이 달라진다. 원본 프로그램의 음성·이미지는 포함하지 않았으며 Windows 경고음을 사용한다. 실행파일은 코드서명하지 않은 신규 빌드다.

공식 명세: https://openapi.ls-sec.co.kr/api/apis/public/tr-guides.json?download=true
