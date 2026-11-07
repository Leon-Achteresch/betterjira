param([Parameter(Mandatory)][string]$Tag, [string]$Repository = 'Leon-Achteresch/betterjira')

$ErrorActionPreference = 'Stop'
$release = gh api "repos/$Repository/releases/tags/$Tag" | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Release konnte nicht gelesen werden.' }
if ($release.draft -or $release.tag_name -ne $Tag) { throw 'Release ist nicht veröffentlicht.' }
$outputDirectory = Join-Path ([IO.Path]::GetTempPath()) ('betterjira-release-test-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $outputDirectory | Out-Null
gh release download $Tag --repo $Repository --pattern latest.json --dir $outputDirectory
if ($LASTEXITCODE -ne 0) { throw 'Updater-Manifest konnte nicht geladen werden.' }
$manifest = Get-Content -LiteralPath (Join-Path $outputDirectory 'latest.json') -Raw | ConvertFrom-Json
if ($manifest.version -ne $Tag.TrimStart('v')) { throw 'Versionsangaben stimmen nicht überein.' }
$requiredPlatforms = @('darwin-aarch64', 'darwin-x86_64', 'linux-x86_64', 'linux-x86_64-deb', 'linux-x86_64-rpm', 'windows-x86_64', 'windows-x86_64-nsis')
$expectedPrefix = "https://github.com/$Repository/releases/download/$Tag/"
foreach ($platform in $requiredPlatforms) {
  $entry = $manifest.platforms.$platform
  if (-not $entry -or -not $entry.url.StartsWith($expectedPrefix) -or [string]::IsNullOrWhiteSpace($entry.signature)) {
    throw "Ungültiger Updater-Eintrag: $platform"
  }
  $assetName = [uri]::UnescapeDataString(([uri]$entry.url).Segments[-1])
  $binary = @($release.assets | Where-Object name -eq $assetName)
  $signature = @($release.assets | Where-Object name -eq ($assetName + '.sig'))
  if ($binary.Count -ne 1 -or $binary[0].size -le 0 -or $signature.Count -ne 1 -or $signature[0].size -le 0) {
    throw "Release-Datei oder Signatur fehlt: $platform"
  }
}
Write-Output "RELEASE_MANIFEST_OK $Tag ($($requiredPlatforms.Count) Plattformen)"
