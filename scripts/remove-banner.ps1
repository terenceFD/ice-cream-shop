$p = 'c:\Users\forbi\Desktop\ice cream site\ice-cream-site\src\pages\home\HomePage.jsx'
$lines = Get-Content $p
# Remove lines 1239-1337 (1-based), i.e. indexes 1238..1336, the dark cake banner section.
$new = $lines[0..1237] + $lines[1337..($lines.Count-1)]
Set-Content -Path $p -Value $new -Encoding UTF8
Write-Output "Done. New line count: $($new.Count)"
