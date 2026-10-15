$ErrorActionPreference = 'Stop'

$outputPath = Join-Path $PSScriptRoot 'iniciar.exe'

Push-Location $PSScriptRoot
try {
    & go build -o $outputPath .\launcher
    if ($LASTEXITCODE -ne 0) {
        throw "go build encerrou com codigo $LASTEXITCODE."
    }
} finally {
    Pop-Location
}

Write-Host "Executavel criado: $outputPath" -ForegroundColor Green
