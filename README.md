# 🎯 마케팅 용어 빙고

3-1 프로모션 기획 ~ 3-5 VIP 마케팅 용어 30개로 하는 단어 맞추기 빙고 웹앱입니다.

- 개인전 또는 2~6조 대항, 1~5줄 빙고, 문제당 제한 시간 선택
- 초성과 설명을 보고 정답 입력 → 정답이면 폭죽 🎆, 오답·시간 초과면 폭탄 💥
- 오답을 낸 조는 그 문제를 다시 맞힐 수 없습니다
- 💡 힌트(한 글자씩 공개), ↩ 패스(나중에 다시 출제), 📋 단어 목록(선생님 확인용)

## 실행
```bash
npm start   # http://localhost:3000
```

## Railway 배포
Railway에서 **New Project → Deploy from GitHub repo** 로 이 저장소를 고르면 됩니다.
`railway.json`에 시작 명령(`node server.js`)과 헬스체크(`/health`)가 들어 있습니다.
배포 후 Settings → Networking → **Generate Domain**을 누르면 접속 주소가 생깁니다.
