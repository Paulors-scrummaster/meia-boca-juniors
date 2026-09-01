[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [guid]$RequestId,

  [Parameter(Mandatory)]
  [ValidatePattern('^[a-z0-9]{20}$')]
  [string]$ProjectRef,

  [Parameter(Mandatory)]
  [ValidatePattern('^age1[0-9a-z]+$')]
  [string]$AgeRecipient,

  [Parameter(Mandatory)]
  [ValidatePattern('^(?:[0-9a-f]{40}|[0-9a-f]{64})$')]
  [string]$GitCommit,

  [Parameter(Mandatory)]
  [ValidatePattern('^[0-9]+$')]
  [string]$RunId,

  [Parameter(Mandatory)]
  [string]$ResultPath,

  [string]$SupabaseCommand = 'supabase',
  [string]$PgDumpCommand = 'pg_dump',
  [string]$AgeCommand = 'age',
  [string]$AwsCommand = 'aws'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$AllowedStorageBucket = 'athlete-avatars'
$AllowedR2Bucket = 'mbj-backups'
$AllowedR2Prefix = 'backups'
$AllowedDatabaseSchemas = @('auth', 'storage')
$AllowedDatabaseTables = @(
  'private.command_results',
  'private.identity_command_results',
  'private.rate_limit_counters',
  'public.allowed_formations',
  'public.athlete_invites',
  'public.athletes',
  'public.audit_logs',
  'public.lineup_players',
  'public.lineups',
  'public.match_consolidations',
  'public.match_goals',
  'public.match_presences',
  'public.matches',
  'public.mvp_awards',
  'public.mvp_votes',
  'public.mvp_voting_rounds',
  'public.notices',
  'public.notification_deliveries',
  'public.notification_events',
  'public.presence_justifications',
  'public.profiles',
  'public.push_subscriptions',
  'public.seasons',
  'public.user_roles'
)

$script:ExitCode = 1
$script:PlaintextRoot = $null
$script:EncryptedPath = $null
$script:VerificationPath = $null

function Assert-EnvironmentValue {
  param([Parameter(Mandatory)][string]$Name)
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "CONFIG_MISSING:$Name"
  }
  return $value
}

function Assert-CommandAvailable {
  param([Parameter(Mandatory)][string]$Name)
  if (-not (Get-Command -Name $Name -ErrorAction SilentlyContinue)) {
    throw "TOOL_MISSING:$Name"
  }
}

function Invoke-NativeChecked {
  param(
    [Parameter(Mandatory)][string]$Command,
    [Parameter(Mandatory)][string[]]$Arguments,
    [Parameter(Mandatory)][string]$SafeFailureCode
  )

  & $Command @Arguments 2>&1 | ForEach-Object {
    $line = [string]$_
    if ($line -notmatch '(?i)(password|authorization|secret|token|postgres(?:ql)?://|service.role)') {
      Write-Verbose $line
    }
  }
  if ($LASTEXITCODE -ne 0) {
    throw $SafeFailureCode
  }
}

function Get-FileRecord {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Kind
  )
  $item = Get-Item -LiteralPath $Path
  [ordered]@{
    path = [IO.Path]::GetRelativePath($Root, $item.FullName).Replace('\', '/')
    kind = $Kind
    bytes = $item.Length
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $item.FullName).Hash.ToLowerInvariant()
  }
}

