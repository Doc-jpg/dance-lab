@echo off
REM Dance Lab, local copy. Opens http://localhost:4177 . The live address is simpler once published.
cd /d "%~dp0"
where node >nul 2>nul && (start "" http://localhost:4177 & node server.cjs & goto :eof)
where python >nul 2>nul && (start "" http://localhost:4177 & cd dist & python -m http.server 4177 & goto :eof)
echo Node or Python is needed to run the local copy. Open the live address instead.
pause
