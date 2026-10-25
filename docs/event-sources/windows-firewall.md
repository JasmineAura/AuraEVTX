# Windows 防火墙事件适配

提供者：`Microsoft-Windows-Windows Firewall With Advanced Security`

通道：`Microsoft-Windows-Windows Firewall With Advanced Security/Firewall`

已核对开发机上 Windows 提供者的事件元数据（Microsoft 原生消息与字段模板），五个 ID 的 LogLink 均指向上述通道。可只读复核：

```powershell
$provider = Get-WinEvent -ListProvider 'Microsoft-Windows-Windows Firewall With Advanced Security'
$provider.Events | Where-Object Id -in 2004,2005,2006,2010,2033 |
    Select-Object Id, Description, Template, @{Name='Channel';Expression={$_.LogLink.LogName}}
```

| ID | 含义 | 重点字段 |
| --- | --- | --- |
| 2004 | 添加防火墙例外规则 | RuleId、RuleName、ApplicationPath、Direction、Action、LocalPorts、RemotePorts、ModifyingUser、ModifyingApplication |
| 2005 | 修改防火墙例外规则 | 同上，不能假定事件包含修改前的值 |
| 2006 | 删除防火墙例外规则 | RuleId、RuleName、ModifyingUser、ModifyingApplication |
| 2010 | 网络接口配置文件改变 | InterfaceGuid、InterfaceName、OldProfile、NewProfile |
| 2033 | 删除防火墙配置的所有规则 | Store Type、ModifyingUser、ModifyingApplication |

图鉴保留用户提供的 EventTracker 参考链接；这些网页此次读取超时，事件含义、提供者、通道及字段以 Windows 原生元数据核验。规则变更不等于发生连接，配置文件变更也不等于防火墙关闭。
