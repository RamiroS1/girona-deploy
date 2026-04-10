param(
  [string]$ProjectRoot = (Get-Location).Path,
  [string]$ShortcutName = "Girona POS"
)

$ErrorActionPreference = "Stop"

$launcher = Join-Path $ProjectRoot "launch-girona.bat"
if (!(Test-Path $launcher)) {
  throw "No existe launcher: $launcher"
}

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcut = Join-Path $desktop "$ShortcutName.lnk"

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($shortcut)
$lnk.TargetPath = $launcher
$lnk.WorkingDirectory = $ProjectRoot

$icon = Join-Path $ProjectRoot "girona-front\public\images\favicon.ico"
if (Test-Path $icon) {
  $lnk.IconLocation = $icon
}

$lnk.Save()
Write-Host "Acceso directo creado: $shortcut"
