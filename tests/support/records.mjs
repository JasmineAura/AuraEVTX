import { readFileSync } from "node:fs";
export function buildRecords() {
  const catalog = JSON.parse(
    readFileSync(new URL("../../shared/catalog.json", import.meta.url), "utf8"),
  );
  const distribution = [
    [22, 3],
    [1, 6],
    [11, 56],
    [23, 26],
    [13, 19],
    [2, 16],
    [7, 15],
    [12, 14],
    [17, 7],
    [15, 2],
    [26, 2],
    [3, 1],
    [5, 1],
    [10, 1],
  ];
  let sequence = 0;
  return distribution.flatMap(([event_id, count]) =>
    Array.from({ length: count }, () => {
      const id = ++sequence;
      const definition = catalog.find(
        (d) => d.provider === "Microsoft-Windows-Sysmon" && d.id === event_id,
      );
      const fields = {
        Image: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        ProcessGuid: `{00000000-0000-0000-0000-${String(id).padStart(12, "0")}}`,
        ProcessId: "4800",
        User: "LAB\\Analyst",
      };
      if (event_id === 1)
        fields.CommandLine =
          "powershell.exe -NoProfile -File C:\\IR\\Collect.ps1";
      if (event_id === 22) fields.QueryName = "updates.contoso.test";
      if ([11, 23, 26].includes(event_id))
        fields.TargetFilename = `C:\\IR\\Output\\evidence-${id}.json`;
      const time = new Date(
        Date.UTC(2026, 9, 22, 2, 10, Math.floor(id / 2)),
      ).toISOString();
      return {
        id,
        file_id: 1,
        record_id: 118700 + id,
        event_id,
        provider: definition.provider,
        channel: definition.channel,
        computer: "IR-LAB-01",
        time,
        level: 4,
        operation: definition.title,
        category: definition.category,
        summary: Object.entries(fields)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · "),
        bookmarked: false,
        source: "Sysmon-Operational.evtx",
        fields,
        xml: `<Event><System><EventID>${event_id}</EventID></System><EventData><Data Name="Image">${fields.Image}</Data></EventData></Event>`,
      };
    }),
  );
}
