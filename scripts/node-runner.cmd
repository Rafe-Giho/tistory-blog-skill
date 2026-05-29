@echo off
setlocal EnableExtensions

if not "%TISTORY_BLOG_NODE%"=="" if exist "%TISTORY_BLOG_NODE%" (
  set "NODE_EXE=%TISTORY_BLOG_NODE%"
  goto run
)

rem Prefer Node bundled with Codex-like desktop installs before PATH. PATH can point
rem to WindowsApps aliases that fail with "Access is denied" in sandboxed shells.
for %%N in (
  "%LOCALAPPDATA%\Programs\Codex\resources\app\node.exe"
  "%LOCALAPPDATA%\Programs\Codex\resources\app.asar.unpacked\node.exe"
  "%LOCALAPPDATA%\Programs\Codex\node.exe"
  "%PROGRAMFILES%\Codex\resources\app\node.exe"
  "%PROGRAMFILES%\nodejs\node.exe"
  "%PROGRAMFILES(X86)%\nodejs\node.exe"
) do (
  if exist "%%~N" (
    set "NODE_EXE=%%~N"
    goto run
  )
)

set "NODE_EXE=node"

:run
"%NODE_EXE%" %*
exit /b %ERRORLEVEL%
