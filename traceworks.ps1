# ================================================================
#  TraceWorks — Interactive Launcher
#  Type: traceworks  in any PowerShell to start
# ================================================================

param([string]$QuickName="")

$TW = "$env:USERPROFILE\OneDrive\Desktop\TraceWorks"
$Engine = "$TW\tw_engine.py"
$Reports = "$TW\Reports"

if (!(Test-Path $Reports)) { New-Item -ItemType Directory -Path $Reports -Force | Out-Null }

# ── COLORS ───────────────────────────────────────────────────
function G($m)  { Write-Host $m -ForegroundColor Yellow }
function GR($m) { Write-Host $m -ForegroundColor Green }
function CY($m) { Write-Host $m -ForegroundColor Cyan }
function DG($m) { Write-Host $m -ForegroundColor DarkGray }
function ERR($m) { Write-Host $m -ForegroundColor Red }
function WH($m) { Write-Host $m -ForegroundColor White }
function MG($m) { Write-Host $m -ForegroundColor Magenta }

function Show-Banner {
    Clear-Host
    Write-Host ""
    G  "  ████████╗██████╗  █████╗  ██████╗███████╗"
    G  "     ██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝"
    G  "     ██║   ██████╔╝███████║██║     █████╗  "
    G  "     ██║   ██╔══██╗██╔══██║██║     ██╔══╝  "
    G  "     ██║   ██║  ██║██║  ██║╚██████╗███████╗"
    G  "     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝"
    Write-Host "               W O R K S" -ForegroundColor DarkYellow
    Write-Host ""
    DG "  ──────────────────────────────────────────────────"
    Write-Host "  Texas OSINT Investigation System  v3.0" -ForegroundColor Gray
    Write-Host "  traceworks.tx@outlook.com" -ForegroundColor DarkGray
    DG "  ──────────────────────────────────────────────────"
    Write-Host ""
}

function Ask($prompt, $required=$true) {
    while ($true) {
        Write-Host "  $prompt" -ForegroundColor Cyan -NoNewline
        $val = Read-Host " "
        if ($val -or !$required) { return $val.Trim() }
        Write-Host "  ✗ This field is required." -ForegroundColor Red
    }
}

function Confirm-Input($label, $value) {
    if ($value) { Write-Host "  $label : " -ForegroundColor DarkGray -NoNewline; WH $value }
}

# ── CHECK ENGINE ─────────────────────────────────────────────
function Check-Engine {
    if (!(Test-Path $Engine)) {
        ERR "  ✗ Engine not found: $Engine"
        Write-Host "  Make sure tw_engine.py is in your TraceWorks folder:" -ForegroundColor Yellow
        CY "  $TW"
        Write-Host ""
        Read-Host "  Press Enter to exit"
        exit
    }

    $pythonCmd = $null
    # Check standard commands first
    foreach ($cmd in @("python","python3","py")) {
        try { $v = & $cmd --version 2>&1; if ($v -match "Python 3") { $pythonCmd=$cmd; break } } catch {}
    }
    # Microsoft Store Python - find full exe path
    if (!$pythonCmd) {
        $storePaths = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WindowsApps" -Filter "python*.exe" -ErrorAction SilentlyContinue
        foreach ($p in $storePaths) {
            try { $v = & $p.FullName --version 2>&1; if ($v -match "Python 3") { $pythonCmd=$p.FullName; break } } catch {}
        }
    }
    # Deep search LocalPackages
    if (!$pythonCmd) {
        $pkgPaths = Get-ChildItem "$env:LOCALAPPDATA\Packages" -Recurse -Filter "python.exe" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike "*Scripts*" } | Select-Object -First 3
        foreach ($p in $pkgPaths) {
            try { $v = & $p.FullName --version 2>&1; if ($v -match "Python 3") { $pythonCmd=$p.FullName; break } } catch {}
        }
    }
    if (!$pythonCmd) {
        ERR "  ✗ Python 3 not found."
        Write-Host ""
        Write-Host "  Install free at: https://python.org/downloads" -ForegroundColor Yellow
        Write-Host "  ✓ Check 'Add to PATH' during install" -ForegroundColor Green
        Write-Host "  Then close and reopen PowerShell." -ForegroundColor White
        Write-Host ""
        Read-Host "  Press Enter to open download page"
        Start-Process "https://python.org/downloads"
        exit
    }
    return $pythonCmd
}

