import { useEffect, useRef, useState } from "react";
import type {
  Advance,
  Attendance,
  Contract,
  Group,
  Labour,
} from "../backend.d";
import { useActor } from "../hooks/useActor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyActor = any;

const ACCENT = "#6366f1";
const ACCENT2 = "#8b5cf6";
const GRAD = `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`;
const TEXT_PRIMARY = "#1e1b4b";
const TEXT_SECONDARY = "#6b7280";
const CARD_BG = "rgba(255,255,255,0.95)";
const PAGE_BG = "#f1f3f8";

function attendanceNum(v: string): number {
  if (v === "Present" || v === "present") return 1;
  if (v === "Absent" || v === "absent") return 0;
  return Number.parseFloat(v) || 0;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

interface LabourPayment {
  labourId: bigint;
  labourName: string;
  contractSalaries: Map<string, number>;
  totalGross: number;
  totalAdvances: number;
  finalPayment: number;
  advances: Advance[];
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<bigint | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payments, setPayments] = useState<LabourPayment[]>([]);
  const [loading, setLoading] = useState(false);

  const [contractDropOpen, setContractDropOpen] = useState(false);
  const contractDropRef = useRef<HTMLDivElement>(null);

  // Overview dialog state
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [selectedOverviewIndices, setSelectedOverviewIndices] = useState<
    Set<number>
  >(new Set());
  const [overviewMode, setOverviewMode] = useState<
    "one-by-one" | "multi-select"
  >("one-by-one");
  const [currentOverviewIndex, setCurrentOverviewIndex] = useState(0);
  const [includeAdvances, setIncludeAdvances] = useState(true);
  const [expandedBreakdown, setExpandedBreakdown] = useState<Set<number>>(
    new Set(),
  );

  useClickOutside(contractDropRef, () => setContractDropOpen(false));

  // biome-ignore lint/correctness/useExhaustiveDependencies: a is derived from actor
  useEffect(() => {
    if (!a) return;
    a.getAllContracts().then((cs: Contract[]) =>
      setContracts(cs.filter((c: Contract) => !c.isSettled)),
    );
    a.getAllLabours().then((ls: Labour[]) => {
      setLabours(ls);
    });
    a.getAllGroups().then((gs: Group[]) =>
      setGroups(
        [...gs].sort((x: Group, y: Group) => x.name.localeCompare(y.name)),
      ),
    );
  }, [actor]);

  // Auto-calculate when group filter changes if contracts are selected
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    if (selectedIds.size > 0) {
      calculate();
    }
  }, [selectedGroupId]);

  const toggleContract = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const calculate = async () => {
    if (!a) return;
    setLoading(true);
    try {
      const labourMap = new Map<string, LabourPayment>();

      const filteredLabours =
        selectedGroupId !== null
          ? labours.filter(
              (l) => l.groupId !== undefined && l.groupId === selectedGroupId,
            )
          : labours;

      for (const l of filteredLabours) {
        labourMap.set(String(l.id), {
          labourId: l.id,
          labourName: l.name,
          contractSalaries: new Map(),
          totalGross: 0,
          totalAdvances: 0,
          finalPayment: 0,
          advances: [],
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

        const advanceMap = new Map<
          string,
          { total: number; advances: Advance[] }
        >();
        for (const adv of advancesList as Advance[]) {
          const lid = String(adv.labourId);
          if (!advanceMap.has(lid))
            advanceMap.set(lid, { total: 0, advances: [] });
          const entry = advanceMap.get(lid)!;
          entry.total += Number(adv.amount);
          entry.advances.push(adv);
        }

        for (const l of filteredLabours) {
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
            const advEntry = advanceMap.get(lid);
            if (advEntry) {
              lp.totalAdvances += advEntry.total;
              lp.advances.push(...advEntry.advances);
            }
          }
        }
      }

      for (const lp of labourMap.values()) {
        lp.finalPayment = lp.totalGross - lp.totalAdvances;
      }

      const result = Array.from(labourMap.values()).filter(
        (lp) => lp.totalGross > 0 || lp.totalAdvances > 0,
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
    setSelectedOverviewIndices(new Set(payments.map((_, i) => i)));
    setOverviewMode("one-by-one");
    setCurrentOverviewIndex(0);
    setIncludeAdvances(true);
    setExpandedBreakdown(new Set());
    setOverviewOpen(true);
  };

  const closeOverview = () => {
    setOverviewOpen(false);
    setSelectedOverviewIndices(new Set());
  };

  const selectedPayments = payments.filter((_, i) =>
    selectedOverviewIndices.has(i),
  );
  const combinedAdvances = selectedPayments.reduce(
    (s, p) => s + p.totalAdvances,
    0,
  );
  const combinedGross = selectedPayments.reduce((s, p) => s + p.totalGross, 0);
  const combinedNetPay = includeAdvances
    ? combinedGross - combinedAdvances
    : combinedGross;

  const currentLabour = payments[currentOverviewIndex] ?? null;
  const currentNetPay = currentLabour
    ? includeAdvances
      ? currentLabour.finalPayment
      : currentLabour.totalGross
    : 0;

  const toggleBreakdown = (idx: number) => {
    setExpandedBreakdown((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

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
        <td style="padding:9px 14px;color:#4f46e5;font-weight:800;font-size:15px;border-bottom:1px solid #e2e8f0;text-align:right">&#8377;${lp.finalPayment.toFixed(0)}</td>
      </tr>`,
      )
      .join("");

    const totalsHtml = `
      <tr style="background:#1e1b4b">
        <td style="padding:9px 14px;color:#a5b4fc;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.06em">Totals</td>
        ${contractTotals.map((ct) => `<td style="padding:9px 14px;color:#c4b5fd;font-weight:800;text-align:right">&#8377;${ct.total.toFixed(0)}</td>`).join("")}
        <td style="padding:9px 14px;color:#fca5a5;font-weight:800;text-align:right">&#8377;${payments.reduce((s, lp) => s + lp.totalAdvances, 0).toLocaleString()}</td>
        <td style="padding:9px 14px;color:#c4b5fd;font-weight:800;font-size:15px;text-align:right">&#8377;${totalFinal.toFixed(0)}</td>
      </tr>`;

    const contractHeadersHtml = selectedContracts
      .map(
        (c) =>
          `<th style="padding:11px 14px;background:#1e1b4b;color:#ffffff;font-weight:700;font-size:12px;text-align:right;white-space:nowrap;letter-spacing:0.04em;text-transform:uppercase">${c.name}</th>`,
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
    h1 { font-size: 26px; font-weight: 800; color: #1e1b4b; margin-bottom: 4px; }
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
    <div class="stat"><div class="stat-label">Labours</div><div class="stat-value" style="color:#6366f1">${payments.length}</div></div>
    <div class="stat"><div class="stat-label">Contracts</div><div class="stat-value" style="color:#7c3aed">${selectedContracts.length}</div></div>
    <div class="stat"><div class="stat-label">Total Advances</div><div class="stat-value" style="color:#dc2626">&#8377;${totalAdvances.toLocaleString()}</div></div>
    <div class="stat"><div class="stat-label">Total Payout</div><div class="stat-value" style="color:#16a34a">&#8377;${totalFinal.toFixed(0)}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="padding:11px 14px;background:#1e1b4b;color:#ffffff;font-weight:700;font-size:12px;text-align:left;white-space:nowrap;letter-spacing:0.04em;text-transform:uppercase">Labour</th>
        ${contractHeadersHtml}
        <th style="padding:11px 14px;background:#1e1b4b;color:#fca5a5;font-weight:700;font-size:12px;text-align:right;white-space:nowrap;letter-spacing:0.04em;text-transform:uppercase">Advances</th>
        <th style="padding:11px 14px;background:#1e1b4b;color:#a5b4fc;font-weight:700;font-size:12px;text-align:right;white-space:nowrap;letter-spacing:0.04em;text-transform:uppercase">Net Pay</th>
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
    printWindow.onload = () => {
      printWindow.print();
    };
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const TH_DARK: React.CSSProperties = {
    padding: "11px 14px",
    textAlign: "left",
    fontWeight: 700,
    fontSize: 12,
    color: "#ffffff",
    background: "#1e1b4b",
    whiteSpace: "nowrap",
    borderBottom: "none",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };
  const TD: React.CSSProperties = {
    padding: "9px 14px",
    fontSize: 13,
    color: TEXT_PRIMARY,
    borderBottom: "1px solid rgba(99,102,241,0.08)",
    background: "#ffffff",
    verticalAlign: "middle",
  };

  const dropTriggerStyle = (open: boolean): React.CSSProperties => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "9px 14px",
    background: "#ffffff",
    border: open ? `2px solid ${ACCENT}` : "1.5px solid rgba(99,102,241,0.2)",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    color: TEXT_PRIMARY,
    transition: "border-color 0.15s",
    outline: "none",
    boxShadow: open ? "0 0 0 3px rgba(99,102,241,0.15)" : "none",
  });

  const dropPanelStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "#ffffff",
    border: "1.5px solid rgba(99,102,241,0.2)",
    borderRadius: 10,
    boxShadow: "0 8px 32px rgba(30,27,75,0.12)",
    zIndex: 50,
    maxHeight: 240,
    overflowY: "auto",
  };

  const dropItemStyle = (isSelected: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 14px",
    cursor: "pointer",
    background: isSelected ? "rgba(99,102,241,0.08)" : "transparent",
    borderBottom: "1px solid rgba(99,102,241,0.08)",
    fontSize: 13,
    color: isSelected ? ACCENT : TEXT_PRIMARY,
    fontWeight: isSelected ? 600 : 400,
    transition: "background 0.12s",
    userSelect: "none",
  });

  const checkboxStyle = (isSelected: boolean): React.CSSProperties => ({
    width: 16,
    height: 16,
    borderRadius: 4,
    border: isSelected
      ? `2px solid ${ACCENT}`
      : "2px solid rgba(99,102,241,0.2)",
    background: isSelected ? ACCENT : "transparent",
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
        stroke="#6b7280"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div style={{ background: PAGE_BG, minHeight: "100%" }}>
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderLeft: `4px solid ${ACCENT}`,
          paddingLeft: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: TEXT_PRIMARY,
              margin: 0,
            }}
          >
            Payments Sheet
          </h2>
          <p
            style={{
              fontSize: 12,
              color: TEXT_SECONDARY,
              margin: 0,
              marginTop: 2,
            }}
          >
            Net salary per contract minus advances
          </p>
        </div>
        <button
          type="button"
          data-ocid="payments.calculate.button"
          onClick={calculate}
          disabled={selectedIds.size === 0 || loading}
          style={{
            background: selectedIds.size === 0 || loading ? "#CBD5E1" : GRAD,
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 800,
            cursor:
              selectedIds.size === 0 || loading ? "not-allowed" : "pointer",
            boxShadow:
              selectedIds.size === 0 || loading
                ? "none"
                : "0 4px 16px rgba(99,102,241,0.35)",
            letterSpacing: "0.03em",
            transition: "all 0.2s",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {loading ? "Calculating…" : "Calculate"}
        </button>
      </div>

      {/* Contract Selection Dropdown */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: TEXT_SECONDARY,
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
              style={{
                color: selectedIds.size === 0 ? TEXT_SECONDARY : TEXT_PRIMARY,
              }}
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
                    color: TEXT_SECONDARY,
                  }}
                >
                  No contracts available
                </div>
              ) : (
                contracts.map((c, i) => {
                  const isSelected = selectedIds.has(String(c.id));
                  return (
                    <label key={String(c.id)} style={dropItemStyle(isSelected)}>
                      <input
                        data-ocid={`payments.contract.checkbox.${i + 1}`}
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleContract(String(c.id))}
                        style={{ display: "none" }}
                      />
                      <span style={checkboxStyle(isSelected)}>
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

      {/* Group Filter — Inline Chips */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: TEXT_SECONDARY,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Filter by Group
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            data-ocid="payments.group.all.toggle"
            onClick={() => setSelectedGroupId(null)}
            style={{
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border:
                selectedGroupId === null
                  ? `1.5px solid ${ACCENT}`
                  : "1.5px solid rgba(99,102,241,0.2)",
              background:
                selectedGroupId === null
                  ? "rgba(99,102,241,0.12)"
                  : "rgba(255,255,255,0.7)",
              color: selectedGroupId === null ? ACCENT : TEXT_SECONDARY,
              display: "flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.15s",
            }}
          >
            {selectedGroupId === null && (
              <span style={{ fontSize: 11 }}>✓</span>
            )}
            All Labours
          </button>
          {groups.map((g) => {
            const isSelected = selectedGroupId === g.id;
            return (
              <button
                type="button"
                key={String(g.id)}
                data-ocid="payments.group.toggle"
                onClick={() => setSelectedGroupId(g.id)}
                style={{
                  borderRadius: 999,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: isSelected
                    ? `1.5px solid ${ACCENT}`
                    : "1.5px solid rgba(99,102,241,0.2)",
                  background: isSelected
                    ? "rgba(99,102,241,0.12)"
                    : "rgba(255,255,255,0.7)",
                  color: isSelected ? ACCENT : TEXT_SECONDARY,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s",
                }}
              >
                {isSelected && <span style={{ fontSize: 11 }}>✓</span>}
                {g.name}
              </button>
            );
          })}
          {groups.length === 0 && (
            <span
              style={{
                fontSize: 12,
                color: TEXT_SECONDARY,
                fontStyle: "italic",
              }}
            >
              No groups yet
            </span>
          )}
        </div>
      </div>

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
                { label: "Labours", value: payments.length, color: ACCENT },
                {
                  label: "Contracts",
                  value: selectedContracts.length,
                  color: ACCENT2,
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
                    background: CARD_BG,
                    border: "1px solid rgba(99,102,241,0.12)",
                    borderRadius: 10,
                    padding: "8px 14px",
                    minWidth: 110,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: TEXT_SECONDARY,
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
                  background: CARD_BG,
                  border: `1.5px solid ${ACCENT}`,
                  borderRadius: 10,
                  color: ACCENT,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  transition: "background 0.15s, box-shadow 0.15s",
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
                    stroke={ACCENT}
                    strokeWidth="2.2"
                  />
                  <path
                    d="M12 8v4l3 3"
                    stroke={ACCENT}
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
                  background: CARD_BG,
                  border: `1.5px solid ${ACCENT}`,
                  borderRadius: 10,
                  color: ACCENT,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  transition: "background 0.15s, box-shadow 0.15s",
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
                    stroke={ACCENT}
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
              border: "1px solid rgba(99,102,241,0.15)",
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
                  <th style={{ ...TH_DARK, color: "#fca5a5" }}>Advances</th>
                  <th
                    style={{
                      ...TH_DARK,
                      color: "#a5b4fc",
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
                    style={{ background: i % 2 === 0 ? "#ffffff" : "#f8f9ff" }}
                  >
                    <td
                      style={{
                        ...TD,
                        position: "sticky",
                        left: 0,
                        background: i % 2 === 0 ? "#ffffff" : "#f8f9ff",
                        zIndex: 1,
                        fontWeight: 700,
                        color: TEXT_PRIMARY,
                      }}
                    >
                      {lp.labourName}
                    </td>
                    {selectedContracts.map((c) => {
                      const sal = lp.contractSalaries.get(String(c.id)) ?? 0;
                      return (
                        <td
                          key={String(c.id)}
                          style={{ ...TD, color: TEXT_SECONDARY }}
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
                        color: ACCENT,
                        fontWeight: 800,
                        fontSize: 15,
                      }}
                    >
                      ₹{lp.finalPayment.toFixed(0)}
                    </td>
                  </tr>
                ))}

                {/* Totals Row */}
                <tr
                  style={{
                    background: "rgba(99,102,241,0.06)",
                    fontWeight: 700,
                  }}
                >
                  <td
                    style={{
                      ...TD,
                      position: "sticky",
                      left: 0,
                      background: "rgba(243,244,255,0.98)",
                      zIndex: 1,
                      color: TEXT_SECONDARY,
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
                        color: ACCENT,
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
                      color: "#dc2626",
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
                      color: ACCENT,
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
      {overviewOpen && (
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
              background: "#ffffff",
              borderRadius: 20,
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 24px 80px rgba(15,23,42,0.28)",
              overflow: "hidden",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              maxHeight: "92vh",
            }}
          >
            {/* Dialog Header */}
            <div
              style={{
                background: GRAD,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#ffffff",
                    marginBottom: 2,
                  }}
                >
                  Labour Overview
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
                  {overviewMode === "one-by-one"
                    ? `${currentOverviewIndex + 1} / ${payments.length}`
                    : `${selectedOverviewIndices.size} of ${payments.length} selected`}
                </div>
              </div>

              <button
                type="button"
                data-ocid="payments.overview.close_button"
                onClick={closeOverview}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  border: "1.5px solid rgba(255,255,255,0.35)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                aria-label="Close overview"
              >
                ×
              </button>
            </div>

            {/* Include Advances Toggle */}
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid rgba(99,102,241,0.1)",
                background: "#f8f9ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <span
                style={{ fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}
              >
                Include advances in net pay
              </span>
              <button
                type="button"
                data-ocid="payments.overview.include_advances.toggle"
                onClick={() => setIncludeAdvances((v) => !v)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 999,
                  background: includeAdvances ? ACCENT : "#cbd5e1",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
                aria-label="Toggle include advances"
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: includeAdvances ? 22 : 2,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    transition: "left 0.2s",
                  }}
                />
              </button>
            </div>

            {/* Mode Toggle */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid rgba(99,102,241,0.1)",
                display: "flex",
                gap: 8,
                flexShrink: 0,
                background: "#f1f3f8",
              }}
            >
              <button
                type="button"
                data-ocid="payments.overview.one_by_one.tab"
                onClick={() => setOverviewMode("one-by-one")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: overviewMode === "one-by-one" ? GRAD : "#FFFFFF",
                  color:
                    overviewMode === "one-by-one" ? "#FFFFFF" : TEXT_SECONDARY,
                  boxShadow:
                    overviewMode === "one-by-one"
                      ? "0 2px 10px rgba(99,102,241,0.3)"
                      : "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                One by One
              </button>
              <button
                type="button"
                data-ocid="payments.overview.multi_select.tab"
                onClick={() => setOverviewMode("multi-select")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background:
                    overviewMode === "multi-select" ? GRAD : "#FFFFFF",
                  color:
                    overviewMode === "multi-select"
                      ? "#FFFFFF"
                      : TEXT_SECONDARY,
                  boxShadow:
                    overviewMode === "multi-select"
                      ? "0 2px 10px rgba(99,102,241,0.3)"
                      : "0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                Multi Select
              </button>
            </div>

            {/* ── ONE BY ONE MODE ── */}
            {overviewMode === "one-by-one" && currentLabour && (
              <>
                {/* Labour detail card */}
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "20px 20px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    background: "#ffffff",
                  }}
                >
                  {/* Index badge */}
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: TEXT_SECONDARY,
                      background: "rgba(99,102,241,0.08)",
                      borderRadius: 999,
                      padding: "3px 12px",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {currentOverviewIndex + 1} / {payments.length}
                  </div>

                  {/* Labour name */}
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 900,
                      color: TEXT_PRIMARY,
                      textAlign: "center",
                      lineHeight: 1.2,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {currentLabour.labourName}
                  </div>

                  {/* Gross Salary */}
                  <div
                    style={{
                      width: "100%",
                      background: "rgba(99,102,241,0.06)",
                      border: "1.5px solid rgba(99,102,241,0.15)",
                      borderRadius: 14,
                      padding: "12px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}
                    >
                      Gross Salary
                    </span>
                    <span
                      style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}
                    >
                      ₹{currentLabour.totalGross.toFixed(0)}
                    </span>
                  </div>

                  {/* Advances with Breakdown */}
                  <div style={{ width: "100%" }}>
                    <div
                      style={{
                        background: "rgba(220,38,38,0.08)",
                        border: "1.5px solid rgba(220,38,38,0.2)",
                        borderRadius: 14,
                        padding: "12px 18px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom:
                            currentLabour.advances.length > 0 ? 8 : 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#dc2626",
                          }}
                        >
                          Total Advances
                        </span>
                        <span
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color: "#DC2626",
                          }}
                        >
                          ₹{currentLabour.totalAdvances.toLocaleString()}
                        </span>
                      </div>

                      {/* Advance Breakdown Toggle */}
                      {currentLabour.advances.length > 0 && (
                        <>
                          <button
                            type="button"
                            data-ocid="payments.overview.advance_breakdown.toggle"
                            onClick={() =>
                              toggleBreakdown(currentOverviewIndex)
                            }
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#dc2626",
                              background: "rgba(220,38,38,0.1)",
                              border: "none",
                              borderRadius: 6,
                              padding: "3px 10px",
                              cursor: "pointer",
                              letterSpacing: "0.03em",
                            }}
                          >
                            {expandedBreakdown.has(currentOverviewIndex)
                              ? "▲ Hide Breakdown"
                              : "▼ Show Breakdown"}
                          </button>

                          {expandedBreakdown.has(currentOverviewIndex) && (
                            <div
                              style={{
                                marginTop: 8,
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              {currentLabour.advances.map((adv, ai) => (
                                <div
                                  key={String(adv.id)}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    padding: "6px 8px",
                                    background: "rgba(255,255,255,0.7)",
                                    borderRadius: 8,
                                    fontSize: 12,
                                    gap: 8,
                                  }}
                                >
                                  <div style={{ flex: 1 }}>
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        color: TEXT_PRIMARY,
                                      }}
                                    >
                                      {adv.note || `Advance ${ai + 1}`}
                                    </div>
                                    {adv.timestamp && (
                                      <div
                                        style={{
                                          color: TEXT_SECONDARY,
                                          fontSize: 10,
                                          marginTop: 2,
                                        }}
                                      >
                                        {formatDateTime(adv.timestamp)}
                                      </div>
                                    )}
                                  </div>
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color: "#dc2626",
                                      flexShrink: 0,
                                    }}
                                  >
                                    ₹{Number(adv.amount).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Net Pay hero */}
                  <div
                    style={{
                      width: "100%",
                      background: "rgba(99,102,241,0.06)",
                      border: "1.5px solid rgba(99,102,241,0.15)",
                      borderRadius: 14,
                      padding: "18px 18px 20px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: ACCENT,
                        textTransform: "uppercase",
                        letterSpacing: "0.09em",
                        marginBottom: 6,
                      }}
                    >
                      Net Pay {!includeAdvances && "(Advances Excluded)"}
                    </div>
                    <div
                      style={{
                        fontSize: 42,
                        fontWeight: 900,
                        color: ACCENT2,
                        lineHeight: 1.1,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      ₹{currentNetPay.toFixed(0)}
                    </div>
                  </div>
                </div>

                {/* Prev / Next navigation */}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "12px 16px",
                    borderTop: "1px solid rgba(99,102,241,0.1)",
                    flexShrink: 0,
                    background: "#f8f9ff",
                  }}
                >
                  <button
                    type="button"
                    data-ocid="payments.overview.pagination_prev"
                    onClick={() =>
                      setCurrentOverviewIndex((i) => Math.max(0, i - 1))
                    }
                    disabled={currentOverviewIndex === 0}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 10,
                      border: "1.5px solid #E2E8F0",
                      background:
                        currentOverviewIndex === 0 ? "#F8FAFC" : "#FFFFFF",
                      color:
                        currentOverviewIndex === 0 ? "#CBD5E1" : TEXT_PRIMARY,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor:
                        currentOverviewIndex === 0 ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    data-ocid="payments.overview.pagination_next"
                    onClick={() =>
                      setCurrentOverviewIndex((i) =>
                        Math.min(payments.length - 1, i + 1),
                      )
                    }
                    disabled={currentOverviewIndex === payments.length - 1}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      borderRadius: 10,
                      border: "none",
                      background:
                        currentOverviewIndex === payments.length - 1
                          ? "#CBD5E1"
                          : GRAD,
                      color: "#ffffff",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor:
                        currentOverviewIndex === payments.length - 1
                          ? "not-allowed"
                          : "pointer",
                      boxShadow:
                        currentOverviewIndex === payments.length - 1
                          ? "none"
                          : "0 2px 10px rgba(99,102,241,0.3)",
                      transition: "all 0.15s",
                    }}
                  >
                    Next →
                  </button>
                </div>
              </>
            )}

            {/* ── MULTI SELECT MODE ── */}
            {overviewMode === "multi-select" && (
              <>
                {/* Labour Checklist */}
                <div
                  style={{
                    padding: "12px 16px 8px",
                    borderBottom: "1px solid rgba(99,102,241,0.1)",
                    flexShrink: 0,
                    background: "#ffffff",
                  }}
                >
                  <button
                    type="button"
                    data-ocid="payments.overview.toggle"
                    onClick={() => {
                      if (selectedOverviewIndices.size === payments.length) {
                        setSelectedOverviewIndices(new Set());
                      } else {
                        setSelectedOverviewIndices(
                          new Set(payments.map((_, i) => i)),
                        );
                      }
                    }}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: ACCENT,
                      background: "rgba(99,102,241,0.07)",
                      border: "1.5px solid rgba(99,102,241,0.2)",
                      borderRadius: 8,
                      padding: "5px 12px",
                      cursor: "pointer",
                      marginBottom: 8,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {selectedOverviewIndices.size === payments.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>

                {/* Scrollable checklist */}
                <div
                  style={{
                    overflowY: "auto",
                    maxHeight: 220,
                    position: "relative",
                    background: "#ffffff",
                  }}
                >
                  {payments.map((p, i) => {
                    const checked = selectedOverviewIndices.has(i);
                    return (
                      <label
                        key={String(p.labourId)}
                        data-ocid={`payments.overview.checkbox.${i + 1}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 16px",
                          borderBottom: "1px solid #F1F5F9",
                          cursor: "pointer",
                          background: checked
                            ? "rgba(99,102,241,0.06)"
                            : "#FFFFFF",
                          transition: "background 0.1s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = new Set(selectedOverviewIndices);
                            if (checked) next.delete(i);
                            else next.add(i);
                            setSelectedOverviewIndices(next);
                          }}
                          style={{
                            width: 17,
                            height: 17,
                            accentColor: ACCENT,
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            flex: 1,
                            fontSize: 14,
                            fontWeight: 600,
                            color: TEXT_PRIMARY,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.labourName}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: ACCENT,
                            flexShrink: 0,
                          }}
                        >
                          ₹
                          {(includeAdvances
                            ? p.finalPayment
                            : p.totalGross
                          ).toFixed(0)}
                        </span>
                      </label>
                    );
                  })}
                  <div
                    style={{
                      position: "sticky",
                      bottom: 0,
                      height: 20,
                      background:
                        "linear-gradient(to top, rgba(241,243,248,0.95), transparent)",
                      pointerEvents: "none",
                    }}
                  />
                </div>

                {/* Combined Total Section */}
                <div
                  style={{
                    padding: "16px",
                    background: "rgba(243,244,255,0.9)",
                    borderTop: "1.5px solid rgba(99,102,241,0.2)",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: TEXT_PRIMARY,
                      marginBottom: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                  >
                    {selectedOverviewIndices.size === 1
                      ? (selectedPayments[0]?.labourName ?? "Labour")
                      : `Selected: ${selectedOverviewIndices.size} labours`}
                  </div>

                  {/* Advances row */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: TEXT_PRIMARY,
                      }}
                    >
                      Total Advances
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#DC2626",
                      }}
                    >
                      ₹{combinedAdvances.toLocaleString()}
                    </span>
                  </div>

                  {/* Net Pay hero */}
                  <div
                    style={{
                      borderTop: "1px solid rgba(99,102,241,0.15)",
                      paddingTop: 10,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: ACCENT,
                        textTransform: "uppercase",
                        letterSpacing: "0.09em",
                        marginBottom: 4,
                      }}
                    >
                      {selectedOverviewIndices.size === 1
                        ? "Net Pay"
                        : "Combined Net Pay"}
                      {!includeAdvances && " (Advances Excluded)"}
                    </div>
                    <div
                      style={{
                        fontSize: 38,
                        fontWeight: 900,
                        color: ACCENT2,
                        lineHeight: 1.1,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      ₹{combinedNetPay.toFixed(0)}
                    </div>
                  </div>
                </div>
              </>
            )}
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
