[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "🔄 正在检查并刷新 WeLink 认证状态 (防 401 假死)..." -ForegroundColor Cyan
$statusOutput = welink-cli auth status 2>&1 | Out-String
$envParam = ""
if ($statusOutput -match "Environment:\s*pro") { $envParam = "--env pro" }
Write-Host "> welink-cli auth login $envParam" -ForegroundColor DarkCyan
Invoke-Expression "welink-cli auth login $envParam"

Write-Host "🚀 开始执行自动化分发任务..." -ForegroundColor Green

Write-Host "`n➤ 正在向 [Update] 2026 CS OKR Performance Tracker (964680015625281562) 发送私聊消息..." -ForegroundColor DarkGray
$msg_964680015625281562 = @"
⚡ 交付质量红线督办预警

【[Update] 2026 CS OKR Performance Tracker】您好，您负责的代表处/业务线下存在临期或超期的高危风险数据：
 【SR详单监控】 SR001 (SR超期: 已超 24 小时)
 【SR详单监控】 SR003 (历史超期: 已超 5 天)

>> 请各位总干事重点跟进以上超期和高危单据并尽快闭环，该通报结果将于月末直接折算计入部门总分。系统自动通报，请勿回复。
"@
$out = welink-cli im send-to-user --receiver "964680015625281562" --text "$msg_964680015625281562" 2>&1 | Out-String
if (-not [string]::IsNullOrWhiteSpace($out)) { Write-Host $out.Trim() }

Write-Host "`n➤ 正在向 ET SPM Sameh (s00712126) 发送私聊消息..." -ForegroundColor DarkGray
$msg_s00712126 = @"
⚡ 交付质量红线督办预警

【ET SPM Sameh】您好，您负责的代表处/业务线下存在临期或超期的高危风险数据：
 【SR详单监控】 SR001 (SR超期: 已超 24 小时)
 【SR详单监控】 SR003 (历史超期: 已超 5 天)

>> 请各位总干事重点跟进以上超期和高危单据并尽快闭环，该通报结果将于月末直接折算计入部门总分。系统自动通报，请勿回复。
"@
$out = welink-cli im send-to-user --receiver "s00712126" --text "$msg_s00712126" 2>&1 | Out-String
if (-not [string]::IsNullOrWhiteSpace($out)) { Write-Host $out.Trim() }

Write-Host "`n➤ 正在向 TE SPM Gamal (m00268646) 发送私聊消息..." -ForegroundColor DarkGray
$msg_m00268646 = @"
⚡ 交付质量红线督办预警

【TE SPM Gamal】您好，您负责的代表处/业务线下存在临期或超期的高危风险数据：
 【SR详单监控】 SR001 (SR超期: 已超 24 小时)
 【SR详单监控】 SR003 (历史超期: 已超 5 天)

>> 请各位总干事重点跟进以上超期和高危单据并尽快闭环，该通报结果将于月末直接折算计入部门总分。系统自动通报，请勿回复。
"@
$out = welink-cli im send-to-user --receiver "m00268646" --text "$msg_m00268646" 2>&1 | Out-String
if (-not [string]::IsNullOrWhiteSpace($out)) { Write-Host $out.Trim() }

Write-Host "`n➤ 正在向 ORG TD youssef (i00823621) 发送私聊消息..." -ForegroundColor DarkGray
$msg_i00823621 = @"
⚡ 交付质量红线督办预警

【ORG TD youssef】您好，您负责的代表处/业务线下存在临期或超期的高危风险数据：
 【SR详单监控】 SR001 (SR超期: 已超 24 小时)
 【SR详单监控】 SR003 (历史超期: 已超 5 天)

>> 请各位总干事重点跟进以上超期和高危单据并尽快闭环，该通报结果将于月末直接折算计入部门总分。系统自动通报，请勿回复。
"@
$out = welink-cli im send-to-user --receiver "i00823621" --text "$msg_i00823621" 2>&1 | Out-String
if (-not [string]::IsNullOrWhiteSpace($out)) { Write-Host $out.Trim() }

Write-Host "`n➤ 正在向 VDF SPM haitham (h89094) 发送私聊消息..." -ForegroundColor DarkGray
$msg_h89094 = @"
⚡ 交付质量红线督办预警

【VDF SPM haitham】您好，您负责的代表处/业务线下存在临期或超期的高危风险数据：
 【SR详单监控】 SR001 (SR超期: 已超 24 小时)
 【SR详单监控】 SR003 (历史超期: 已超 5 天)

>> 请各位总干事重点跟进以上超期和高危单据并尽快闭环，该通报结果将于月末直接折算计入部门总分。系统自动通报，请勿回复。
"@
$out = welink-cli im send-to-user --receiver "h89094" --text "$msg_h89094" 2>&1 | Out-String
if (-not [string]::IsNullOrWhiteSpace($out)) { Write-Host $out.Trim() }

Write-Host "`n➤ 正在向 ElSayed (00817676) 发送私聊消息..." -ForegroundColor DarkGray
$msg_00817676 = @"
⚡ 交付质量红线督办预警

【ElSayed】您好，您负责的代表处/业务线下存在临期或超期的高危风险数据：
 【SR详单监控】 SR001 (SR超期: 已超 24 小时)
 【SR详单监控】 SR003 (历史超期: 已超 5 天)

>> 请各位总干事重点跟进以上超期和高危单据并尽快闭环，该通报结果将于月末直接折算计入部门总分。系统自动通报，请勿回复。
"@
$out = welink-cli im send-to-user --receiver "00817676" --text "$msg_00817676" 2>&1 | Out-String
if (-not [string]::IsNullOrWhiteSpace($out)) { Write-Host $out.Trim() }

Write-Host "`n✅ 全部分发任务已完成！" -ForegroundColor Green
