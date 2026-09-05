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

  [string]$PgDumpCommand = 'pg_dump',
  [string]$PsqlCommand = 'psql',
  [string]$AgeCommand = 'age',
  [string]$AwsCommand = 'aws'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$AllowedStorageBucket = 'athlete-avatars'
$AllowedR2Bucket = 'mbj-backups'
$AllowedR2Prefix = 'backups'
# Any Supabase Session pooler endpoint is acceptable. The pooler fleet hostname is
# region- and capacity-dependent (aws-0-<region>, aws-1-<region>, ...), so match the
# shape rather than pinning one host. Direct db.<ref>.supabase.co has no IPv4 route
# from GitHub-hosted runners; SUPABASE_DB_POOLER_HOST supplies the rewrite target for
# a direct URL, defaulting to the historically pinned host for backward compatibility.
$AllowedPoolerHostPattern = '^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$'
$DefaultPoolerHost = 'aws-0-us-east-1.pooler.supabase.com'
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
$script:NativeDiagnostic = $null

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

function Get-BackupDatabaseUrl {
  param(
    [Parameter(Mandatory)][string]$DatabaseUrl,
    [Parameter(Mandatory)][string]$ExpectedProjectRef
  )

  $escapedRef = [regex]::Escape($ExpectedProjectRef)

  # Preferred: Session pooler, project-scoped user, port 5432, any pooler host.
  $sessionPattern = "^postgres(?:ql)?://postgres\.${escapedRef}:[^@/]+@aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com:5432/[^#?]+$"
  if ($DatabaseUrl -match $sessionPattern) {
    return $DatabaseUrl
  }

  # Transaction pooler (6543) cannot serve pg_dump; reject it with a distinct code
  # instead of letting pg_dump fail opaquely later.
  if ($DatabaseUrl -match "^postgres(?:ql)?://postgres\.${escapedRef}:[^@/]+@aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com:6543/") {
    throw 'DATABASE_URL_TRANSACTION_POOLER_REJECTED'
  }

  $directPattern = "^(?<scheme>postgres(?:ql)?://)postgres:(?<credential>[^@/]+)@db\.${escapedRef}\.supabase\.co:5432/(?<tail>[^#?]+)$"
  if ($DatabaseUrl -notmatch $directPattern) {
    throw 'DATABASE_URL_HOST_REJECTED'
  }
  # Capture before any further regex evaluation clobbers the automatic $Matches.
  $directScheme = $Matches.scheme
  $directCredential = $Matches.credential
  $directTail = $Matches.tail

  $poolerHost = [Environment]::GetEnvironmentVariable('SUPABASE_DB_POOLER_HOST')
  if ([string]::IsNullOrWhiteSpace($poolerHost)) {
    $poolerHost = $DefaultPoolerHost
  }
  if ($poolerHost -notmatch $AllowedPoolerHostPattern) {
    throw 'DATABASE_URL_POOLER_HOST_REJECTED'
  }

  return '{0}postgres.{1}:{2}@{3}:5432/{4}' -f @(
    $directScheme,
    $ExpectedProjectRef,
    $directCredential,
    $poolerHost,
    $directTail
  )
}

