$ErrorActionPreference = 'Stop'
$taskNode = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $taskNode) {
    $taskNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $taskNode)) { throw 'Установите Node.js 22 или новее, затем запустите этот файл снова.' }
& $taskNode (Join-Path $PSScriptRoot 'scripts\serve.mjs')