function Export-Database {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][string]$DatabaseUrl
  )

  $databaseRoot = Join-Path $Root 'database'
  New-Item -ItemType Directory -Path $databaseRoot | Out-Null

  Invoke-NativeChecked -Command $SupabaseCommand -SafeFailureCode 'DATABASE_ROLES_EXPORT_FAILED' -Arguments @(
    'db', 'dump', '--db-url', $DatabaseUrl, '--role-only', '--file', (Join-Path $databaseRoot 'roles.sql')
  )

  $schemaArgs = @('--dbname', $DatabaseUrl, '--schema-only', '--no-owner', '--no-privileges', '--file', (Join-Path $databaseRoot 'schema.sql'))
  $dataArgs = @('--dbname', $DatabaseUrl, '--data-only', '--no-owner', '--no-privileges', '--format=p', '--file', (Join-Path $databaseRoot 'data.sql'))
  foreach ($schema in $AllowedDatabaseSchemas) {
    $schemaArgs += @('--schema', $schema)
    $dataArgs += @('--schema', $schema)
  }
  foreach ($table in $AllowedDatabaseTables) {
    $schemaArgs += @('--table', $table)
    $dataArgs += @('--table', $table)
  }
  Invoke-NativeChecked -Command $PgDumpCommand -Arguments $schemaArgs -SafeFailureCode 'DATABASE_SCHEMA_EXPORT_FAILED'
  Invoke-NativeChecked -Command $PgDumpCommand -Arguments $dataArgs -SafeFailureCode 'DATABASE_DATA_EXPORT_FAILED'

  $migrationRoot = Join-Path $Root 'schema-migrations'
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\..\supabase\migrations') -Destination $migrationRoot -Recurse
}

function Get-StorageEntries {
  param(
    [Parameter(Mandatory)][string]$BaseUrl,
    [Parameter(Mandatory)][hashtable]$Headers,
    [string]$Prefix = ''
  )

  $offset = 0
  $entries = @()
  do {
    $body = @{ prefix = $Prefix; limit = 100; offset = $offset; sortBy = @{ column = 'name'; order = 'asc' } } | ConvertTo-Json -Depth 4 -Compress
    $page = @(Invoke-RestMethod -Method Post -Uri "$BaseUrl/storage/v1/object/list/$AllowedStorageBucket" -Headers $Headers -ContentType 'application/json' -Body $body)
    $entries += $page
    $offset += $page.Count
  } while ($page.Count -eq 100)
  return $entries
}

