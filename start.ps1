$ErrorActionPreference = 'Stop'

$goCommand = Get-Command go -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $goCommand) {
    Write-Error 'Go nao foi encontrado no PATH. Instale Go 1.22 ou mais recente.'
    exit 1
}

$cloudflaredCommand = Get-Command cloudflared -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $cloudflaredCommand) {
    Write-Error 'cloudflared nao foi encontrado no PATH. Instale com: winget install --id Cloudflare.cloudflared'
    exit 1
}

$logPrefix = Join-Path $env:TEMP "chamago-$PID"
$goOutput = "$logPrefix-go.out.log"
$goError = "$logPrefix-go.err.log"
$serverProcess = $null

try {
    $serverProcess = Start-Process -FilePath $goCommand.Source -ArgumentList 'run .' -WorkingDirectory $PSScriptRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $goOutput -RedirectStandardError $goError
    $serverReady = $false
    $serverDeadline = [DateTime]::UtcNow.AddSeconds(60)

    while (-not $serverReady -and [DateTime]::UtcNow -lt $serverDeadline) {
        $serverProcess.Refresh()
        if ($serverProcess.HasExited) {
            $details = Get-Content -LiteralPath $goError -Raw -ErrorAction SilentlyContinue
            throw "go run . encerrou antes de iniciar. $details"
        }

        $tcpClient = [System.Net.Sockets.TcpClient]::new()
        try {
            $connect = $tcpClient.BeginConnect('127.0.0.1', 8080, $null, $null)
            if ($connect.AsyncWaitHandle.WaitOne(150)) {
                $tcpClient.EndConnect($connect)
                $serverReady = $true
            }
            $connect.AsyncWaitHandle.Close()
        } catch {
        } finally {
            $tcpClient.Dispose()
        }

        if (-not $serverReady) {
            $null = $serverProcess.WaitForExit(250)
        }
    }

    if (-not $serverReady) {
        throw 'O servidor Go nao abriu a porta 8080 dentro de 60 segundos.'
    }

    Write-Host 'Servidor Go ativo.' -ForegroundColor Green
    Write-Host 'A mensagem completa do Cloudflare Tunnel, incluindo a caixa com o link, aparece abaixo.'
    Write-Host 'Mantenha esta janela aberta. Pressione Ctrl+C para encerrar Go e Tunnel.'
    Write-Host ''

    & $cloudflaredCommand.Source tunnel --url http://localhost:8080
    if ($LASTEXITCODE -ne 0) {
        throw "cloudflared encerrou com codigo $LASTEXITCODE."
    }
} finally {
    if ($null -ne $serverProcess) {
        $serverProcess.Refresh()
        if (-not $serverProcess.HasExited) {
            & (Join-Path $env:SystemRoot 'System32\taskkill.exe') /PID $serverProcess.Id /T /F *> $null
        }
    }

    foreach ($logFile in @($goOutput, $goError)) {
        try {
            [System.IO.File]::Delete($logFile)
        } catch {
        }
    }
}
