import { useEffect, useState } from "react";
import type { Attendance, Contract, Group, Labour } from "../backend.d";
import { useActor } from "../hooks/useActor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyActor = any;

function attendanceNum(v: string): number {
  if (v === "Present" || v === "present") return 1;
  if (v === "Absent" || v === "absent") return 0;
  return Number.parseFloat(v) || 0;
}

type FilterMode = "all" | "group" | "labour";

interface LabourPayment {
  labourId: bigint;
  labourName: string;
  contractSalaries: Map<string, number>;
  totalGross: number;
  totalAdvances: number;
  finalPayment: number;
}

export function PaymentsTab() {
  const { actor } = useActor();
  const a = actor as AnyActor;

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payments, setPayments] = useState<LabourPayment[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [filterLabourIds, setFilterLabourIds] = useState<Set<string>>(
    new Set(),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: a is derived from actor
  useEffect(() => {
    if (!a) return;
    a.getAllContracts().then((cs: Contract[]) =>
      setContracts(cs.filter((c) => !c.isSettled)),
    );
    a.getAllLabours().then(setLabours);
    if (a.getAllGroups) a.getAllGroups().then(setGroups);
  }, [actor]);

  const toggleContract = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLabourFilter = (id: string) => {
    setFilterLabourIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getFilteredLabours = (): Labour[] => {
    if (filterMode === "all") return labours;
    if (filterMode === "group" && filterGroupId) {
      const gid = BigInt(filterGroupId);
      return labours.filter((l) => l.groupId === gid);
    }
    if (filterMode === "labour" && filterLabourIds.size > 0) {
      return labours.filter((l) => filterLabourIds.has(String(l.id)));
    }
    return labours;
  };

  const calculate = async () => {
    if (!a) return;
    setLoading(true);
    try {
      const filteredLabours = getFilteredLabours();
      const labourMap = new Map<string, LabourPayment>();

      for (const l of filteredLabours) {
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

        // Column sums use ALL labours for correct proportional calculation
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
            lp.totalAdvances += advanceMap.get(lid) ?? 0;
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

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px",
    borderRadius: 999,
    border: active ? "2px solid #FF7F11" : "2px solid #E2E8F0",
    background: active ? "#FF7F11" : "#F1F5F9",
    color: active ? "#fff" : "#475569",
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.15s",
  });

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

      {/* Contract Selection */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#64748B",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Select Contracts
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {contracts.map((c) => {
            const isSelected = selectedIds.has(String(c.id));
            return (
              <label
                key={String(c.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 16px",
                  borderRadius: 999,
                  cursor: "pointer",
                  background: isSelected
                    ? "linear-gradient(135deg, #F97316, #EA580C)"
                    : "#F1F5F9",
                  color: isSelected ? "#FFFFFF" : "#475569",
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: 13,
                  border: isSelected
                    ? "2px solid transparent"
                    : "2px solid #E2E8F0",
                  transition: "all 0.18s",
                  boxShadow: isSelected
                    ? "0 2px 8px rgba(249,115,22,0.30)"
                    : "none",
                  userSelect: "none",
                }}
              >
                <input
                  data-ocid={`payments.contract.checkbox.${contracts.indexOf(c) + 1}`}
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleContract(String(c.id))}
                  style={{ display: "none" }}
                />
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    border: isSelected
                      ? "2px solid rgba(255,255,255,0.7)"
                      : "2px solid #94A3B8",
                    background: isSelected
                      ? "rgba(255,255,255,0.25)"
                      : "transparent",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {isSelected ? "✓" : ""}
                </span>
                {c.name}
              </label>
            );
          })}
        </div>
      </div>

      {/* Filter Labours */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E5E5",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#64748B",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Filter Labours
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            data-ocid="payments.filter.all.toggle"
            style={filterBtnStyle(filterMode === "all")}
            onClick={() => setFilterMode("all")}
          >
            All
          </button>
          <button
            type="button"
            data-ocid="payments.filter.group.toggle"
            style={filterBtnStyle(filterMode === "group")}
            onClick={() => setFilterMode("group")}
          >
            By Group
          </button>
          <button
            type="button"
            data-ocid="payments.filter.labour.toggle"
            style={filterBtnStyle(filterMode === "labour")}
            onClick={() => setFilterMode("labour")}
          >
            By Labour
          </button>
        </div>

        {filterMode === "group" && (
          <select
            data-ocid="payments.filter.group.select"
            value={filterGroupId}
            onChange={(e) => setFilterGroupId(e.target.value)}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E5E5E5",
              color: "#1F1F1F",
              borderRadius: 8,
              padding: "8px 12px",
              width: "100%",
              maxWidth: 300,
              fontSize: 13,
            }}
          >
            <option value="">Select a group...</option>
            {groups.map((g) => (
              <option key={String(g.id)} value={String(g.id)}>
                {g.name}
              </option>
            ))}
          </select>
        )}

        {filterMode === "labour" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {labours.map((l, i) => {
              const checked = filterLabourIds.has(String(l.id));
              return (
                <label
                  key={String(l.id)}
                  data-ocid={`payments.filter.labour.checkbox.${i + 1}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 12px",
                    borderRadius: 999,
                    cursor: "pointer",
                    background: checked ? "#FFF3E0" : "#F1F5F9",
                    border: checked
                      ? "1.5px solid #FF7F11"
                      : "1.5px solid #E2E8F0",
                    color: checked ? "#FF7F11" : "#475569",
                    fontWeight: checked ? 700 : 500,
                    fontSize: 13,
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLabourFilter(String(l.id))}
                    style={{ display: "none" }}
                  />
                  {checked ? "✓ " : ""}
                  {l.name}
                </label>
              );
            })}
            {labours.length === 0 && (
              <p style={{ color: "#9E9E9E", fontSize: 13 }}>
                No labours available.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Calculate Button */}
      <button
        type="button"
        data-ocid="payments.calculate.button"
        onClick={calculate}
        disabled={selectedIds.size === 0 || loading}
        style={{
          marginBottom: 16,
          width: "100%",
          maxWidth: 340,
          display: "block",
          background:
            selectedIds.size === 0 || loading
              ? "#CBD5E1"
              : "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
          color: "#fff",
          border: "none",
          borderRadius: 999,
          padding: "12px 0",
          fontSize: 15,
          fontWeight: 800,
          cursor: selectedIds.size === 0 || loading ? "not-allowed" : "pointer",
          boxShadow:
            selectedIds.size === 0 || loading
              ? "none"
              : "0 4px 20px rgba(249,115,22,0.40)",
          letterSpacing: "0.03em",
          transition: "all 0.2s",
        }}
      >
        {loading ? "Calculating…" : "Calculate Payments"}
      </button>

      {/* Stats Bar */}
      {payments.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
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
                    style={{
                      background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                    }}
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
