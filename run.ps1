param([switch]$SkipInstall)

$Root = $PSScriptRoot
Set-Location $Root

$PyExe = Join-Path $Root ".venv\Scripts\python.exe"

if (-not $SkipInstall) {
    if (-not (Test-Path $PyExe)) {
        Write-Host "== Creating .venv ==" -ForegroundColor Cyan
        python -m venv (Join-Path $Root ".venv")
    }

    Write-Host "== Backend: pip install ==" -ForegroundColor Cyan
    & $PyExe -m pip install -q --upgrade pip
    & $PyExe -m pip install -q -r "$Root\requirements.txt"

    Write-Host "== Frontend: npm install ==" -ForegroundColor Cyan
    Push-Location "$Root\frontend"
    npm install --no-fund --no-audit
    Pop-Location
}

Write-Host "`n== Starting Backend + Frontend ==" -ForegroundColor Green

$BackendJob = Start-Job -ScriptBlock {
    param($Py, $R)
    Set-Location "$R\backend"
    & $Py run_dev.py 2>&1
} -ArgumentList $PyExe, $Root

Start-Sleep -Seconds 3

$FrontendJob = Start-Job -ScriptBlock {
    param($R)
    Set-Location "$R\frontend"
    npm run dev 2>&1
} -ArgumentList $Root

try {
    while ($true) {
        Receive-Job $BackendJob -ErrorAction SilentlyContinue | ForEach-Object { "[backend] $_" }
        Receive-Job $FrontendJob -ErrorAction SilentlyContinue | ForEach-Object { "[frontend] $_" }
        $beDone = $BackendJob.State -in @("Completed", "Failed", "Stopped")
        $feDone = $FrontendJob.State -in @("Completed", "Failed", "Stopped")
        if ($beDone -and $feDone) { break }
        Start-Sleep -Milliseconds 400
    }
} finally {
    Stop-Job $BackendJob, $FrontendJob -ErrorAction SilentlyContinue
    Remove-Job $BackendJob, $FrontendJob -ErrorAction SilentlyContinue
}
