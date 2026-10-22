$ErrorActionPreference = 'Stop'
$p = 'c:\Users\forbi\Desktop\ice cream site\ice-cream-site\src\pages\home\HomePage.jsx'
$bytes = [System.IO.File]::ReadAllBytes($p)
# File was decoded as UTF-8 with replacement chars then re-saved, corrupting emoji.
# Undo: encode current text back to the single-byte latin1 map to recover original bytes,
# then decode those bytes as UTF-8.
$text = [System.Text.Encoding]::GetEncoding(28591).GetString($bytes)
$fixed = [System.Text.Encoding]::UTF8.GetString([System.Text.Encoding]::GetEncoding(28591).GetBytes($text))
[System.IO.File]::WriteAllText($p, $fixed, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'recovered'
