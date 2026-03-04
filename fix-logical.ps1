$files = Get-ChildItem -Path 'd:\Skoll\src' -Recurse -Include '*.tsx'
Write-Host "Found $($files.Count) files"
$n = 0
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName)
    $m = $c
    $m = $m -replace 'marginBottom:',   'marginBlockEnd:'
    $m = $m -replace 'marginTop:',      'marginBlockStart:'
    $m = $m -replace 'marginLeft:',     'marginInlineStart:'
    $m = $m -replace 'marginRight:',    'marginInlineEnd:'
    $m = $m -replace 'borderBottom:',   'borderBlockEnd:'
    $m = $m -replace 'borderTop:',      'borderBlockStart:'
    $m = $m -replace 'borderLeft:',     'borderInlineStart:'
    $m = $m -replace 'borderRight:',    'borderInlineEnd:'
    $m = $m -replace 'minWidth:',      'minInlineSize:'
    $m = $m -replace 'maxWidth:',      'maxInlineSize:'
    $m = $m -replace 'width:',         'inlineSize:'
    if ($m -ne $c) {
        [System.IO.File]::WriteAllText($f.FullName, $m, [System.Text.Encoding]::UTF8)
        $n++
        Write-Host "  OK: $($f.Name)"
    }
}
Write-Host "DONE: $n files updated"
