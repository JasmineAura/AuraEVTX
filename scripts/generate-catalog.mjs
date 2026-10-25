import { mkdirSync, writeFileSync } from "node:fs";
const entries = [];
function add(provider, channel, source, rows) {
  for (const [id, title, category, description] of rows)
    entries.push({
      provider,
      channel,
      id,
      title,
      category,
      description,
      source,
    });
}
add(
  "Microsoft-Windows-Sysmon",
  "Microsoft-Windows-Sysmon/Operational",
  "https://learn.microsoft.com/sysinternals/downloads/sysmon",
  [
    [
      1,
      "进程创建",
      "进程",
      "记录进程映像、命令行、哈希、用户和父进程。优先通过 ProcessGuid 关联后续行为。",
    ],
    [
      2,
      "文件创建时间修改",
      "文件",
      "进程修改了文件的创建时间。正常软件也可能执行此操作，需结合文件及进程上下文判断。",
    ],
    [
      3,
      "网络连接",
      "网络",
      "记录 TCP/UDP 连接的进程、源地址及目标地址。事件是否存在取决于采集配置。",
    ],
    [4, "Sysmon 服务状态变更", "系统", "Sysmon 服务启动或停止。"],
    [
      5,
      "进程终止",
      "进程",
      "记录进程终止，可结合 ProcessGuid 确定进程生命周期。",
    ],
    [6, "驱动加载", "进程", "记录驱动加载及其哈希和签名信息。"],
    [
      7,
      "映像 / DLL 加载",
      "进程",
      "记录进程加载的模块、哈希和签名。不能仅凭 DLL 加载判定注入。",
    ],
    [
      8,
      "创建远程线程",
      "进程",
      "一个进程在另一个进程中创建线程，需核对源进程、目标进程与起始地址。",
    ],
    [9, "原始磁盘访问", "文件", "记录进程使用原始访问方式读取磁盘或卷。"],
    [
      10,
      "进程访问",
      "进程",
      "记录源进程打开目标进程的行为及 GrantedAccess；访问本身不等于恶意注入。",
    ],
    [
      11,
      "文件创建 / 覆盖",
      "文件",
      "进程创建或覆盖文件。结合 Image、TargetFilename 和 ProcessGuid 分析。",
    ],
    [
      12,
      "注册表对象创建 / 删除",
      "注册表",
      "记录注册表键或值的创建与删除，具体动作见 EventType。",
    ],
    [
      13,
      "注册表值设置",
      "注册表",
      "记录注册表值写入，检查 TargetObject 和 Details。",
    ],
    [14, "注册表键 / 值重命名", "注册表", "记录注册表对象重命名。"],
    [
      15,
      "文件流创建及哈希",
      "文件",
      "记录命名文件流创建及哈希，可用于分析 Zone.Identifier 等备用数据流。",
    ],
    [16, "Sysmon 配置变更", "系统", "记录 Sysmon 过滤配置变更。"],
    [
      17,
      "命名管道创建",
      "进程",
      "进程创建命名管道。结合 PipeName 与进程上下文分析。",
    ],
    [18, "命名管道连接", "进程", "进程连接命名管道。"],
    [
      19,
      "WMI 事件过滤器活动",
      "持久化",
      "记录 WMI 事件过滤器注册等活动，具体动作见 Operation。",
    ],
    [20, "WMI 事件消费者活动", "持久化", "记录 WMI 事件消费者注册等活动。"],
    [21, "WMI 消费者绑定活动", "持久化", "记录 WMI 过滤器与消费者绑定关系。"],
    [
      22,
      "DNS 查询",
      "网络",
      "记录进程 DNS 查询、状态和结果。查询不意味着已建立网络连接。",
    ],
    [
      23,
      "文件删除并归档",
      "文件",
      "记录被删除文件并按 Sysmon 配置归档。EVTX 本身不包含归档文件内容。",
    ],
    [24, "剪贴板变更", "系统", "记录剪贴板内容变化相关信息，依赖采集配置。"],
    [
      25,
      "进程篡改检测",
      "进程",
      "Sysmon 检测到进程映像篡改行为，检查 Type 等字段。",
    ],
    [26, "文件删除记录", "文件", "记录文件删除，不进行文件归档。"],
    [
      27,
      "阻止可执行文件创建",
      "文件",
      "Sysmon 阻止了符合配置的可执行文件创建。",
    ],
    [28, "阻止文件粉碎", "文件", "Sysmon 阻止了符合配置的文件粉碎操作。"],
    [
      29,
      "检测到可执行文件创建",
      "文件",
      "Sysmon 检测到可执行文件创建，结合文件路径及哈希判断。",
    ],
    [
      255,
      "Sysmon 内部错误",
      "系统",
      "Sysmon 处理任务时发生错误，可能影响日志覆盖。",
    ],
  ],
);
add(
  "Microsoft-Windows-Security-Auditing",
  "Security",
  "https://learn.microsoft.com/windows/security/threat-protection/auditing/advanced-security-auditing-faq",
  [
    [1100, "事件日志服务关闭", "审计", "Windows 事件日志服务关闭。"],
    [
      1101,
      "审计事件丢失",
      "审计",
      "审计事件在传输过程中丢失，需检查采集完整性。",
    ],
    [
      1102,
      "安全日志被清除",
      "审计",
      "安全审计日志被清除，检查执行用户和时间。",
    ],
    [
      4616,
      "系统时间修改",
      "系统",
      "系统时间发生更改，核对旧时间、新时间和执行主体。",
    ],
    [
      4624,
      "账户登录成功",
      "登录",
      "检查 TargetUserName、LogonType、IpAddress、TargetLogonId。网络登录不等于交互登录。",
    ],
    [
      4625,
      "账户登录失败",
      "登录",
      "检查失败原因、状态码、登录类型及来源地址。",
    ],
    [
      4634,
      "登录会话结束",
      "登录",
      "登录会话注销，使用 LogonId 关联同主机中的登录事件。",
    ],
    [4647, "用户主动注销", "登录", "用户发起注销操作。"],
    [4648, "使用显式凭据登录", "登录", "进程使用显式提供的凭据尝试登录。"],
    [
      4672,
      "新登录获特殊权限",
      "权限",
      "登录被授予敏感权限，常见于管理员和系统账户，并不直接代表提权。",
    ],
    [
      4673,
      "调用特权服务",
      "权限",
      "发生特权服务调用，结合主体和权限列表判断。",
    ],
    [4674, "特权对象操作", "权限", "进程尝试对特权对象执行操作。"],
    [
      4688,
      "新进程创建",
      "进程",
      "记录新进程及创建者。命令行是否记录取决于审计策略。",
    ],
    [4689, "进程退出", "进程", "记录进程终止及退出状态。"],
    [
      4697,
      "服务安装",
      "持久化",
      "系统中安装了服务，检查服务映像、账户与启动方式。",
    ],
    [4698, "计划任务创建", "持久化", "记录新计划任务及任务 XML。"],
    [4699, "计划任务删除", "持久化", "记录计划任务删除。"],
    [4700, "计划任务启用", "持久化", "记录计划任务启用。"],
    [4701, "计划任务禁用", "持久化", "记录计划任务禁用。"],
    [4702, "计划任务更新", "持久化", "记录计划任务配置更新。"],
    [4719, "系统审计策略变更", "审计", "记录系统审计策略更改。"],
    [4720, "用户账户创建", "账户", "创建用户账户。"],
    [4722, "用户账户启用", "账户", "启用用户账户。"],
    [4723, "尝试修改账户密码", "账户", "用户尝试更改账户密码。"],
    [
      4724,
      "尝试重置账户密码",
      "账户",
      "尝试重置其他账户的密码，核对操作主体。",
    ],
    [4725, "用户账户禁用", "账户", "禁用用户账户。"],
    [4726, "用户账户删除", "账户", "删除用户账户。"],
    [4728, "成员加入全局安全组", "账户", "成员被添加到启用安全的全局组。"],
    [4729, "成员移出全局安全组", "账户", "成员被移出启用安全的全局组。"],
    [
      4732,
      "成员加入本地安全组",
      "账户",
      "成员被添加到本地安全组，检查是否为 Administrators 等敏感组。",
    ],
    [4733, "成员移出本地安全组", "账户", "成员被移出本地安全组。"],
    [4738, "用户账户属性变更", "账户", "记录用户账户属性修改。"],
    [4740, "用户账户锁定", "账户", "用户账户被锁定，结合登录失败来源分析。"],
    [4741, "计算机账户创建", "账户", "创建计算机账户。"],
    [4742, "计算机账户变更", "账户", "修改计算机账户。"],
    [4743, "计算机账户删除", "账户", "删除计算机账户。"],
    [4756, "成员加入通用安全组", "账户", "成员被添加到启用安全的通用组。"],
    [4767, "用户账户解锁", "账户", "用户账户被解锁。"],
    [
      4768,
      "请求 Kerberos TGT",
      "登录",
      "域控制器处理 Kerberos 身份验证服务票据请求，核对状态与加密类型。",
    ],
    [
      4769,
      "请求 Kerberos 服务票据",
      "登录",
      "域控制器处理 Kerberos 服务票据请求，需结合服务名、账户及加密类型。",
    ],
    [4770, "Kerberos 服务票据续订", "登录", "Kerberos 服务票据续订。"],
    [
      4771,
      "Kerberos 预身份验证失败",
      "登录",
      "Kerberos 预身份验证失败，核对 FailureCode。",
    ],
    [
      4776,
      "凭据验证",
      "登录",
      "计算机尝试验证账户凭据，常用于 NTLM 身份验证调查。",
    ],
    [4778, "会话重新连接", "登录", "会话重新连接到窗口工作站。"],
    [4779, "会话断开", "登录", "会话从窗口工作站断开。"],
    [4798, "枚举用户本地组成员关系", "账户", "枚举用户的本地组成员关系。"],
    [4799, "枚举本地安全组成员", "账户", "枚举本地安全组成员。"],
    [4800, "工作站锁定", "登录", "工作站被锁定。"],
    [4801, "工作站解锁", "登录", "工作站被解锁。"],
    [
      4656,
      "请求对象句柄",
      "对象访问",
      "请求访问对象的句柄，需结合 ObjectType、ObjectName 和 AccessMask。",
    ],
    [4657, "注册表值修改", "注册表", "注册表值被修改，依赖对象审计配置。"],
    [4660, "对象删除", "对象访问", "对象被删除，关联 HandleId 获取对象信息。"],
    [
      4662,
      "目录服务对象操作",
      "对象访问",
      "对目录服务对象执行操作，需结合访问权限和对象 GUID。",
    ],
    [
      4663,
      "对象访问尝试",
      "对象访问",
      "对象被尝试访问，具体操作由访问掩码确定。",
    ],
    [
      5140,
      "网络共享访问",
      "网络",
      "网络共享对象被访问，检查共享名和来源地址。",
    ],
    [5142, "网络共享创建", "网络", "新建网络共享对象。"],
    [5143, "网络共享修改", "网络", "修改网络共享对象。"],
    [5144, "网络共享删除", "网络", "删除网络共享对象。"],
    [
      5145,
      "网络共享访问检查",
      "网络",
      "对共享中的对象执行访问权限检查，结合相对路径与访问掩码。",
    ],
    [5156, "筛选平台允许连接", "网络", "Windows 筛选平台允许网络连接。"],
    [5157, "筛选平台阻止连接", "网络", "Windows 筛选平台阻止网络连接。"],
    [5136, "目录服务对象修改", "对象访问", "Active Directory 对象被修改。"],
    [5137, "目录服务对象创建", "对象访问", "Active Directory 对象被创建。"],
    [5139, "目录服务对象移动", "对象访问", "Active Directory 对象被移动。"],
    [5141, "目录服务对象删除", "对象访问", "Active Directory 对象被删除。"],
  ],
);
add(
  "Service Control Manager",
  "System",
  "https://learn.microsoft.com/windows/win32/services/service-control-manager",
  [
    [7031, "服务意外终止", "系统", "服务意外终止，可能配置了恢复操作。"],
    [7034, "服务意外终止", "系统", "服务意外终止。"],
    [7035, "服务收到控制请求", "系统", "服务收到启动、停止等控制请求。"],
    [7036, "服务状态变更", "系统", "服务进入运行、停止等状态。"],
    [7040, "服务启动类型变更", "持久化", "服务启动类型被修改。"],
    [
      7045,
      "新服务安装",
      "持久化",
      "系统中安装了新服务。检查 ImagePath、ServiceName 和 AccountName。",
    ],
  ],
);
add(
  "Microsoft-Windows-PowerShell",
  "Microsoft-Windows-PowerShell/Operational",
  "https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_logging_windows",
  [
    [4103, "PowerShell 模块日志", "脚本", "记录管道执行及模块调用信息。"],
    [
      4104,
      "PowerShell 脚本块",
      "脚本",
      "记录脚本块文本，长脚本可能分片，使用 ScriptBlockId 和 MessageNumber 重组。",
    ],
    [4105, "脚本块执行开始", "脚本", "脚本块调用开始，依赖相应日志配置。"],
    [4106, "脚本块执行结束", "脚本", "脚本块调用结束。"],
  ],
);
add(
  "PowerShell",
  "Windows PowerShell",
  "https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_logging_windows",
  [
    [400, "PowerShell 引擎启动", "脚本", "PowerShell 引擎状态变为 Available。"],
    [403, "PowerShell 引擎停止", "脚本", "PowerShell 引擎状态变为 Stopped。"],
    [
      600,
      "PowerShell 提供程序状态",
      "脚本",
      "PowerShell 提供程序生命周期事件。",
    ],
    [800, "PowerShell 管道执行", "脚本", "记录 PowerShell 管道执行详情。"],
  ],
);
add(
  "Microsoft-Windows-TaskScheduler",
  "Microsoft-Windows-TaskScheduler/Operational",
  "https://learn.microsoft.com/windows/win32/taskschd/task-scheduler-start-page",
  [
    [100, "计划任务启动", "持久化", "任务实例开始运行。"],
    [102, "计划任务完成", "持久化", "任务实例完成。"],
    [106, "计划任务注册", "持久化", "计划任务被注册。"],
    [140, "计划任务更新", "持久化", "计划任务配置被更新。"],
    [141, "计划任务删除", "持久化", "计划任务被删除。"],
    [200, "计划任务动作启动", "持久化", "计划任务中的动作开始执行。"],
    [201, "计划任务动作完成", "持久化", "计划任务动作完成，检查返回码。"],
  ],
);
add(
  "Microsoft-Windows-Windows Defender",
  "Microsoft-Windows-Windows Defender/Operational",
  "https://learn.microsoft.com/defender-endpoint/troubleshoot-microsoft-defender-antivirus",
  [
    [
      1000,
      "Defender 扫描启动",
      "防护",
      "Microsoft Defender Antivirus 开始扫描。",
    ],
    [
      1001,
      "Defender 扫描完成",
      "防护",
      "Microsoft Defender Antivirus 扫描完成。",
    ],
    [
      1116,
      "检测到恶意软件或潜在不需要的软件",
      "防护",
      "Defender 检测到威胁，结合 ThreatName、Path 和后续处置结果。",
    ],
    [
      1117,
      "Defender 威胁处置",
      "防护",
      "Defender 对检测到的威胁执行操作，检查处置结果。",
    ],
    [
      1118,
      "Defender 威胁处置失败",
      "防护",
      "Defender 对检测到的威胁执行操作时发生非严重错误。",
    ],
    [5001, "实时保护禁用", "防护", "Defender 实时保护被禁用。"],
    [
      5007,
      "Defender 配置变更",
      "防护",
      "Defender 配置发生变化；正常系统维护也会触发。",
    ],
  ],
);
add(
  "Microsoft-Windows-TerminalServices-LocalSessionManager",
  "Microsoft-Windows-TerminalServices-LocalSessionManager/Operational",
  "https://learn.microsoft.com/troubleshoot/windows-server/remote/remote-desktop-services-overview",
  [
    [21, "远程桌面会话登录成功", "登录", "远程桌面服务会话登录成功。"],
    [22, "远程桌面 Shell 启动", "登录", "远程桌面会话收到 Shell 启动通知。"],
    [23, "远程桌面会话注销", "登录", "远程桌面会话注销成功。"],
    [24, "远程桌面会话断开", "登录", "远程桌面会话已断开。"],
    [25, "远程桌面会话重新连接", "登录", "远程桌面会话重新连接成功。"],
  ],
);
add(
  "Microsoft-Windows-TerminalServices-RemoteConnectionManager",
  "Microsoft-Windows-TerminalServices-RemoteConnectionManager/Operational",
  "https://learn.microsoft.com/troubleshoot/windows-server/remote/remote-desktop-services-overview",
  [
    [
      1149,
      "远程桌面用户身份验证成功",
      "登录",
      "远程桌面用户身份验证成功，不单独证明桌面会话已建立。",
    ],
  ],
);
add(
  "Microsoft-Windows-Eventlog",
  "System",
  "https://learn.microsoft.com/windows/win32/wes/windows-event-log",
  [
    [
      104,
      "事件日志清除",
      "审计",
      "某个事件日志被清除，核对日志名称和执行主体。",
    ],
  ],
);
add(
  "EventLog",
  "System",
  "https://learn.microsoft.com/windows/win32/eventlog/event-logging",
  [
    [
      6005,
      "事件日志服务启动",
      "系统",
      "事件日志服务启动，常作为系统启动的辅助线索。",
    ],
    [6006, "事件日志服务停止", "系统", "事件日志服务停止，常见于正常关机。"],
    [6008, "上次关机异常", "系统", "系统检测到上一次关机不正常。"],
  ],
);
add(
  "Microsoft-Windows-Kernel-Power",
  "System",
  "https://learn.microsoft.com/troubleshoot/windows-client/performance/event-id-41-restart",
  [
    [
      41,
      "系统未正常关闭后重新启动",
      "系统",
      "系统在未正常关闭的情况下重新启动，不能单凭此事件确定原因。",
    ],
  ],
);
add(
  "Application Error",
  "Application",
  "https://learn.microsoft.com/windows/win32/wer/windows-error-reporting",
  [
    [
      1000,
      "应用程序崩溃",
      "应用",
      "应用程序发生故障，检查故障模块、异常代码和程序路径。",
    ],
  ],
);
add(
  "Windows Error Reporting",
  "Application",
  "https://learn.microsoft.com/windows/win32/wer/windows-error-reporting",
  [
    [
      1001,
      "Windows 错误报告",
      "应用",
      "系统生成错误报告，检查事件类型和故障桶。",
    ],
  ],
);
const firewallProvider =
  "Microsoft-Windows-Windows Firewall With Advanced Security";
