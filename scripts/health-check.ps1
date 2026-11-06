#!/bin/env pwsh
# Vérification de santé du serveur Arsenal (attente du boot, puis ping API)
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
    try { $s = Invoke-RestMethod http://localhost:3000/api/stats -TimeoutSec 3; $ok = $true; break } catch { Start-Sleep -Milliseconds 1000 }
}
if ($ok) {
    Write-Output ("SERVEUR EN LIGNE http://localhost:3000 | capacite=" + $s.totalCapacity + " | confirmees=" + $s.confirmedSeats + " | en_attente=" + $s.pendingVerifications)
} else {
    Write-Output "SERVEUR INDISPONIBLE apres 40s"
}
