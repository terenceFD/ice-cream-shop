$ErrorActionPreference = 'Stop'
$p = 'c:\Users\forbi\Desktop\ice cream site\ice-cream-site\src\pages\home\HomePage.jsx'
$bytes = [System.IO.File]::ReadAllBytes($p)
$text = [System.Text.Encoding]::UTF8.GetString($bytes)
# repair mojibake em dash: C3 A2 E2 80 94 (from UTF-8 of a2 E2 80 94) -> em dash U+2014
$text = $text.Replace([string][char]0xC3 + [string][char]0xA2 + [string][char]0xE2 + [string][char]0x80 + [string][char]0x94, [string][char]0x2014)
[System.IO.File]::WriteAllText($p, $text, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'mojibake repaired'
