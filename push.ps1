git rm --cached test_api.js test_or.js
Remove-Item -Path "test_api.js" -ErrorAction SilentlyContinue
Remove-Item -Path "test_or.js" -ErrorAction SilentlyContinue
git commit --amend --no-edit
git push -u origin main
