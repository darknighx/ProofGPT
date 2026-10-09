param(
  [string]$PythonExecutable = '',
  [string]$DataDirectory = (Split-Path $PSScriptRoot -Parent)
)
$ErrorActionPreference = 'Stop'
# Developer-only source helper, never shipped in the installer. No model download.
$requirementsFile = Join-Path $PSScriptRoot 'detector/requirements.txt'
if (-not (Test-Path -LiteralPath $requirementsFile)) { $requirementsFile = Join-Path (Split-Path $PSScriptRoot -Parent) 'detector/requirements.txt' }
if (-not (Test-Path -LiteralPath $requirementsFile)) { throw 'The bundled detector requirements could not be found.' }
$pythonCandidates = @()
if ($PythonExecutable) {
  $pythonCandidates += @{ Command = $PythonExecutable; Arguments = @() }
} else {
  $pythonCandidates += @{ Command = 'python'; Arguments = @() }
  $pythonCandidates += @{ Command = 'py'; Arguments = @('-3.11') }
  $pythonCandidates += @{ Command = 'py'; Arguments = @('-3.12') }
  $pythonCandidates += @{ Command = 'py'; Arguments = @() }
  $pythonCandidates += @{ Command = 'python3'; Arguments = @() }
  foreach ($pythonLauncher in @((Join-Path $env:SystemRoot 'py.exe'),(Join-Path $env:LOCALAPPDATA 'Programs\Python\Launcher\py.exe'))) {
    foreach ($pythonSelector in @('-3.11','-3.12')) { $pythonCandidates += @{ Command = $pythonLauncher; Arguments = @($pythonSelector) } }
  }
  foreach ($pythonAlias in @('python.exe','python3.exe')) { $pythonCandidates += @{ Command = (Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\$pythonAlias"); Arguments = @() } }
  foreach ($pythonRegistryRoot in @('HKCU:\Software\Python\PythonCore','HKLM:\Software\Python\PythonCore','HKLM:\Software\WOW6432Node\Python\PythonCore')) {
    foreach ($pythonRegistration in @(Get-ChildItem -LiteralPath $pythonRegistryRoot -ErrorAction SilentlyContinue)) {
      if ($pythonRegistration.PSChildName -notmatch '^3\.(11|12)([-\w.]*)$') { continue }
      $pythonInstallPath = Get-Item -LiteralPath (Join-Path $pythonRegistration.PSPath 'InstallPath') -ErrorAction SilentlyContinue
      if ($pythonInstallPath) {
        $pythonRegisteredExe = $pythonInstallPath.GetValue('ExecutablePath')
        if (-not $pythonRegisteredExe) { $pythonRegisteredExe = Join-Path $pythonInstallPath.GetValue('') 'python.exe' }
        $pythonCandidates += @{ Command = $pythonRegisteredExe; Arguments = @() }
      }
    }
  }
  foreach ($pythonCommonRoot in @((Join-Path $env:LOCALAPPDATA 'Programs\Python'),$env:ProgramFiles,${env:ProgramFiles(x86)},($env:SystemDrive+'\'))) {
    if ($pythonCommonRoot) {
      foreach ($pythonFolder in @('Python311','Python312')) { $pythonCandidates += @{ Command = (Join-Path $pythonCommonRoot "$pythonFolder\python.exe"); Arguments = @() } }
    }
  }
}
$selectedPython = $null
$pythonProbe = 'import sys,struct,json; print(json.dumps({"executable":sys.executable,"major":sys.version_info.major,"minor":sys.version_info.minor,"bits":struct.calcsize("P")*8}))'
foreach ($pythonCandidate in $pythonCandidates) {
  try {
    $pythonCommand = $pythonCandidate.Command
    $pythonArguments = $pythonCandidate.Arguments
    $pythonOutput = & $pythonCommand @pythonArguments -c $pythonProbe 2>$null
    if ($LASTEXITCODE -ne 0) { continue }
    $pythonInfo = ($pythonOutput -join "`n") | ConvertFrom-Json
    if ($pythonInfo.major -eq 3 -and $pythonInfo.minor -in @(11,12) -and $pythonInfo.bits -eq 64 -and [IO.Path]::IsPathRooted($pythonInfo.executable)) {
      $selectedPython = $pythonInfo.executable; break
    }
  } catch { }
}
if (-not $selectedPython) { throw 'ProofGPT requires 64-bit Python 3.11 or 3.12. Python could not be detected on this computer. You can supply -PythonExecutable with a compatible executable path.' }
# Use the exact executable reported by the validated interpreter, including launcher selections.
& $selectedPython -c 'import sys, struct; sys.exit(0 if sys.version_info[:2] in [(3,11),(3,12)] and struct.calcsize("P")==8 else 1)'
if ($LASTEXITCODE -ne 0) { throw 'The selected Python interpreter could not be verified as 64-bit Python 3.11 or 3.12.' }
$runtimeDirectory = Join-Path ([IO.Path]::GetFullPath($DataDirectory)) '.venv'
$runtimePython = Join-Path $runtimeDirectory 'Scripts/python.exe'
if (-not (Test-Path -LiteralPath $runtimePython)) {
  Write-Host "Creating ProofGPT Python environment in $runtimeDirectory"
  & $selectedPython -m venv $runtimeDirectory
  if ($LASTEXITCODE -ne 0) { throw 'Creating the Python environment failed.' }
}
Write-Host 'Installing CPU PyTorch and detector dependencies. Internet access and several GB of free space are required.'
& $runtimePython -m pip install --index-url https://download.pytorch.org/whl/cpu torch==2.6.0
if ($LASTEXITCODE -ne 0) { throw 'PyTorch installation failed. Check your connection and available disk space.' }
& $runtimePython -m pip install -r $requirementsFile
if ($LASTEXITCODE -ne 0) { throw 'Detector dependency installation failed.' }
& $runtimePython -m pip check
if ($LASTEXITCODE -ne 0) { throw 'The Python environment has conflicting dependencies.' }
Write-Host 'Developer environment ready. Use npm run dev or npm run build:detector. Installed users do not run this helper.'