function Invoke-NativeChecked {
  param(
    [Parameter(Mandatory)][string]$Command,
    [Parameter(Mandatory)][string[]]$Arguments,
    [Parameter(Mandatory)][string]$SafeFailureCode
  )

  $script:NativeDiagnostic = $null
  $stderrTail = [System.Collections.Generic.List[string]]::new()
  & $Command @Arguments 2>&1 | ForEach-Object {
    $line = [string]$_
    $isSensitive = $line -match '(?i)(password|authorization|secret|token|postgres(?:ql)?://|service.role)'
    if (-not $isSensitive) {
      Write-Verbose $line
      if ($line.Trim()) {
        # Keep a bounded, secret-free tail so a bare SafeFailureCode is no longer
        # the only signal in CI when the native tool fails for an unclassified
        # reason. Sensitive lines are withheld here exactly as they are above.
        $stderrTail.Add($line)
        if ($stderrTail.Count -gt 40) { $stderrTail.RemoveAt(0) }
      }
    }
    if (-not $script:NativeDiagnostic) {
      # Classify against a static allowlist of provider-independent phrases so the
      # thrown code names the failure class without echoing any connection detail.
      # Runs on sensitive lines too: only the fixed category token is ever kept.
      $script:NativeDiagnostic = switch -Regex ($line) {
        '(?i)Tenant or user not found' { 'POOLER_TENANT_OR_USER_NOT_FOUND'; break }
        '(?i)password authentication failed' { 'PASSWORD_AUTHENTICATION_FAILED'; break }
        '(?i)no pg_hba\.conf entry' { 'PG_HBA_NO_ENTRY'; break }
        '(?i)could not translate host name' { 'HOST_NAME_RESOLUTION_FAILED'; break }
        '(?i)could not connect to server|connection refused|connection timed out|timeout expired|no route to host' { 'CONNECTION_FAILED'; break }
        '(?i)server version mismatch|aborting because of server version' { 'SERVER_VERSION_MISMATCH'; break }
        '(?i)permission denied for' { 'PERMISSION_DENIED'; break }
        '(?i)SSL .*error|could not initiate SSL' { 'SSL_ERROR'; break }
        '(?i)no matching tables were found' { 'NO_MATCHING_TABLES'; break }
        default { $null }
      }
    }
  }
  if ($LASTEXITCODE -ne 0) {
    $code = if ($script:NativeDiagnostic) { '{0}:{1}' -f $SafeFailureCode, $script:NativeDiagnostic } else { $SafeFailureCode }
    if ($stderrTail.Count -gt 0) {
      Write-Warning ("MBJ backup native diagnostic [{0}]:`n{1}" -f $code, ($stderrTail -join "`n"))
    }
    $script:NativeDiagnostic = $null
    throw $code
  }
  $script:NativeDiagnostic = $null
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

function Get-PresentAllowlistedTables {
  param(
    [Parameter(Mandatory)][string]$DatabaseUrl,
    [Parameter(Mandatory)][string[]]$Candidates
  )

  $pairs = foreach ($candidate in $Candidates) {
    if ($candidate -notmatch '^[a-z_]+\.[a-z_]+$') { throw 'DATABASE_TABLE_ALLOWLIST_MALFORMED' }
    $parts = $candidate.Split('.', 2)
    "('{0}','{1}')" -f $parts[0], $parts[1]
  }
  $discoveryQuery = @"
SET statement_timeout = '30s';
SELECT table_schema || '.' || table_name
FROM information_schema.tables
WHERE (table_schema, table_name) IN ($($pairs -join ', '))
  AND table_type = 'BASE TABLE'
ORDER BY 1;
"@

  # Dedicated read-only probe. psql stderr is withheld (it can echo the conninfo
  # URI); only a classified code escapes on failure.
  $raw = & $PsqlCommand $DatabaseUrl '--no-align' '--tuples-only' '--quiet' '--no-psqlrc' `
    '--set' 'ON_ERROR_STOP=1' '--command' $discoveryQuery 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw 'DATABASE_TABLE_DISCOVERY_FAILED'
  }

  $discovered = @($raw | ForEach-Object { ([string]$_).Trim() } | Where-Object { $_ })
  # Intersect with the static allowlist: discovery output can never widen scope.
  return @($Candidates | Where-Object { $discovered -contains $_ })
}

function Export-Database {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][string]$DatabaseUrl
  )

  $databaseRoot = Join-Path $Root 'database'
  New-Item -ItemType Directory -Path $databaseRoot | Out-Null

  $migrationSource = Join-Path $PSScriptRoot '..\..\supabase\migrations'
  $customRoleDefinition = Get-ChildItem -LiteralPath $migrationSource -Filter '*.sql' -File |
    Select-String -Pattern '(?i)\bcreate\s+role\b' -List
  if ($customRoleDefinition) {
    throw 'CUSTOM_DATABASE_ROLE_NOT_ALLOWLISTED'
  }

  # MBJ creates no custom PostgreSQL roles. Supabase-managed roles belong to the
  # destination platform, while application grants are versioned in migrations.
  # Keep an explicit restore artifact without copying provider-managed roles or
  # requiring a Docker-backed provider CLI command.
  @(
    '-- MBJ defines no custom PostgreSQL roles.'
    '-- Supabase-managed roles must be supplied by the isolated restore target.'
    '-- Application grants are restored from schema-migrations/.'
  ) | Set-Content -LiteralPath (Join-Path $databaseRoot 'roles.sql') -Encoding utf8NoBOM

  $schemaArgs = @('--dbname', $DatabaseUrl, '--schema-only', '--no-owner', '--no-privileges', '--file', (Join-Path $databaseRoot 'schema.sql'))
  $dataArgs = @('--dbname', $DatabaseUrl, '--data-only', '--no-owner', '--no-privileges', '--format=p', '--file', (Join-Path $databaseRoot 'data.sql'))
  foreach ($schema in $AllowedDatabaseSchemas) {
    $schemaArgs += @('--schema', $schema)
    $dataArgs += @('--schema', $schema)
  }

  # T179 runs this backup against freshly activated production BEFORE
  # database-release.yml applies the 25 migrations, so the allowlisted
  # public.*/private.* tables (and the private schema itself) do not exist yet.
  # pg_dump aborts when none of its --table patterns resolve. Pin --table only
  # for allowlisted tables that currently exist; the managed auth/storage
  # schemas above still yield a real pre-migration snapshot for the release gate.
  # Once the migrations land, every allowlisted table is present and the argument
  # set matches the previous behaviour exactly.
  $presentTables = @(Get-PresentAllowlistedTables -DatabaseUrl $DatabaseUrl -Candidates $AllowedDatabaseTables)
  foreach ($table in $presentTables) {
    $schemaArgs += @('--table', $table)
    $dataArgs += @('--table', $table)
  }
  if ($presentTables.Count -eq 0) {
    Write-Warning 'MBJ backup notice [PRE_MIGRATION_NO_APPLICATION_TABLES]: dumping managed auth/storage schemas only'
  }

  Invoke-NativeChecked -Command $PgDumpCommand -Arguments $schemaArgs -SafeFailureCode 'DATABASE_SCHEMA_EXPORT_FAILED'
  Invoke-NativeChecked -Command $PgDumpCommand -Arguments $dataArgs -SafeFailureCode 'DATABASE_DATA_EXPORT_FAILED'

  $migrationRoot = Join-Path $Root 'schema-migrations'
  Copy-Item -LiteralPath $migrationSource -Destination $migrationRoot -Recurse
}

function Test-StorageBucketPresent {
  param(
    [Parameter(Mandatory)][string]$BaseUrl,
    [Parameter(Mandatory)][hashtable]$Headers
  )

  try {
    $null = Invoke-RestMethod -Method Get -Uri "$BaseUrl/storage/v1/bucket/$AllowedStorageBucket" `
      -Headers $Headers -ContentType 'application/json'
    return $true
  }
  catch {
    $response = $null
    try { $response = $_.Exception.Response } catch { $response = $null }
    if ($response -and [int]$response.StatusCode -eq 404) {
      return $false
    }
    # Auth failures, 5xx, and transport errors must stay fatal with a classified
    # code rather than collapsing into the generic BACKUP_FAILED catch-all.
    throw 'STORAGE_BUCKET_PROBE_FAILED'
  }
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

  # T179 runs this backup before database-release.yml seeds storage, so the
  # allowlisted bucket does not exist yet. Treat an absent bucket as an empty
  # storage tree (the directory above is the snapshot); once the bucket is
  # created the crawl below runs unchanged.
  if (-not (Test-StorageBucketPresent -BaseUrl $baseUrl -Headers $headers)) {
    Write-Warning "MBJ backup notice [PRE_MIGRATION_BUCKET_ABSENT]: '$AllowedStorageBucket' does not exist yet; capturing an empty storage tree"
    return
  }

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

  $databaseUrl = Get-BackupDatabaseUrl `
    -DatabaseUrl (Assert-EnvironmentValue 'SUPABASE_DB_URL') `
    -ExpectedProjectRef $ProjectRef
  $serviceRoleKey = Assert-EnvironmentValue 'SUPABASE_SERVICE_ROLE_KEY'
  $r2AccountId = Assert-EnvironmentValue 'R2_ACCOUNT_ID'
  $null = Assert-EnvironmentValue 'AWS_ACCESS_KEY_ID'
  $null = Assert-EnvironmentValue 'AWS_SECRET_ACCESS_KEY'
  if ($r2AccountId -notmatch '^[0-9a-f]{32}$') { throw 'R2_ACCOUNT_ID_REJECTED' }

  $script:ExitCode = 3
  foreach ($command in @($PgDumpCommand, $PsqlCommand, $AgeCommand, $AwsCommand, 'tar')) {
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
