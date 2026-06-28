Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location "C:\Users\user\browser-extension"

function Commit([string]$Message, [string[]]$Paths) {
  if ($Paths.Count -eq 0) {
    git commit --allow-empty -m $Message
    return
  }
  git add @Paths
  git commit -m $Message
}

Commit "chore: add gitignore for node and build artifacts" @(".gitignore")
Commit "chore: initialize wxt typescript project" @("package.json")
Commit "chore: lock dependency versions" @("package-lock.json")
Commit "chore: add typescript configuration" @("tsconfig.json")
Commit "feat: configure extension manifest and permissions" @("wxt.config.ts")
Commit "feat: add background service worker entrypoint" @("entrypoints/background.ts")
Commit "feat: register content script on all pages" @("entrypoints/content.ts")
Commit "feat: add popup html shell" @("entrypoints/popup/index.html")
Commit "feat: add popup base styles" @("entrypoints/popup/style.css")
Commit "feat: add popup toggle ui" @("entrypoints/popup/main.ts")
Commit "chore: add extension static assets" @("public")
Commit "feat: add dom helpers for visibility and clicking" @("utils/dom.ts")
Commit "feat: add multilingual cookie button text patterns" @("utils/patterns.ts")
Commit "feat: add settings storage helpers" @("utils/storage.ts")
Commit "feat: add cross-browser extension api accessor" @("utils/extension-api.ts")
Commit "feat: add cmp handler result types" @("cmp/types.ts")
Commit "feat: add content script scan runner" @("cmp/runner.ts")
Commit "feat: add cmp handlers for major consent platforms" @("cmp/handlers.ts")
Commit "feat: add onetrust-specific reject handlers" @("cmp/onetrust.ts")
Commit "feat: add preferences flow with accordion expansion" @("cmp/preferences-flow.ts")
Commit "docs: add project readme with setup instructions" @("README.md")

$license = @"
MIT License

Copyright (c) 2026 Siddharth

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"@
Set-Content -Path "LICENSE" -Value $license -NoNewline
Commit "chore: add mit license" @("LICENSE")

New-Item -ItemType Directory -Force -Path ".vscode" | Out-Null
$extensionsJson = @'
{
  "recommendations": ["wxt.vscode"]
}
'@
Set-Content -Path ".vscode/extensions.json" -Value $extensionsJson
Commit "chore: recommend wxt vscode extension" @(".vscode/extensions.json")

Add-Content -Path "README.md" -Value "`n## Preferences flow`n`nBefore rejecting all cookies, the extension opens preference panels when available, expands accordion sections, and disables legitimate interest toggles.`n"
Commit "docs: document preferences-first reject flow" @("README.md")

Add-Content -Path "README.md" -Value "`n## Troubleshooting`n`nReload the extension in your browser after code changes. In dev mode, reload from chrome://extensions if settings or background scripts stop responding.`n"
Commit "docs: add troubleshooting notes" @("README.md")

Commit "chore: add commit history bootstrap script" @("scripts/create-commit-history.ps1")

$count = git rev-list --count HEAD
Write-Host "Created $count commits"