const firewallChannel = `${firewallProvider}/Firewall`;
for (const [id, title, description, page] of [
  [
    2004,
    "防火墙规则添加",
    "向 Windows 防火墙例外列表添加规则。检查规则名称、应用程序路径、方向、协议、端口、操作及修改用户与程序；添加规则不代表已发生网络连接。",
    "EventId_2004_Microsoft-Windows-WindowsFirewallwithAdvancedS_65673.asp",
  ],
  [
    2005,
    "防火墙规则修改",
    "修改 Windows 防火墙例外列表中的规则。核对规则 ID、名称、适用配置文件、允许或阻止操作，以及修改用户与程序；事件不一定包含修改前的值。",
    "EventId_2005_Microsoft-Windows-WindowsFirewallwithAdvancedS_65674.asp",
  ],
  [
    2006,
    "防火墙规则删除",
    "从 Windows 防火墙例外列表删除规则。检查 RuleId、RuleName、ModifyingUser 和 ModifyingApplication，并结合相邻的规则添加或修改事件分析。",
    "EventId_2006_Microsoft-Windows-WindowsFirewallwithAdvancedS_65675.asp",
  ],
  [
    2010,
    "网络接口配置文件变更",
    "网络接口使用的网络配置文件发生变化。检查 InterfaceGuid、InterfaceName、OldProfile 和 NewProfile；此事件本身不代表防火墙已关闭。",
    "EventId_2010_Microsoft-Windows-WindowsFirewallwithAdvancedS_65677.asp",
  ],
  [
    2033,
    "防火墙全部规则删除",
    "Windows 防火墙配置中的所有规则被删除。检查存储类型、ModifyingUser 与 ModifyingApplication，并结合策略应用、配置重置及后续规则事件判断原因。",
    "EventId_2033_Microsoft-Windows-WindowsFirewallwithAdvancedS_65679.asp",
  ],
])
  add(
    firewallProvider,
    firewallChannel,
    `https://kb.eventtracker.com/evtpass/evtPages/${page}`,
    [[id, title, "网络", description]],
  );

// Security log clear / loss events belong to Eventlog, not Security-Auditing.
for (const entry of entries) {
  if (
    entry.provider === "Microsoft-Windows-Security-Auditing" &&
    [1100, 1101, 1102].includes(entry.id)
  ) {
    entry.provider = "Microsoft-Windows-Eventlog";
    entry.source = `https://learn.microsoft.com/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-${entry.id}`;
  }
}
mkdirSync("shared", { recursive: true });
writeFileSync("shared/catalog.json", JSON.stringify(entries, null, 2) + "\n");
console.log(`Generated ${entries.length} provider-scoped event definitions.`);
