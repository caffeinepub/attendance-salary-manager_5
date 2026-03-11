import { useEffect, useState } from "react";
import type { Contract, Labour, SalaryBreakdown } from "../backend.d";
import { useActor } from "../hooks/useActor";

interface LabourPayment {
  labourId: bigint;
  labourName: string;
  contractBreakdowns: {
    contractId: bigint;
    contractName: string;
    netSalary: bigint;
    bedSalary: bigint;
    paperSalary: bigint;
    meshSalary: bigint;
  }[];
  totalAttendance: number;
  totalAdvances: number;
  finalPayment: number;
}

export function PaymentsTab() {
  const { actor } = useActor();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payments, setPayments] = useState<LabourPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLabours, setExpandedLabours] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!actor) return;
    actor
      .getAllContracts()
      .then((cs) => setContracts(cs.filter((c) => !c.isSettled)));
    actor.getAllLabours().then(setLabours);
  }, [actor]);

  const toggleContract = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const calculate = async () => {
    setLoading(true);
    try {
      const allBreakdowns: {
        contractId: bigint;
        contractName: string;
        breakdown: SalaryBreakdown[];
      }[] = [];
      for (const idStr of selectedIds) {
        const cid = BigInt(idStr);
        const contract = contracts.find((c) => String(c.id) === idStr);
        if (!contract) continue;
        const bd = (await actor?.calculateNetSalaries(cid)) ?? [];
        allBreakdowns.push({
          contractId: cid,
          contractName: contract.name,
          breakdown: bd,
        });
      }

      const labourMap = new Map<string, LabourPayment>();
      for (const l of labours) {
        labourMap.set(String(l.id), {
          labourId: l.id,
          labourName: l.name,
          contractBreakdowns: [],
          totalAttendance: 0,
          totalAdvances: 0,
          finalPayment: 0,
        });
      }

      for (const { contractId, contractName, breakdown } of allBreakdowns) {
        for (const item of breakdown) {
          const key = String(item.labourId);
          if (!labourMap.has(key)) {
            labourMap.set(key, {
              labourId: item.labourId,
              labourName: item.labourName,
              contractBreakdowns: [],
              totalAttendance: 0,
              totalAdvances: 0,
              finalPayment: 0,
            });
          }
          const lp = labourMap.get(key)!;
          lp.contractBreakdowns.push({
            contractId,
            contractName,
            netSalary: item.netSalary,
            bedSalary: item.bedSalary,
            paperSalary: item.paperSalary,
            meshSalary: item.meshSalary,
          });
          lp.totalAttendance += Number(item.totalAttendanceSalary);
          lp.totalAdvances += Number(item.totalAdvances);
          lp.finalPayment += Number(item.netSalary);
        }
      }

      setPayments(Array.from(labourMap.values()));
    } finally {
      setLoading(false);
    }
  };

  const toggleBreakdown = (id: string) => {
    setExpandedLabours((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "#0F172A",
            margin: 0,
          }}
        >
          Payments Sheet
        </h2>
        <p style={{ fontSize: 12, color: "#64748B", margin: 0, marginTop: 2 }}>
          Net salary minus advances — final payment per labour
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

        {/* Calculate Button */}
        <button
          type="button"
          data-ocid="payments.calculate.button"
          onClick={calculate}
          disabled={selectedIds.size === 0 || loading}
          style={{
            marginTop: 14,
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
            cursor:
              selectedIds.size === 0 || loading ? "not-allowed" : "pointer",
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
      </div>

      {/* Stats Bar — shown after calculation */}
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
                    Final Payment
                  </th>
                  <th
                    style={{
                      ...TH_DARK,
                      borderRadius:
                        selectedContracts.length === 0
                          ? "0 14px 0 0"
                          : undefined,
                    }}
                  >
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((lp, i) => (
                  <>
                    <tr
                      key={String(lp.labourId)}
                      data-ocid={`payments.item.${i + 1}`}
                      style={{
                        background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                        transition: "background 0.15s",
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
                        const cbd = lp.contractBreakdowns.find(
                          (b) => String(b.contractId) === String(c.id),
                        );
                        return (
                          <td
                            key={String(c.id)}
                            style={{ ...TD, color: "#334155" }}
                          >
                            {cbd
                              ? `₹${Number(cbd.netSalary).toLocaleString()}`
                              : "—"}
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
                      <td style={TD}>
                        <button
                          type="button"
                          data-ocid={`payments.breakdown.button.${i + 1}`}
                          onClick={() => toggleBreakdown(String(lp.labourId))}
                          style={{
                            background: expandedLabours.has(String(lp.labourId))
                              ? "#F97316"
                              : "#FFF7ED",
                            color: expandedLabours.has(String(lp.labourId))
                              ? "#FFFFFF"
                              : "#F97316",
                            border: "1.5px solid #F97316",
                            borderRadius: 999,
                            padding: "4px 12px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.15s",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {expandedLabours.has(String(lp.labourId))
                            ? "▲ Hide"
                            : "▼ Show"}
                        </button>
                      </td>
                    </tr>

                    {expandedLabours.has(String(lp.labourId)) && (
                      <tr key={`${String(lp.labourId)}_bd`}>
                        <td
                          colSpan={selectedContracts.length + 5}
                          style={{
                            padding: "0",
                            borderBottom: "1px solid #E2E8F0",
                          }}
                        >
                          <div
                            style={{
                              background:
                                "linear-gradient(135deg, #EDE9FE 0%, #F0F9FF 100%)",
                              padding: "14px 20px",
                            }}
                          >
                            <div
                              style={{
                                background: "#FFFFFF",
                                borderRadius: 10,
                                padding: "12px 16px",
                                boxShadow: "0 2px 8px rgba(124,58,237,0.08)",
                                border: "1px solid #DDD6FE",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: "#7C3AED",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  marginBottom: 10,
                                }}
                              >
                                Salary Breakdown — {lp.labourName}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 8,
                                }}
                              >
                                {lp.contractBreakdowns.map((b) => (
                                  <div
                                    key={String(b.contractId)}
                                    style={{
                                      display: "flex",
                                      gap: 12,
                                      flexWrap: "wrap",
                                      alignItems: "center",
                                      padding: "6px 10px",
                                      background: "#F8FAFC",
                                      borderRadius: 8,
                                      border: "1px solid #E2E8F0",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: 800,
                                        color: "#0F172A",
                                        fontSize: 12,
                                        minWidth: 120,
                                      }}
                                    >
                                      {b.contractName}
                                    </span>
                                    {[
                                      {
                                        label: "Bed",
                                        val: b.bedSalary,
                                        color: "#7C3AED",
                                      },
                                      {
                                        label: "Paper",
                                        val: b.paperSalary,
                                        color: "#0EA5E9",
                                      },
                                      {
                                        label: "Mesh",
                                        val: b.meshSalary,
                                        color: "#10B981",
                                      },
                                    ].map((item) => (
                                      <span
                                        key={item.label}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                          fontSize: 12,
                                          color: "#475569",
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: "50%",
                                            background: item.color,
                                            display: "inline-block",
                                          }}
                                        />
                                        {item.label}:{" "}
                                        <strong style={{ color: item.color }}>
                                          ₹{Number(item.val).toFixed(0)}
                                        </strong>
                                      </span>
                                    ))}
                                    <span
                                      style={{
                                        marginLeft: "auto",
                                        fontWeight: 800,
                                        color: "#F97316",
                                        fontSize: 13,
                                        background: "#FFF7ED",
                                        padding: "3px 10px",
                                        borderRadius: 999,
                                        border: "1px solid #FED7AA",
                                      }}
                                    >
                                      Net: ₹{Number(b.netSalary).toFixed(0)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
                        .reduce((s, lp) => {
                          const cbd = lp.contractBreakdowns.find(
                            (b) => String(b.contractId) === String(c.id),
                          );
                          return s + (cbd ? Number(cbd.netSalary) : 0);
                        }, 0)
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
                  <td style={{ ...TD, borderBottom: "none" }} />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
