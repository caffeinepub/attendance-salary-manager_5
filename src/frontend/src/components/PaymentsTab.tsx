import { useEffect, useRef, useState } from "react";
import type { Attendance, Contract, Labour } from "../backend.d";
import { useActor } from "../hooks/useActor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyActor = any;

function attendanceNum(v: string): number {
  if (v === "Present" || v === "present") return 1;
  if (v === "Absent" || v === "absent") return 0;
  return Number.parseFloat(v) || 0;
}

interface LabourPayment {
  labourId: bigint;
  labourName: string;
  contractSalaries: Map<string, number>;
  totalGross: number;
  totalAdvances: number;
  finalPayment: number;
}

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

export function PaymentsTab() {
  const { actor } = useActor();
  const a = actor as AnyActor;

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedLabourIds, setSelectedLabourIds] = useState<Set<string>>(
    new Set(),
  );
  const [payments, setPayments] = useState<LabourPayment[]>([]);
  const [loading, setLoading] = useState(false);

  const [contractDropOpen, setContractDropOpen] = useState(false);
  const [labourDropOpen, setLabourDropOpen] = useState(false);
  const contractDropRef = useRef<HTMLDivElement>(null);
  const labourDropRef = useRef<HTMLDivElement>(null);

  // Overview dialog state
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overviewIndex, setOverviewIndex] = useState(0);
  const [heldIndex, setHeldIndex] = useState<number | null>(null);

  useClickOutside(contractDropRef, () => setContractDropOpen(false));
  useClickOutside(labourDropRef, () => setLabourDropOpen(false));

  // biome-ignore lint/correctness/useExhaustiveDependencies: a is derived from actor
  useEffect(() => {
    if (!a) return;
    a.getAllContracts().then((cs: Contract[]) =>
      setContracts(cs.filter((c) => !c.isSettled)),
    );
    a.getAllLabours().then((ls: Labour[]) => {
      setLabours(ls);
      setSelectedLabourIds(new Set(ls.map((l) => String(l.id))));
    });
  }, [actor]);

  const toggleContract = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLabour = (id: string) => {
    setSelectedLabourIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allLaboursSelected =
    labours.length > 0 &&
    labours.every((l) => selectedLabourIds.has(String(l.id)));

  const toggleAllLabours = () => {
    if (allLaboursSelected) {
      setSelectedLabourIds(new Set());
    } else {
      setSelectedLabourIds(new Set(labours.map((l) => String(l.id))));
    }
  };

  const filteredLabours = labours.filter((l) =>
    selectedLabourIds.has(String(l.id)),
  );

  const calculate = async () => {
    if (!a) return;
    setLoading(true);
    try {
      const labourMap = new Map<string, LabourPayment>();

      for (const l of labours) {
        labourMap.set(String(l.id), {
          labourId: l.id,
          labourName: l.name,
          contractSalaries: new Map(),
          totalGross: 0,
          totalAdvances: 0,
          finalPayment: 0,
        });
      }

      for (const idStr of selectedIds) {
        const cid = BigInt(idStr);
        const contract = contracts.find((c) => String(c.id) === idStr);
        if (!contract) continue;

        const [attendanceList, advancesList] = await Promise.all([
          a.getAttendanceByContract(cid),
          a.getAdvancesByContract(cid),
        ]);

        const attMap = new Map<string, Map<string, string>>();
        for (const att of attendanceList as Attendance[]) {
          const lid = String(att.labourId);
          if (!attMap.has(lid)) attMap.set(lid, new Map());
          const colKey = getColKey(att);
          attMap.get(lid)!.set(colKey, att.value);
        }

        const getVal = (labourId: bigint, colKey: string): string => {
          return attMap.get(String(labourId))?.get(colKey) ?? "Absent";
        };

        const colSum = (colKey: string): number =>
          labours.reduce((s, l) => s + attendanceNum(getVal(l.id, colKey)), 0);

        const meshTotal = contract.meshColumns.reduce((s, _, i) => {
          return s + colSum(`mesh_${i}`);
        }, 0);

        const advanceMap = new Map<string, number>();
        for (const adv of advancesList as Array<{
          labourId: bigint;
          amount: bigint;
        }>) {
          const lid = String(adv.labourId);
          advanceMap.set(lid, (advanceMap.get(lid) ?? 0) + Number(adv.amount));
        }

        for (const l of labours) {
          const lid = String(l.id);

          const bedSum = colSum("bed");
          const paperSum = colSum("paper");

          const bedSal =
            bedSum > 0
              ? (attendanceNum(getVal(l.id, "bed")) / bedSum) *
                Number(contract.bedAmount)
              : 0;

          const paperSal =
            paperSum > 0
              ? (attendanceNum(getVal(l.id, "paper")) / paperSum) *
                Number(contract.paperAmount)
              : 0;

          const labourMesh = contract.meshColumns.reduce(
            (s, _, i) => s + attendanceNum(getVal(l.id, `mesh_${i}`)),
            0,
          );
          const meshSal =
            meshTotal > 0
              ? (labourMesh / meshTotal) * Number(contract.meshAmount)
              : 0;

          const netSalary = bedSal + paperSal + meshSal;

          const lp = labourMap.get(lid);
          if (lp) {
            lp.contractSalaries.set(idStr, netSalary);
            lp.totalGross += netSalary;
            lp.totalAdvances += advanceMap.get(lid) ?? 0;
          }
        }
      }

      for (const lp of labourMap.values()) {
        lp.finalPayment = lp.totalGross - lp.totalAdvances;
      }

      const result = Array.from(labourMap.values()).filter(
        (lp) =>
          (lp.totalGross > 0 || lp.totalAdvances > 0) &&
          selectedLabourIds.has(String(lp.labourId)),
      );
      setPayments(result);
    } finally {
      setLoading(false);
    }
  };

  const selectedContracts = contracts.filter((c) =>
    selectedIds.has(String(c.id)),
  );
  const totalFinal = payments.reduce((s, lp) => s + lp.finalPayment, 0);
  const totalAdvances = payments.reduce((s, lp) => s + lp.totalAdvances, 0);

  const openOverview = () => {
    setOverviewIndex(0);
    setHeldIndex(null);
    setOverviewOpen(true);
  };

  const closeOverview = () => {
    setOverviewOpen(false);
    setHeldIndex(null);
  };

  const currentOverview = payments[overviewIndex];
  const heldOverview = heldIndex !== null ? payments[heldIndex] : null;
  const isCurrentHeld = heldIndex !== null && heldIndex === overviewIndex;
  // Show dual view when there's a held labour that's different from the current
  const isDualView = heldIndex !== null && heldIndex !== overviewIndex;

  const downloadPDF = () => {
    const contractNames = selectedContracts.map((c) => c.name).join(", ");
    const contractTotals = selectedContracts.map((c) => {
      const total = payments.reduce(
        (s, lp) => s + (lp.contractSalaries.get(String(c.id)) ?? 0),
        0,
      );
      return { name: c.name, total };
    });

    const rowsHtml = payments
      .map(
        (lp, i) => `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"}">
        <td style="padding:9px 14px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;white-space:nowrap">${lp.labourName}</td>
        ${selectedContracts
          .map((c) => {
            const sal = lp.contractSalaries.get(String(c.id)) ?? 0;
            return `<td style="padding:9px 14px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right">${sal > 0 ? `&#8377;${sal.toFixed(0)}` : "&mdash;"}</td>`;
          })
          .join("")}
        <td style="padding:9px 14px;color:#dc2626;font-weight:700;border-bottom:1px solid #e2e8f0;text-align:right">&#8377;${lp.totalAdvances.toLocaleString()}</td>
        <td style="padding:9px 14px;color:#ea580c;font-weight:800;font-size:15px;border-bottom:1px solid #e2e8f0;text-align:right">&#8377;${lp.finalPayment.toFixed(0)}</td>
      </tr>`,
      )
      .join("");

    const totalsHtml = `
      <tr style="background:#0f172a">
        <td style="padding:9px 14px;color:#94a3b8;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.06em">Totals</td>
        ${contractTotals.map((ct) => `<td style="padding:9px 14px;color:#f97316;font-weight:800;text-align:right">&#8377;${ct.total.toFixed(0)}</td>`).join("")}
        <td style="padding:9px 14px;color:#fca5a5;font-weight:800;text-align:right">&#8377;${payments.reduce((s, lp) => s + lp.totalAdvances, 0).toLocaleString()}</td>
        <td style="padding:9px 14px;color:#fed7aa;font-weight:800;font-size:15px;text-align:right">&#8377;${totalFinal.toFixed(0)}</td>
      </tr>`;

    const contractHeadersHtml = selectedContracts
      .map(
        (c) =>
          `<th style="padding:11px 14px;background:#1e293b;color:#ffffff;font-weight:700;font-size:12px;text-align:right;white-space:nowrap;letter-spacing:0.04em;text-transform:uppercase">${c.name}</th>`,
      )
      .join("");

    const printDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Sheet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #0f172a; padding: 32px; }
    h1 { font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .subtitle { font-size: 13px; color: #64748b; margin-bottom: 4px; }
    .date { font-size: 12px; color: #94a3b8; margin-bottom: 24px; }
    .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
    .stat { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 16px; min-width: 120px; }
    .stat-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
    .stat-value { font-size: 17px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.08); }
    @media print {
      body { padding: 16px; }
      @page { margin: 16mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <h1>Payment Sheet</h1>
  <div class="subtitle">Contracts: ${contractNames}</div>
  <div class="date">Generated on ${printDate}</div>
  <div class="stats">
    <div class="stat"><div class="stat-label">Labours</div><div class="stat-value" style="color:#f97316">${payments.length}</div></div>
    <div class="stat"><div class="stat-label">Contracts</div><div class="stat-value" style="color:#7c3aed">${selectedContracts.length}</div></div>
    <div class="stat"><div class="stat-label">Total Advances</div><div class="stat-value" style="color:#dc2626">&#8377;${totalAdvances.toLocaleString()}</div></div>
    <div class="stat"><div class="stat-label">Total Payout</div><div class="stat-value" style="color:#16a34a">&#8377;${totalFinal.toFixed(0)}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="padding:11px 14px;background:#1e293b;color:#ffffff;font-weight:700;font-size:12px;text-align:left;white-space:nowrap;letter-spacing:0.04em;text-transform:uppercase">Labour</th>
        ${contractHeadersHtml}
        <th style="padding:11px 14px;background:#1e293b;color:#fca5a5;font-weight:700;font-size:12px;text-align:right;white-space:nowrap;letter-spacing:0.04em;text-transform:uppercase">Advances</th>
        <th style="padding:11px 14px;background:#1e293b;color:#fed7aa;font-weight:700;font-size:12px;text-align:right;white-space:nowrap;letter-spacing:0.04em;text-transform:uppercase">Net Pay</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      ${totalsHtml}
    </tbody>
  </table>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    // Wait for content to load before printing
    printWindow.onload = () => {
      printWindow.print();
    };
    // Fallback if onload doesn't fire (content already loaded)
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const TH_DARK: React.CSSProperties = {
    padding: "11px 14px",
    textAlign: "left",
    fontWeight: 700,
    fontSize: 12,
    color: "#FFFFFF",
    background: "#1E293B",
    whiteSpace: "nowrap",
    borderBottom: "none",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };
  const TD: React.CSSProperties = {
    padding: "9px 14px",
    fontSize: 13,
    color: "#1E293B",
    borderBottom: "1px solid #E2E8F0",
    verticalAlign: "middle",
  };

  const dropTriggerStyle = (open: boolean): React.CSSProperties => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "9px 14px",
    background: "#FFFFFF",
    border: open ? "2px solid #F97316" : "2px solid #E2E8F0",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    color: "#1E293B",
    transition: "border-color 0.15s",
    outline: "none",
    boxShadow: open ? "0 0 0 3px rgba(249,115,22,0.12)" : "none",
  });

  const dropPanelStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "#FFFFFF",
    border: "1.5px solid #E2E8F0",
    borderRadius: 10,
    boxShadow: "0 8px 32px rgba(15,23,42,0.13)",
    zIndex: 50,
    maxHeight: 240,
    overflowY: "auto",
  };

  const labelStyle = (
    isSelected: boolean,
    accent: string,
  ): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 14px",
    cursor: "pointer",
    background: isSelected ? `${accent}0d` : "transparent",
    borderBottom: "1px solid #F1F5F9",
    fontSize: 13,
    color: isSelected ? accent : "#334155",
    fontWeight: isSelected ? 600 : 400,
    transition: "background 0.12s",
    userSelect: "none",
  });

  const checkboxStyle = (
    isSelected: boolean,
    accent: string,
  ): React.CSSProperties => ({
    width: 16,
    height: 16,
    borderRadius: 4,
    border: isSelected ? `2px solid ${accent}` : "2px solid #CBD5E1",
    background: isSelected ? accent : "transparent",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    color: "#fff",
    flexShrink: 0,
    transition: "all 0.12s",
  });

  const chevron = (open: boolean) => (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        transition: "transform 0.15s",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="#94A3B8"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div>
      {/* Section Header */}
      <div
        style={{
          borderLeft: "4px solid #F97316",
          paddingLeft: 12,
          marginBottom: 16,
        }}
      >
        <h2
          style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: 0 }}
        >
          Payments Sheet
        </h2>
        <p style={{ fontSize: 12, color: "#64748B", margin: 0, marginTop: 2 }}>
          Net salary per contract minus advances
        </p>
      </div>

      {/* Contract Selection Dropdown */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#64748B",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Select Contracts
        </div>
        <div ref={contractDropRef} style={{ position: "relative" }}>
          <button
            type="button"
            data-ocid="payments.contract.select"
            onClick={() => setContractDropOpen((v) => !v)}
            style={dropTriggerStyle(contractDropOpen)}
          >
            <span
              style={{ color: selectedIds.size === 0 ? "#94A3B8" : "#1E293B" }}
            >
              {selectedIds.size === 0
                ? "Select contracts..."
                : `${selectedIds.size} contract${selectedIds.size > 1 ? "s" : ""} selected`}
            </span>
            {chevron(contractDropOpen)}
          </button>
          {contractDropOpen && (
            <div style={dropPanelStyle}>
              {contracts.length === 0 ? (
                <div
                  style={{
                    padding: "12px 14px",
                    fontSize: 13,
                    color: "#94A3B8",
                  }}
                >
                  No contracts available
                </div>
              ) : (
                contracts.map((c, i) => {
                  const isSelected = selectedIds.has(String(c.id));
                  return (
                    <label
                      key={String(c.id)}
                      style={labelStyle(isSelected, "#F97316")}
                    >
                      <input
                        data-ocid={`payments.contract.checkbox.${i + 1}`}
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleContract(String(c.id))}
                        style={{ display: "none" }}
                      />
                      <span style={checkboxStyle(isSelected, "#F97316")}>
                        {isSelected ? "✓" : ""}
                      </span>
                      {c.name}
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Labour Filter Dropdown */}
      {labours.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748B",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Filter Labours
          </div>
          <div ref={labourDropRef} style={{ position: "relative" }}>
            <button
              type="button"
              data-ocid="payments.labour.select"
              onClick={() => setLabourDropOpen((v) => !v)}
              style={dropTriggerStyle(labourDropOpen)}
            >
              <span
                style={{
                  color: selectedLabourIds.size === 0 ? "#94A3B8" : "#1E293B",
                }}
              >
                {selectedLabourIds.size === 0
                  ? "No labours selected"
                  : `${filteredLabours.length} of ${labours.length} labours selected`}
              </span>
              {chevron(labourDropOpen)}
            </button>
            {labourDropOpen && (
              <div style={dropPanelStyle}>
                {/* Select All / Deselect All header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 14px",
                    borderBottom: "1.5px solid #E2E8F0",
                    background: "#F8FAFC",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#94A3B8",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {labours.length} Labours
                  </span>
                  <button
                    type="button"
                    data-ocid="payments.labour.filter.toggle"
                    onClick={toggleAllLabours}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: allLaboursSelected ? "#64748B" : "#3B82F6",
                      background: "transparent",
                      border: "1px solid #E2E8F0",
                      borderRadius: 6,
                      padding: "3px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {allLaboursSelected ? "Deselect All" : "Select All"}
                  </button>
                </div>
                {labours.map((l, i) => {
                  const isSelected = selectedLabourIds.has(String(l.id));
                  return (
                    <label
                      key={String(l.id)}
                      style={labelStyle(isSelected, "#3B82F6")}
                    >
                      <input
                        data-ocid={`payments.labour.checkbox.${i + 1}`}
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleLabour(String(l.id))}
                        style={{ display: "none" }}
                      />
                      <span style={checkboxStyle(isSelected, "#3B82F6")}>
                        {isSelected ? "✓" : ""}
                      </span>
                      {l.name}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calculate Button */}
      <button
        type="button"
        data-ocid="payments.calculate.button"
        onClick={calculate}
        disabled={
          selectedIds.size === 0 || loading || selectedLabourIds.size === 0
        }
        style={{
          marginBottom: 16,
          width: "100%",
          maxWidth: 340,
          display: "block",
          background:
            selectedIds.size === 0 || loading || selectedLabourIds.size === 0
              ? "#CBD5E1"
              : "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
          color: "#fff",
          border: "none",
          borderRadius: 999,
          padding: "12px 0",
          fontSize: 15,
          fontWeight: 800,
          cursor:
            selectedIds.size === 0 || loading || selectedLabourIds.size === 0
              ? "not-allowed"
              : "pointer",
          boxShadow:
            selectedIds.size === 0 || loading || selectedLabourIds.size === 0
              ? "none"
              : "0 4px 20px rgba(249,115,22,0.40)",
          letterSpacing: "0.03em",
          transition: "all 0.2s",
        }}
      >
        {loading ? "Calculating…" : "Calculate Payments"}
      </button>

      {/* Stats Bar + Download PDF + Overview */}
      {payments.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {/* Stats */}
            <div
              style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: 1 }}
            >
              {[
                { label: "Labours", value: payments.length, color: "#F97316" },
                {
                  label: "Contracts",
                  value: selectedContracts.length,
                  color: "#7C3AED",
                },
                {
                  label: "Total Advances",
                  value: `₹${totalAdvances.toLocaleString()}`,
                  color: "#DC2626",
                },
                {
                  label: "Total Payout",
                  value: `₹${totalFinal.toFixed(0)}`,
                  color: "#16A34A",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "8px 14px",
                    minWidth: 110,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#94A3B8",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: stat.color,
                      marginTop: 2,
                    }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div
              style={{
                display: "flex",
                gap: 8,
                alignSelf: "center",
                flexWrap: "wrap",
              }}
            >
              {/* Overview Button */}
              <button
                type="button"
                data-ocid="payments.overview.open_modal_button"
                onClick={openOverview}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  background: "#FFFFFF",
                  border: "1.5px solid #F97316",
                  borderRadius: 10,
                  color: "#F97316",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  transition: "background 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#FFF7ED";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 2px 8px rgba(249,115,22,0.18)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#FFFFFF";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 1px 3px rgba(0,0,0,0.06)";
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="#F97316"
                    strokeWidth="2.2"
                  />
                  <path
                    d="M12 8v4l3 3"
                    stroke="#F97316"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Overview
              </button>

              {/* Download PDF Button */}
              <button
                type="button"
                data-ocid="payments.pdf.button"
                onClick={downloadPDF}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  background: "#FFFFFF",
                  border: "1.5px solid #F97316",
                  borderRadius: 10,
                  color: "#F97316",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  transition: "background 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#FFF7ED";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 2px 8px rgba(249,115,22,0.18)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#FFFFFF";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 1px 3px rgba(0,0,0,0.06)";
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                    stroke="#F97316"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Download PDF
              </button>
            </div>
          </div>

          {/* Payments Table */}
          <div
            style={{
              overflowX: "auto",
              borderRadius: 14,
              boxShadow: "0 4px 24px rgba(15,23,42,0.10)",
              border: "1px solid #E2E8F0",
            }}
          >
            <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...TH_DARK,
                      position: "sticky",
                      left: 0,
                      zIndex: 3,
                      minWidth: 130,
                      borderRadius: "14px 0 0 0",
                    }}
                  >
                    Labour
                  </th>
                  {selectedContracts.map((c) => (
                    <th key={String(c.id)} style={TH_DARK}>
                      {c.name}
                    </th>
                  ))}
                  <th style={{ ...TH_DARK, color: "#FCA5A5" }}>Advances</th>
                  <th
                    style={{
                      ...TH_DARK,
                      color: "#FED7AA",
                      borderRadius: "0 14px 0 0",
                    }}
                  >
                    Net Pay
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((lp, i) => (
                  <tr
                    key={String(lp.labourId)}
                    data-ocid={`payments.item.${i + 1}`}
                    style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}
                  >
                    <td
                      style={{
                        ...TD,
                        position: "sticky",
                        left: 0,
                        background: "#EFF6FF",
                        zIndex: 1,
                        fontWeight: 700,
                        color: "#0F172A",
                      }}
                    >
                      {lp.labourName}
                    </td>
                    {selectedContracts.map((c) => {
                      const sal = lp.contractSalaries.get(String(c.id)) ?? 0;
                      return (
                        <td
                          key={String(c.id)}
                          style={{ ...TD, color: "#334155" }}
                        >
                          {sal > 0 ? `₹${sal.toFixed(0)}` : "—"}
                        </td>
                      );
                    })}
                    <td style={{ ...TD, color: "#DC2626", fontWeight: 700 }}>
                      ₹{lp.totalAdvances.toLocaleString()}
                    </td>
                    <td
                      style={{
                        ...TD,
                        color: "#F97316",
                        fontWeight: 800,
                        fontSize: 15,
                      }}
                    >
                      ₹{lp.finalPayment.toFixed(0)}
                    </td>
                  </tr>
                ))}

                {/* Totals Row */}
                <tr style={{ background: "#0F172A", fontWeight: 700 }}>
                  <td
                    style={{
                      ...TD,
                      position: "sticky",
                      left: 0,
                      background: "#0F172A",
                      zIndex: 1,
                      color: "#94A3B8",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "none",
                    }}
                  >
                    Totals
                  </td>
                  {selectedContracts.map((c) => (
                    <td
                      key={String(c.id)}
                      style={{
                        ...TD,
                        color: "#F97316",
                        fontWeight: 800,
                        borderBottom: "none",
                      }}
                    >
                      ₹
                      {payments
                        .reduce(
                          (s, lp) =>
                            s + (lp.contractSalaries.get(String(c.id)) ?? 0),
                          0,
                        )
                        .toFixed(0)}
                    </td>
                  ))}
                  <td
                    style={{
                      ...TD,
                      color: "#FCA5A5",
                      fontWeight: 800,
                      borderBottom: "none",
                    }}
                  >
                    ₹
                    {payments
                      .reduce((s, lp) => s + lp.totalAdvances, 0)
                      .toLocaleString()}
                  </td>
                  <td
                    style={{
                      ...TD,
                      color: "#FED7AA",
                      fontWeight: 800,
                      fontSize: 15,
                      borderBottom: "none",
                    }}
                  >
                    ₹{totalFinal.toFixed(0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Labour Overview Dialog */}
      {overviewOpen && currentOverview && (
        <div
          data-ocid="payments.overview.modal"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            background: "rgba(15, 23, 42, 0.72)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeOverview();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeOverview();
          }}
          role="presentation"
          tabIndex={-1}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              width: "100%",
              maxWidth: 400,
              boxShadow: "0 24px 80px rgba(15,23,42,0.28)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Dialog Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#94A3B8",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 2,
                    }}
                  >
                    Labour Overview
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>
                    {overviewIndex + 1} of {payments.length}
                    {isDualView && " · Adding"}
                  </div>
                </div>

                {/* Hold / Release button */}
                {heldIndex === null ? (
                  <button
                    type="button"
                    data-ocid="payments.overview.toggle"
                    onClick={() => setHeldIndex(overviewIndex)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "6px 12px",
                      background: "rgba(59,130,246,0.15)",
                      border: "1.5px solid rgba(147,197,253,0.5)",
                      borderRadius: 8,
                      color: "#93C5FD",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      letterSpacing: "0.03em",
                      transition: "background 0.15s",
                      flexShrink: 0,
                    }}
                    title="Hold this labour to compare with another"
                  >
                    📌 Hold
                  </button>
                ) : (
                  <button
                    type="button"
                    data-ocid="payments.overview.toggle"
                    onClick={() => setHeldIndex(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "6px 12px",
                      background: "rgba(239,68,68,0.15)",
                      border: "1.5px solid rgba(252,165,165,0.5)",
                      borderRadius: 8,
                      color: "#FCA5A5",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      letterSpacing: "0.03em",
                      transition: "background 0.15s",
                      flexShrink: 0,
                    }}
                    title="Release held labour"
                  >
                    ✕ Release
                  </button>
                )}
              </div>

              <button
                type="button"
                data-ocid="payments.overview.close_button"
                onClick={closeOverview}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)",
                  border: "1.5px solid rgba(255,255,255,0.15)",
                  color: "#94A3B8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  transition: "background 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(255,255,255,0.16)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "rgba(255,255,255,0.08)";
                }}
                aria-label="Close overview"
              >
                ×
              </button>
            </div>

            {/* Held status banner */}
            {isCurrentHeld && heldIndex !== null && (
              <div
                style={{
                  background: "#EFF6FF",
                  borderBottom: "1.5px solid #BFDBFE",
                  padding: "8px 20px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#1D4ED8",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                📌 This labour is held — navigate with Prev/Next to add
              </div>
            )}

            {/* Content area */}
            {isDualView && heldOverview ? (
              // COMBINED VIEW: sum amounts of held + current
              <>
                {/* Labour names */}
                <div style={{ padding: "16px 24px 0 24px" }}>
                  <div
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 12,
                      padding: "12px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#3B82F6",
                          background: "rgba(59,130,246,0.1)",
                          borderRadius: 4,
                          padding: "2px 6px",
                        }}
                      >
                        📌
                      </span>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#1E293B",
                        }}
                      >
                        {heldOverview.labourName}
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#EA580C",
                          background: "rgba(234,88,12,0.1)",
                          borderRadius: 4,
                          padding: "2px 6px",
                        }}
                      >
                        +
                      </span>
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#1E293B",
                        }}
                      >
                        {currentOverview.labourName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div
                  style={{
                    height: 1,
                    background: "#F1F5F9",
                    margin: "16px 24px 0 24px",
                  }}
                />

                {/* Combined Advances */}
                <div
                  style={{
                    padding: "12px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Total Advances
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: "#DC2626",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    ₹
                    {(
                      heldOverview.totalAdvances + currentOverview.totalAdvances
                    ).toLocaleString()}
                  </div>
                </div>

                {/* Combined Net Pay hero */}
                <div
                  style={{
                    margin: "0 16px 24px 16px",
                    background:
                      "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
                    border: "2px solid #FED7AA",
                    borderRadius: 16,
                    padding: "20px 24px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#C2410C",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 8,
                    }}
                  >
                    Combined Net Pay
                  </div>
                  <div
                    style={{
                      fontSize: 48,
                      fontWeight: 900,
                      color: "#EA580C",
                      lineHeight: 1,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    ₹
                    {(
                      heldOverview.finalPayment + currentOverview.finalPayment
                    ).toFixed(0)}
                  </div>
                </div>
              </>
            ) : (
              // SINGLE VIEW: original layout
              <>
                {/* Labour Name */}
                <div
                  style={{
                    padding: "28px 24px 8px 24px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 900,
                      color: "#0F172A",
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                      wordBreak: "break-word",
                    }}
                  >
                    {currentOverview.labourName}
                  </div>
                </div>

                {/* Divider */}
                <div
                  style={{
                    height: 1,
                    background: "#F1F5F9",
                    margin: "16px 24px",
                  }}
                />

                {/* Advances Row */}
                <div
                  style={{
                    padding: "0 24px 16px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#64748B",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Advances
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: "#DC2626",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    ₹{currentOverview.totalAdvances.toLocaleString()}
                  </div>
                </div>

                {/* Net Pay — Hero */}
                <div
                  style={{
                    margin: "0 16px 24px 16px",
                    background:
                      "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
                    border: "2px solid #FED7AA",
                    borderRadius: 16,
                    padding: "20px 24px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#C2410C",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 8,
                    }}
                  >
                    Net Pay
                  </div>
                  <div
                    style={{
                      fontSize: 48,
                      fontWeight: 900,
                      color: "#EA580C",
                      lineHeight: 1,
                      letterSpacing: "-0.03em",
                    }}
                  >
                    ₹{currentOverview.finalPayment.toFixed(0)}
                  </div>
                </div>
              </>
            )}

            {/* Navigation */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: isDualView ? "0 16px 16px" : "0 16px 20px",
                gap: 12,
              }}
            >
              <button
                type="button"
                data-ocid="payments.overview.pagination_prev"
                onClick={() => setOverviewIndex((v) => Math.max(0, v - 1))}
                disabled={overviewIndex === 0}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "14px 0",
                  background: overviewIndex === 0 ? "#F8FAFC" : "#FFFFFF",
                  border:
                    overviewIndex === 0
                      ? "1.5px solid #E2E8F0"
                      : "1.5px solid #F97316",
                  borderRadius: 12,
                  color: overviewIndex === 0 ? "#CBD5E1" : "#F97316",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: overviewIndex === 0 ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                ← Prev
              </button>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#64748B",
                  whiteSpace: "nowrap",
                  minWidth: 56,
                  textAlign: "center",
                }}
              >
                {overviewIndex + 1} / {payments.length}
              </div>

              <button
                type="button"
                data-ocid="payments.overview.pagination_next"
                onClick={() =>
                  setOverviewIndex((v) => Math.min(payments.length - 1, v + 1))
                }
                disabled={overviewIndex === payments.length - 1}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "14px 0",
                  background:
                    overviewIndex === payments.length - 1
                      ? "#F8FAFC"
                      : "#FFFFFF",
                  border:
                    overviewIndex === payments.length - 1
                      ? "1.5px solid #E2E8F0"
                      : "1.5px solid #F97316",
                  borderRadius: 12,
                  color:
                    overviewIndex === payments.length - 1
                      ? "#CBD5E1"
                      : "#F97316",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor:
                    overviewIndex === payments.length - 1
                      ? "not-allowed"
                      : "pointer",
                  transition: "all 0.15s",
                }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getColKey(a: Attendance): string {
  const ct = a.columnType;
  if (ct.__kind__ === "bed") return "bed";
  if (ct.__kind__ === "paper") return "paper";
  if (ct.__kind__ === "mesh") return `mesh_${Number(ct.mesh)}`;
  return "bed";
}
