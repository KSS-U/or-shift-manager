OR 근무관리 웹앱 배포 파일

구성
- index.html: 근무관리 앱
- manifest.webmanifest: 홈 화면 설치 정보
- service-worker.js: 오프라인 캐시

무료 배포 예시: GitHub Pages
1. GitHub 계정에 로그인하고 새 저장소(repository)를 만듭니다.
2. 저장소 이름 예: or-shift-manager
3. 이 ZIP의 파일 3개를 저장소 최상위(root)에 업로드합니다.
4. 저장소 Settings > Pages로 이동합니다.
5. Build and deployment에서 Deploy from a branch를 선택합니다.
6. Branch는 main, 폴더는 /(root)로 선택하고 Save를 누릅니다.
7. 공개 주소가 만들어질 때까지 잠시 기다린 뒤 표시된 주소를 Safari에서 엽니다.
8. Safari 공유 버튼 > 홈 화면에 추가를 선택합니다.

주의
- 이 앱은 현재 브라우저의 localStorage에 데이터를 저장합니다.
- 브라우저 데이터 삭제, 기기 변경 시 데이터가 사라질 수 있으므로 앱의 백업 내보내기를 자주 이용하세요.
- 여러 기기 간 자동 동기화 및 로그인 기능은 아직 없습니다.
- 근무표 사진 자동 인식 및 실제 iOS 위젯은 아직 구현되지 않았습니다.
- 직원 근무표는 민감한 내부 정보일 수 있으므로 공개 저장소에는 실제 근무 데이터를 넣지 마세요. 저장소에는 앱 파일만 올리고, 실제 근무표는 앱 안에서 입력하세요.
