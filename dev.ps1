# LeadNudge: verify deps, install Python/npm packages, optional Ollama check, then run backend + frontend in one PowerShell window.
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

function HaveCmd([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (HaveCmd "python")) {
    Write-Error "Python is not on PATH. Install Python 3.11+ and retry."
}
if (-not (HaveCmd "npm")) {
    Write-Error "npm is not on PATH. Install Node.js LTS and retry."
}

Write-Host "`n== Backend: pip install ==" -ForegroundColor Cyan
python -m pip install -r "$Root\backend\requirements.txt"

Write-Host "`n== Frontend: npm install ==" -ForegroundColor Cyan
Push-Location "$Root\frontend"
npm install --no-fund --no-audit
Pop-Location

Write-Host "`n== Ollama (optional) ==" -ForegroundColor Cyan
if (HaveCmd "ollama") {
    ollama list
} else {
    Write-Warning "Ollama not found on PATH. For local AI install from https://ollama.com and add it to PATH."
}

Write-Host "`n== Starting API + Vite (Ctrl+C stops both) ==" -ForegroundColor Green
$BackendJob = Start-Job -ScriptBlock {
    param($R)
    Set-Location "$R\backend"
    python run_dev.py 2>&1
} -ArgumentList $Root

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