# ── TIER SELECTOR ─────────────────────────────────────────────
function Select-Tier {
    Write-Host ""
    DG "  ──────────────────────────────────────────────────"
    WH "  SELECT PACKAGE"
    DG "  ──────────────────────────────────────────────────"
    Write-Host ""
    Write-Host "  [1]  " -ForegroundColor Green -NoNewline
    WH "Standard Locate              " 
    Write-Host "       Address + Phone + Public Records" -ForegroundColor DarkGray
    Write-Host "       10 sources  ·  24hr turnaround  ·  " -ForegroundColor DarkGray -NoNewline
    G  "`$75"
    Write-Host ""
    Write-Host "  [2]  " -ForegroundColor Cyan -NoNewline
    WH "Comprehensive Locate + Assets"
    Write-Host "       Everything in Standard + Employment, Assets, Social Media, Criminal" -ForegroundColor DarkGray
    Write-Host "       20+ sources  ·  48hr turnaround  ·  " -ForegroundColor DarkGray -NoNewline
    G  "`$150"
    Write-Host ""
    Write-Host "  [3]  " -ForegroundColor DarkCyan -NoNewline
    WH "Property and Chain of Title    "
    Write-Host "       CAD search, deed history, liens, mineral rights, TX RRC" -ForegroundColor DarkGray
    Write-Host "       TX county records specialist  ·  48hr  ·  " -ForegroundColor DarkGray -NoNewline
    G  "`$200"
    Write-Host ""
    Write-Host "  [4]  " -ForegroundColor Magenta -NoNewline
    WH "Heir and Beneficiary Location  "
    Write-Host "       Probate support, heir locate, relatives, estate records" -ForegroundColor DarkGray
    Write-Host "       TX Courts, relatives, probate records  ·  48-72hr  ·  " -ForegroundColor DarkGray -NoNewline
    G  "`$100"
    Write-Host ""

    while ($true) {
        Write-Host "  Enter package number [1-4]: " -ForegroundColor Yellow -NoNewline
        $choice = Read-Host " "
        if ($choice -in @("1","2","3","4")) { return $choice }
        ERR "  ✗ Enter 1, 2, 3, or 4"
    }
}

# ── GENERATE CASE NUMBER ──────────────────────────────────────
function New-CaseNum($tier, $last) {
    $prefix = switch ($tier) { "1" {"STD"} "2" {"CMP"} "3" {"PTR"} "4" {"HER"} }
    $date   = Get-Date -Format "yyyyMMdd"
    $rand   = Get-Random -Minimum 100 -Maximum 999
    return "TW-$prefix-$date-$rand"
}

