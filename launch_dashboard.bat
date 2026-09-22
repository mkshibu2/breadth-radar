@echo off
title NSE Breadth Radar Launcher
echo Starting Unified CORS Local Proxy in background...
start "" /min node proxy.js
echo Opening Dashboard in browser...
[start index.html]
echo Startup complete.
exit
