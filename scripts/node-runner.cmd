@echo off
setlocal

if not "%TISTORY_BLOG_NODE%"=="" (
  set "NODE_EXE=%TISTORY_BLOG_NODE%"
) else (
  set "NODE_EXE=node"
)

"%NODE_EXE%" %*
exit /b %ERRORLEVEL%