# ── PROGRESS ANIMATION ───────────────────────────────────────
function Show-Progress($tier) {
    $sources = switch ($tier) {
        "1" { @("TruePeopleSearch","FastPeopleSearch","Spokeo","ZabaSearch","411.com","AnyWho","PeekYou","Google OSINT","Bing","USPS Verify") }
        "2" { @("TruePeopleSearch","FastPeopleSearch","Spokeo","ZabaSearch","411.com","AnyWho","PeekYou","Google OSINT","Bing","Travis CAD","Williamson CAD","Harris CAD","TX Secretary of State","TX Courts Online","TDCJ Inmate Search","TX Sex Offender Registry","TDLR Licenses","TX Railroad Commission","LinkedIn","Facebook","Instagram","USPS Verify") }
        "3" { @("Travis CAD","Williamson CAD","Harris CAD","Milam CAD","Bell CAD","Bastrop CAD","Hays CAD","Bexar CAD","TX RRC","Travis Clerk","Williamson Clerk","Milam Clerk","Bell Clerk","TX Secretary of State","TX Courts Online","TruePeopleSearch","ZabaSearch","USPS Verify") }
        "4" { @("TruePeopleSearch","FastPeopleSearch","Spokeo","ZabaSearch","411.com","AnyWho","PeekYou","TX Courts (Probate)","TX Courts (Civil)","Travis CAD","Williamson CAD","Harris CAD","TX Secretary of State","Google OSINT","USPS Verify") }
    }
    Write-Host ""
    DG "  ──────────────────────────────────────────────────"
    G  "  RUNNING INVESTIGATION"
    DG "  ──────────────────────────────────────────────────"
    Write-Host ""
    Write-Host "  Checking $($sources.Count) sources. Do not close this window." -ForegroundColor Gray
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════
#  MAIN FLOW
# ═══════════════════════════════════════════════════════════════
Show-Banner
$pythonCmd = Check-Engine

# ── COLLECT SUBJECT INFO ──────────────────────────────────────
WH "  ─── SUBJECT INFORMATION ───────────────────────────"
Write-Host ""

$First = Ask "First Name (required)"
$Last  = Ask "Last Name (required)"
Write-Host ""
Write-Host "  Date of Birth (helps narrow results, press Enter to skip)" -ForegroundColor DarkGray
$DOB   = Ask "DOB [MM/DD/YYYY or Enter to skip]" $false
Write-Host ""
Write-Host "  Last known address (helps confirm results, press Enter to skip)" -ForegroundColor DarkGray
$Addr  = Ask "Last Known Address [or Enter to skip]" $false
Write-Host ""
Write-Host "  Last known phone (optional, press Enter to skip)" -ForegroundColor DarkGray
$Phone = Ask "Last Known Phone [or Enter to skip]" $false

# ── TIER SELECTION ────────────────────────────────────────────
$Tier = Select-Tier

# ── ATTORNEY / CLIENT INFO ────────────────────────────────────
Write-Host ""
DG "  ──────────────────────────────────────────────────"
WH "  CLIENT / ATTORNEY INFORMATION"
DG "  ──────────────────────────────────────────────────"
Write-Host "  (Press Enter to skip for personal use)" -ForegroundColor DarkGray
Write-Host ""
$AttName  = Ask "Attorney / Client Name [or Enter to skip]" $false
$AttFirm  = Ask "Firm / Organization [or Enter to skip]" $false
$AttEmail = Ask "Email to send report to [or Enter to skip]" $false

if (!$AttName)  { $AttName  = "TraceWorks Client" }
if (!$AttFirm)  { $AttFirm  = "Private" }
if (!$AttEmail) { $AttEmail = "traceworks.tx@outlook.com" }

# ── CONFIRM ───────────────────────────────────────────────────
Write-Host ""
DG "  ──────────────────────────────────────────────────"
WH "  INVESTIGATION SUMMARY — CONFIRM TO PROCEED"
DG "  ──────────────────────────────────────────────────"
Write-Host ""
Confirm-Input "Subject   " "$First $Last"
if ($DOB)   { Confirm-Input "DOB       " $DOB }
if ($Addr)  { Confirm-Input "Addr      " $Addr }
$tierNames = @{
    "1" = "Standard Locate - `$75"
    "2" = "Comprehensive Assets - `$150"
    "3" = "Property and Title - `$200"
    "4" = "Heir and Beneficiary - `$100"
}
Confirm-Input "Package   " $tierNames[$Tier]
Confirm-Input "For       " "$AttName — $AttFirm"
Write-Host ""
Write-Host "  Proceed with investigation? [Y/N]: " -ForegroundColor Yellow -NoNewline
$confirm = Read-Host " "
if ($confirm -notmatch '^[Yy]') { WH "  Cancelled."; exit }

# ── SETUP OUTPUT ─────────────────────────────────────────────
$CaseNum   = New-CaseNum $Tier $Last
$DateStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$OutFile   = "$Reports\TraceWorks-$CaseNum-${Last}_${First}-$DateStamp.xlsx"

# ── BUILD TEMP PYTHON SCRIPT ─────────────────────────────────
$py = Get-Content $Engine -Raw -Encoding UTF8

function EP($s) { return ($s -replace "\\","/" -replace "'","\\'" -replace '"','\"') }

$py = $py -replace '"{{FIRST}}"',     "`"$(EP $First)`""
$py = $py -replace '"{{LAST}}"',      "`"$(EP $Last)`""
$py = $py -replace '"{{DOB}}"',       "`"$(EP $DOB)`""
$py = $py -replace '"{{LAST_ADDR}}"', "`"$(EP $Addr)`""
$py = $py -replace '"{{LAST_PHONE}}"',"`"$(EP $Phone)`""
$py = $py -replace '"{{TIER}}"',      "`"$Tier`""
$py = $py -replace '"{{CASE_NUM}}"',  "`"$(EP $CaseNum)`""
$py = $py -replace '"{{ATT_NAME}}"',  "`"$(EP $AttName)`""
$py = $py -replace '"{{ATT_FIRM}}"',  "`"$(EP $AttFirm)`""
$py = $py -replace '"{{ATT_EMAIL}}"', "`"$(EP $AttEmail)`""
$py = $py -replace '"{{OUT_PATH}}"',  "`"$(($OutFile -replace '\\','/') )`""

$tempPy = "$env:TEMP\tw_run_$DateStamp.py"
[System.IO.File]::WriteAllText($tempPy, $py, [System.Text.Encoding]::UTF8)

# ── INSTALL PACKAGES SILENTLY ─────────────────────────────────
Write-Host ""
CY "  Checking dependencies..."
& $pythonCmd -m pip install requests beautifulsoup4 lxml openpyxl --quiet --user 2>&1 | Out-Null
GR "  ✓ Ready"

Show-Progress $Tier

# ── RUN ──────────────────────────────────────────────────────
Write-Host "  Using Python: $pythonCmd" -ForegroundColor DarkGray
$start = Get-Date
$proc = Start-Process -FilePath $pythonCmd -ArgumentList ""$tempPy"" -NoNewWindow -Wait -PassThru
$exit2 = $proc.ExitCode
$exit  = $exit2
$secs  = [math]::Round(((Get-Date) - $start).TotalSeconds)

Remove-Item $tempPy -ErrorAction SilentlyContinue

# ── RESULT ───────────────────────────────────────────────────
Write-Host ""
if ($exit -eq 0 -and (Test-Path $OutFile)) {
    DG "  ══════════════════════════════════════════════════"
    GR "  ✓  INVESTIGATION COMPLETE"
    DG "  ══════════════════════════════════════════════════"
    Write-Host ""
    G  "  Subject  : $First $Last"
    WH "  Case     : $CaseNum"
    WH "  Package  : $($tierNames[$Tier])"
    WH "  Time     : $secs seconds"
    CY "  Report   : $OutFile"
    Write-Host ""
    G  "  Next: Email the report to $AttEmail"
    Write-Host ""
    DG "  ──────────────────────────────────────────────────"
    Write-Host ""

    # Ask if they want to run another
    Write-Host "  Open report now? [Y/N]: " -ForegroundColor Cyan -NoNewline
    $open = Read-Host " "
    if ($open -match '^[Yy]') {
        Invoke-Item $OutFile
        Start-Sleep -Milliseconds 800
    }
    Write-Host ""
    Write-Host "  Run another investigation? [Y/N]: " -ForegroundColor Cyan -NoNewline
    $again = Read-Host " "
    if ($again -match '^[Yy]') {
        & $PSCommandPath
        exit
    }
} else {
    DG "  ══════════════════════════════════════════════════"
    ERR "  ✗ ENGINE ERROR — INVESTIGATION FAILED"
    DG "  ══════════════════════════════════════════════════"
    Write-Host ""
    Write-Host "  Troubleshoot:" -ForegroundColor Yellow
    Write-Host "  1. Run: python -m pip install requests beautifulsoup4 lxml openpyxl --user" -ForegroundColor White
    Write-Host "  2. Make sure tw_engine.py is in: $TW" -ForegroundColor White
    Write-Host "  3. Email: traceworks.tx@outlook.com for support" -ForegroundColor White
}

Write-Host ""
Read-Host "  Press Enter to close"
