@echo off
title Update NSE TradingView Screener Universe
echo ============================================================
echo   Updating Full NSE Stock Universe (3,000+ Stocks & IPOs)
echo   Source: TradingView Scanner Engine
echo ============================================================
echo.
python fetch_tv_universe.py
echo.
echo ============================================================
echo   Syncing 4-Quarter EPS & Sales Growth for Screened Stocks
echo ============================================================
python sync_exact_financials.py
echo.
echo Complete! screener_stocks.json, exact_quarterly_financials.json & screener_stocks.js updated.
pause
