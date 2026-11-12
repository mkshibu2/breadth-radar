@echo off
title M.Radar Launcher
echo Starting Unified CORS Local Proxy in background...
start "" /min node proxy.js
echo Opening M.Radar (Market Radar) in browser...
start "" index.html
echo Startup complete.
exit
