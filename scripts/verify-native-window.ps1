param([string]$Executable)
$ErrorActionPreference = 'Stop'
$projectDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if(-not $Executable) {
    $Executable = Join-Path $projectDir 'release\AuraEVTX.exe'
}
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
function Find-Control($Root,[string]$Name) {
    $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,$Name)
    $Root.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$condition)
}
function Wait-Control($Root,[string]$Name) {
    for($attempt=0;$attempt -lt 60;$attempt++) { $control=Find-Control $Root $Name; if($control){return $control}; Start-Sleep -Milliseconds 150 }
    throw "控件未就绪：$Name"
}
function Invoke-Control($Control) { $Control.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() }
$ownApp = Start-Process -FilePath $Executable -WindowStyle Hidden -PassThru
try {
    for($attempt=0;$attempt -lt 60;$attempt++) { $ownApp.Refresh();if($ownApp.MainWindowHandle -ne 0){break};Start-Sleep -Milliseconds 150 }
    $main = [System.Windows.Automation.AutomationElement]::FromHandle($ownApp.MainWindowHandle)
    Invoke-Control (Wait-Control $main '事件浏览器 EXPLORER')
    $streamCondition = New-Object System.Windows.Automation.AndCondition((New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$ownApp.Id)),(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'AuraEVTX — 独立事件流')))
    for($attempt=0;$attempt -lt 60;$attempt++) { $stream=[System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children,$streamCondition);if($stream){break};Start-Sleep -Milliseconds 150 }
    if(-not $stream){throw '独立窗口未创建'}
    $null = Wait-Control $stream '搜索事件'
    if($stream.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Current.WindowVisualState -ne [System.Windows.Automation.WindowVisualState]::Maximized){throw '事件窗口未最大化'}
    Invoke-Control (Wait-Control $stream '外观设置')
    $null = Wait-Control $main '视觉主题'
    $null = Wait-Control $stream '搜索事件'
    Invoke-Control (Wait-Control $stream '返回主窗口')
    $null = Wait-Control $main '事件时间分布'
    $null = Wait-Control $stream '搜索事件'
    'Native verification passed: independent maximized window and main-window navigation remain isolated.'
} finally {
    # Only terminate the exact process launched by this script.
    $ownApp.Refresh()
    if(-not $ownApp.HasExited){Stop-Process -Id $ownApp.Id}
}
