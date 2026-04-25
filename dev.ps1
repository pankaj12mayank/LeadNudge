# LeadNudge: optional install, then backend + frontend in one PowerShell window.
# Use start.bat for full setup (venv, pip, npm, verify); it calls this script with -SkipInstall.
param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

function HaveCmd([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

$PyExe = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $PyExe)) {
    $PyExe = Join-Path $Root "backend\.venv\Scripts\python.exe"
}
if (-not (Test-Path $PyExe)) {
    $PyExe = "python"
}

if (-not $SkipInstall) {
    if (-not (HaveCmd "python")) {
        Write-Error "Python is not on PATH. Install Python 3.11+ and retry."
    }
    if (-not (HaveCmd "npm")) {
        Write-Error "npm is not on PATH. Install Node.js LTS and retry."
    }

    if (-not (Test-Path (Join-Path $Root ".venv\Scripts\python.exe"))) {
        Write-Host "`n== Creating .venv ==" -ForegroundColor Cyan
        python -m venv (Join-Path $Root ".venv")
        $PyExe = Join-Path $Root ".venv\Scripts\python.exe"
    }

    Write-Host "`n== Backend: pip install ==" -ForegroundColor Cyan
    & $PyExe -m pip install -q --upgrade pip
    & $PyExe -m pip install -r "$Root\backend\requirements.txt"

    Write-Host "`n== Frontend: npm install ==" -ForegroundColor Cyan
    Push-Location "$Root\frontend"
    npm install --no-fund --no-audit
    Pop-Location

    Write-Host "`n== Verify ==" -ForegroundColor Cyan
    & $PyExe -c "import fastapi, uvicorn; print('  Backend: OK')"
    if (-not (Test-Path "$Root\frontend\node_modules\vite\package.json")) {
        Write-Error "Frontend node_modules missing (vite). npm install may have failed."
    }
    Write-Host "  Frontend: OK"
}

Write-Host "`n== Starting API + Vite (Ctrl+C stops both) ==" -ForegroundColor Green
Write-Host '  (Vite reads repo .backend-port for the proxy; backend starts first.)' -ForegroundColor DarkGray

$portFile = Join-Path $Root '.backend-port'
Remove-Item $portFile -Force -ErrorAction SilentlyContinue

$BackendJob = Start-Job -ScriptBlock {
    param($Py, $R)
    Set-Location "$R\backend"
    & $Py run_dev.py 2>&1
} -ArgumentList $PyExe, $Root

$deadline = (Get-Date).AddSeconds(60)
while (-not (Test-Path $portFile) -and (Get-Date) -lt $deadline) {
    Receive-Job $BackendJob -Keep -ErrorAction SilentlyContinue | ForEach-Object { "[backend] $_" }
    if ($BackendJob.State -in @("Completed", "Failed", "Stopped")) { break }
    Start-Sleep -Milliseconds 250
}

Receive-Job $BackendJob -Keep -ErrorAction SilentlyContinue | ForEach-Object { "[backend] $_" }

if (-not (Test-Path $portFile)) {
    Stop-Job $BackendJob -ErrorAction SilentlyContinue
    Remove-Job $BackendJob -ErrorAction SilentlyContinue
    Write-Error "Backend did not write $portFile (timed out). Fix backend errors above, or set a fixed BACKEND_PORT in ports.env."
}

$FrontendJob = Start-Job -ScriptBlock {
    param($R)
    Set-Location "$R\frontend"
    npm run dev 2>&1
} -ArgumentList $Root

try {
    while ($true) {
        Receive-Job $BackendJob -Keep -ErrorAction SilentlyContinue | ForEach-Object { "[backend] $_" }
        Receive-Job $FrontendJob -Keep -ErrorAction SilentlyContinue | ForEach-Object { "[frontend] $_" }
        $beDone = $BackendJob.State -in @("Completed", "Failed", "Stopped")
        $feDone = $FrontendJob.State -in @("Completed", "Failed", "Stopped")
        if ($beDone -and $feDone) { break }
        Start-Sleep -Milliseconds 400
    }
} finally {
    Stop-Job $BackendJob, $FrontendJob -ErrorAction SilentlyContinue
    Remove-Job $BackendJob, $FrontendJob -ErrorAction SilentlyContinue
}
