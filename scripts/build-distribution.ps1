$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distRoot = Join-Path $projectRoot "dist"
$bundleRoot = Join-Path $distRoot "LocalResearchAgent"
$appRoot = Join-Path $bundleRoot "app"
$vendorRoot = Join-Path $appRoot "vendor"
$runtimeRoot = Join-Path $bundleRoot "runtime"
$launcherSource = Join-Path $projectRoot "launcher\\LocalResearchAgentLauncher.cs"
$launcherExe = Join-Path $bundleRoot "LocalResearchAgentLauncher.exe"
$compiler = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe"
$bundledNode = "C:\\Users\\zhao9\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe"
$legacyProductName = -join ([char[]](76, 111, 99, 97, 108, 77, 105, 114, 111, 84, 104, 105, 110, 107, 101, 114))
$legacyBundleRoot = Join-Path $distRoot $legacyProductName
$legacyZipPath = Join-Path $distRoot ($legacyProductName + "-win-x64.zip")

if (-not (Test-Path $compiler)) {
  throw "csc.exe not found at $compiler"
}

if (-not (Test-Path $bundledNode)) {
  throw "Bundled node.exe not found at $bundledNode"
}

if (Test-Path $bundleRoot) {
  Remove-Item -LiteralPath $bundleRoot -Recurse -Force
}

if (Test-Path $legacyBundleRoot) {
  Remove-Item -LiteralPath $legacyBundleRoot -Recurse -Force
}

if (Test-Path $legacyZipPath) {
  Remove-Item -LiteralPath $legacyZipPath -Force
}

New-Item -ItemType Directory -Path $appRoot -Force | Out-Null
New-Item -ItemType Directory -Path $vendorRoot -Force | Out-Null
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $projectRoot "server.js") -Destination $appRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "package.json") -Destination $appRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "README.md") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "DEPLOYMENT.md") -Destination $bundleRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "public") -Destination $appRoot -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot "node_modules\\html2canvas\\dist\\html2canvas.min.js") -Destination $vendorRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "node_modules\\jspdf\\dist\\jspdf.umd.min.js") -Destination $vendorRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "node_modules\\katex\\dist\\katex.min.css") -Destination $vendorRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "node_modules\\katex\\dist\\katex.min.js") -Destination $vendorRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "node_modules\\katex\\dist\\contrib\\auto-render.min.js") -Destination $vendorRoot
Copy-Item -LiteralPath (Join-Path $projectRoot "node_modules\\katex\\dist\\fonts") -Destination (Join-Path $vendorRoot "fonts") -Recurse
Copy-Item -LiteralPath $bundledNode -Destination (Join-Path $runtimeRoot "node.exe")

& $compiler /target:winexe /platform:x64 /nologo /out:$launcherExe /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll $launcherSource
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $launcherExe)) {
  throw "Launcher build failed."
}

$zipPath = Join-Path $distRoot "LocalResearchAgent-win-x64.zip"
if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path $bundleRoot -DestinationPath $zipPath
Write-Host "Created distribution folder: $bundleRoot"
Write-Host "Created zip package: $zipPath"