function Export-Storage {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][string]$ServiceRoleKey
  )

  $storageRoot = Join-Path $Root 'storage\athlete-avatars'
  New-Item -ItemType Directory -Path $storageRoot | Out-Null
  $baseUrl = "https://$ProjectRef.supabase.co"
  $headers = @{ Authorization = "Bearer $ServiceRoleKey"; apikey = $ServiceRoleKey }
  $pending = [Collections.Generic.Queue[string]]::new()
  $pending.Enqueue('')

  while ($pending.Count -gt 0) {
    $prefix = $pending.Dequeue()
    foreach ($entry in @(Get-StorageEntries -BaseUrl $baseUrl -Headers $headers -Prefix $prefix)) {
      $name = [string]$entry.name
      if ([string]::IsNullOrWhiteSpace($name) -or $name.Contains('..') -or $name.Contains('\')) {
        throw 'STORAGE_KEY_REJECTED'
      }
      $objectKey = if ($prefix) { "$prefix/$name" } else { $name }
      if ($null -eq $entry.id) {
        $pending.Enqueue($objectKey)
        continue
      }
      if ($objectKey -notmatch '^athletes/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/avatar\.webp$') {
        throw 'STORAGE_KEY_NOT_ALLOWLISTED'
      }
      $destination = Join-Path $storageRoot ($objectKey.Replace('/', [IO.Path]::DirectorySeparatorChar))
      New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
      $encoded = ($objectKey.Split('/') | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
      Invoke-WebRequest -Method Get -Uri "$baseUrl/storage/v1/object/authenticated/$AllowedStorageBucket/$encoded" -Headers $headers -OutFile $destination
    }
  }
}

function Invoke-PlaintextCleanup {
  if ($script:PlaintextRoot -and (Test-Path -LiteralPath $script:PlaintextRoot)) {
    Remove-Item -LiteralPath $script:PlaintextRoot -Recurse -Force -ErrorAction Stop
  }
  if ($script:VerificationPath -and (Test-Path -LiteralPath $script:VerificationPath)) {
    Remove-Item -LiteralPath $script:VerificationPath -Force -ErrorAction Stop
  }
}

try {
  $script:ExitCode = 2
  if ($ProjectRef -ne 'lqkybvqnppxxehiriunq' -and $env:MBJ_BACKUP_ENVIRONMENT -ne 'production') {
    throw 'PROJECT_REF_NOT_ALLOWLISTED'
  }
  if ($ResultPath -notmatch 'backup-result\.json$') {
    throw 'RESULT_PATH_REJECTED'
  }

  $databaseUrl = Assert-EnvironmentValue 'SUPABASE_DB_URL'
  $serviceRoleKey = Assert-EnvironmentValue 'SUPABASE_SERVICE_ROLE_KEY'
  $r2AccountId = Assert-EnvironmentValue 'R2_ACCOUNT_ID'
  $null = Assert-EnvironmentValue 'AWS_ACCESS_KEY_ID'
  $null = Assert-EnvironmentValue 'AWS_SECRET_ACCESS_KEY'
  if ($r2AccountId -notmatch '^[0-9a-f]{32}$') { throw 'R2_ACCOUNT_ID_REJECTED' }

  $script:ExitCode = 3
  foreach ($command in @($SupabaseCommand, $PgDumpCommand, $AgeCommand, $AwsCommand, 'tar')) {
    Assert-CommandAvailable $command
  }

  $backupId = ([guid]::NewGuid()).ToString('N')
  $utcNow = [DateTimeOffset]::UtcNow
  $temporaryParent = [IO.Path]::GetTempPath()
  $script:PlaintextRoot = Join-Path $temporaryParent "mbj-backup-$backupId"
  $script:EncryptedPath = Join-Path $temporaryParent "$backupId.tar.age"
  $script:VerificationPath = Join-Path $temporaryParent "$backupId.verify.age"
  New-Item -ItemType Directory -Path $script:PlaintextRoot | Out-Null

  $script:ExitCode = 10
  Export-Database -Root $script:PlaintextRoot -DatabaseUrl $databaseUrl

  $script:ExitCode = 20
  Export-Storage -Root $script:PlaintextRoot -ServiceRoleKey $serviceRoleKey

  $records = @()
  Get-ChildItem -LiteralPath $script:PlaintextRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
    $kind = if ($_.FullName -like '*\storage\*') { 'STORAGE_OBJECT' } elseif ($_.FullName -like '*\schema-migrations\*') { 'MIGRATION' } else { 'DATABASE' }
    $records += Get-FileRecord -Root $script:PlaintextRoot -Path $_.FullName -Kind $kind
  }
  $manifest = [ordered]@{
    contractVersion = 1
    backupId = $backupId
    createdAt = $utcNow.ToString('o')
    projectRef = $ProjectRef
    gitCommit = $GitCommit
    storageBucket = $AllowedStorageBucket
    files = $records
  }
  $manifestPath = Join-Path $script:PlaintextRoot 'manifest.json'
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM
  $manifestSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $manifestPath).Hash.ToLowerInvariant()

  $script:ExitCode = 30
  $archivePath = Join-Path ([IO.Path]::GetTempPath()) "$backupId.tar"
  try {
    Invoke-NativeChecked -Command 'tar' -Arguments @('-cf', $archivePath, '-C', $script:PlaintextRoot, '.') -SafeFailureCode 'ARCHIVE_FAILED'
    Invoke-NativeChecked -Command $AgeCommand -Arguments @('--encrypt', '--recipient', $AgeRecipient, '--output', $script:EncryptedPath, $archivePath) -SafeFailureCode 'ENCRYPTION_FAILED'
  } finally {
    if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
  }

  $encryptedSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $script:EncryptedPath).Hash.ToLowerInvariant()
  $encryptedSize = (Get-Item -LiteralPath $script:EncryptedPath).Length
  $objectKey = "$AllowedR2Prefix/$($utcNow.ToString('yyyy/MM'))/$backupId.age"
  $endpoint = "https://$r2AccountId.r2.cloudflarestorage.com"

  $script:ExitCode = 40
  Invoke-NativeChecked -Command $AwsCommand -Arguments @(
    's3', 'cp', $script:EncryptedPath, "s3://$AllowedR2Bucket/$objectKey", '--endpoint-url', $endpoint,
    '--no-progress', '--only-show-errors', '--metadata', "manifest-sha256=$manifestSha256,encrypted-sha256=$encryptedSha256"
  ) -SafeFailureCode 'R2_UPLOAD_FAILED'

  $script:ExitCode = 41
  $headJson = & $AwsCommand s3api head-object --bucket $AllowedR2Bucket --key $objectKey --endpoint-url $endpoint --output json
  if ($LASTEXITCODE -ne 0) { throw 'R2_HEAD_FAILED' }
  $head = $headJson | ConvertFrom-Json
  if ([long]$head.ContentLength -ne $encryptedSize -or $head.Metadata.'manifest-sha256' -ne $manifestSha256) {
    throw 'R2_METADATA_VERIFICATION_FAILED'
  }
  Invoke-NativeChecked -Command $AwsCommand -Arguments @(
    's3', 'cp', "s3://$AllowedR2Bucket/$objectKey", $script:VerificationPath, '--endpoint-url', $endpoint,
    '--no-progress', '--only-show-errors'
  ) -SafeFailureCode 'R2_READBACK_FAILED'
  $remoteSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $script:VerificationPath).Hash.ToLowerInvariant()
  if ($remoteSha256 -ne $encryptedSha256) { throw 'R2_CHECKSUM_MISMATCH' }

  $script:ExitCode = 50
  $listedJson = & $AwsCommand s3api list-objects-v2 --bucket $AllowedR2Bucket --prefix "$AllowedR2Prefix/" --endpoint-url $endpoint --output json
  if ($LASTEXITCODE -ne 0) { throw 'R2_RETENTION_LIST_FAILED' }
  $verifiedObjects = @((($listedJson | ConvertFrom-Json).Contents) | Where-Object { $_.Key -match '^backups/[0-9]{4}/[0-9]{2}/[0-9a-f]{32}\.age$' } | Sort-Object LastModified -Descending)
  foreach ($expired in @($verifiedObjects | Select-Object -Skip 4)) {
    Invoke-NativeChecked -Command $AwsCommand -Arguments @(
      's3api', 'delete-object', '--bucket', $AllowedR2Bucket, '--key', [string]$expired.Key, '--endpoint-url', $endpoint
    ) -SafeFailureCode 'R2_RETENTION_DELETE_FAILED'
  }

  $script:ExitCode = 90
  Invoke-PlaintextCleanup

  $result = [ordered]@{
    contractVersion = 1
    requestId = $RequestId.ToString()
    runId = $RunId
    backupId = $backupId
    manifestSha256 = $manifestSha256
    encryptedObjectKey = $objectKey
    verifiedAt = [DateTimeOffset]::UtcNow.ToString('o')
    status = 'VERIFIED'
  }
  $resultDirectory = Split-Path -Parent $ResultPath
  if ($resultDirectory) { New-Item -ItemType Directory -Path $resultDirectory -Force | Out-Null }
  $result | ConvertTo-Json | Set-Content -LiteralPath $ResultPath -Encoding utf8NoBOM
  $script:ExitCode = 0
} catch {
  $safeCode = if ($_.Exception.Message -match '^[A-Z0-9_:.-]+$') { $_.Exception.Message } else { 'BACKUP_FAILED' }
  Write-Error "MBJ backup failed [$safeCode]" -ErrorAction Continue
} finally {
  try {
    Invoke-PlaintextCleanup
  } catch {
    Write-Error 'MBJ backup cleanup failed [PLAINTEXT_CLEANUP_FAILED]' -ErrorAction Continue
    $script:ExitCode = 90
  }
  if ($script:EncryptedPath -and (Test-Path -LiteralPath $script:EncryptedPath)) {
    Remove-Item -LiteralPath $script:EncryptedPath -Force -ErrorAction SilentlyContinue
  }
}

exit $script:ExitCode
