OR 근무관리 앱 - 파스텔 하늘색 duty 아이콘 업데이트

GitHub 저장소의 기존 파일을 새 파일로 교체하세요. ZIP 자체를 업로드하지 말고, 압축을 푼 폴더 안의 파일/폴더를 저장소 최상위(root)에 업로드합니다.

최상위에 있어야 할 항목:
- index.html
- manifest.webmanifest
- service-worker.js
- icons/ (폴더 안에 icon-192.png, icon-512.png, apple-touch-icon.png)

GitHub 저장소에서 Add file > Upload files로 위 파일과 icons 폴더를 올리고 Commit changes를 누릅니다. 기존 파일이 있으면 같은 경로에 업로드해 덮어씁니다.

배포 후 iPhone Safari에서 사이트를 다시 열고, 홈 화면에 이미 추가한 아이콘은 삭제한 뒤 Safari 공유 > 홈 화면에 추가로 다시 추가하세요. 이미 설치된 PWA는 이전 아이콘을 캐시할 수 있으므로 새로고침/재설치가 필요할 수 있습니다.

참고: 이 앱은 브라우저 저장소(localStorage)를 사용합니다. 실제 근무표나 개인정보를 GitHub에 업로드하지 마세요. 정기적으로 앱 내 백업 기능을 사용하세요.
