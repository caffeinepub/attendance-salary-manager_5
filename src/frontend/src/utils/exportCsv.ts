import type { Advance, Attendance, Contract, Labour } from "../backend";

function escapeCell(
  value: string | number | bigint | boolean | undefined | null,
): string {
  const str = value === undefined || value === null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(
  ...cells: (string | number | bigint | boolean | undefined | null)[]
): string {
  return cells.map(escapeCell).join(",");
}

export function buildCsv(
  contracts: Contract[],
  labours: Labour[],
  advances: Advance[],
  attendanceMap: Map<bigint, Attendance[]>,
): string {
  const lines: string[] = [];

  // --- CONTRACTS SECTION ---
  lines.push("=== CONTRACTS ===");
  lines.push(
    row(
      "ID",
      "Name",
      "Contract Amount",
      "Bed Amount",
      "Paper Amount",
      "Mesh Amount",
      "Machine Exp",
      "Multiplier",
      "Mesh Columns",
      "Settled",
    ),
  );
  for (const c of contracts) {
    lines.push(
      row(
        c.id,
        c.name,
        c.contractAmount,
        c.bedAmount,
        c.paperAmount,
        c.meshAmount,
        c.machineExp,
        c.multiplierValue,
        c.meshColumns.join(" | "),
        c.isSettled ? "Yes" : "No",
      ),
    );
  }
  lines.push("");

  // --- LABOURS SECTION ---
  lines.push("=== LABOURS ===");
  lines.push(row("ID", "Name", "Phone"));
  for (const l of labours) {
    lines.push(row(l.id, l.name, l.phone ?? ""));
  }
  lines.push("");

  // --- ADVANCES SECTION ---
  const labourMap = new Map(labours.map((l) => [l.id, l.name]));
  const contractMap = new Map(contracts.map((c) => [c.id, c.name]));

  lines.push("=== ADVANCES ===");
  lines.push(row("ID", "Labour", "Contract", "Amount", "Note"));
  for (const a of advances) {
    lines.push(
      row(
        a.id,
        labourMap.get(a.labourId) ?? String(a.labourId),
        contractMap.get(a.contractId) ?? String(a.contractId),
        a.amount,
        a.note,
      ),
    );
  }
  lines.push("");

  // --- ATTENDANCE SECTION (per contract) ---
  lines.push("=== ATTENDANCE ===");
  for (const c of contracts) {
    const attendance = attendanceMap.get(c.id) ?? [];
    if (attendance.length === 0) continue;
    lines.push(`--- Contract: ${c.name} ---`);
    lines.push(row("Labour", "Column Type", "Value"));
    for (const a of attendance) {
      const colTypeStr =
        a.columnType.__kind__ === "bed"
          ? "Bed"
          : a.columnType.__kind__ === "paper"
            ? "Paper"
            : `Mesh (${a.columnType.__kind__ === "mesh" ? a.columnType.mesh : ""})`;
      lines.push(
        row(
          labourMap.get(a.labourId) ?? String(a.labourId),
          colTypeStr,
          a.value,
        ),
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadCsv(content: string): void {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const filename = `attendpay_export_${yyyy}-${mm}-${dd}.csv`;

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
