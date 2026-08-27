param(
  [switch]$Check
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $repositoryRoot 'src\shared\types\database.generated.ts'
$supabaseCli = Join-Path $repositoryRoot 'node_modules\.bin\supabase.cmd'

if (-not (Test-Path -LiteralPath $supabaseCli)) {
  throw 'Supabase CLI is unavailable. Run npm ci before generating database types.'
}

$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $supabaseCli
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$startInfo.Arguments = 'gen types --lang typescript --local'

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $startInfo
[void]$process.Start()

$generatedTypes = $process.StandardOutput.ReadToEnd()
$diagnostics = $process.StandardError.ReadToEnd()
$process.WaitForExit()

if ($process.ExitCode -ne 0) {
  throw "Supabase type generation failed: $diagnostics"
}

$generatedTypes = $generatedTypes.Replace("`r`n", "`n").TrimEnd() + "`n"

if ($Check) {
  if (-not (Test-Path -LiteralPath $targetPath)) {
    throw "Generated database types are missing: $targetPath"
  }

  $committedTypes = [System.IO.File]::ReadAllText($targetPath).Replace("`r`n", "`n")
  if ($committedTypes -cne $generatedTypes) {
    throw 'Generated database types are out of date. Run npm run db:types.'
  }

  Write-Output 'Generated database types are current.'
  exit 0
}

$targetDirectory = Split-Path -Parent $targetPath
[System.IO.Directory]::CreateDirectory($targetDirectory) | Out-Null
[System.IO.File]::WriteAllText($targetPath, $generatedTypes, [System.Text.UTF8Encoding]::new($false))
Write-Output "Generated database types at $targetPath"
