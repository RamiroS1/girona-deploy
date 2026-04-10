$ErrorActionPreference = "SilentlyContinue"

# Detiene tareas si existen
$backendTask = Get-ScheduledTask -TaskName "GironaBackend" -ErrorAction SilentlyContinue
$frontendTask = Get-ScheduledTask -TaskName "GironaFrontend" -ErrorAction SilentlyContinue
if ($backendTask) { Stop-ScheduledTask -TaskName "GironaBackend" }
if ($frontendTask) { Stop-ScheduledTask -TaskName "GironaFrontend" }

# Mata solo procesos escuchando puertos de la app
$ports = @(3000, 8000)
foreach ($port in $ports) {
  $entries = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($entry in $entries) {
    Stop-Process -Id $entry.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Procesos detenidos."
