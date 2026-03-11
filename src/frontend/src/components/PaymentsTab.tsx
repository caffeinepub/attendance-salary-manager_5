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

  // biome-ignore lint/correctness/useExhaustiveDependencies: actor is intentionally excluded
  useEffect(() => {
    actor
      ?.getAllContracts()
      .then((cs) => setContracts(cs.filter((c) => !c.isSettled)));
    actor?.getAllLabours().then(setLabours);
  }, []);

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
  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 600,
    fontSize: 12,
    color: "#aaa",
    background: "#252525",
    borderBottom: "1px solid #3a3a3a",
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid #2a2a2a",
    fontSize: 13,
  };

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Payments</h2>

      <div className="mb-4">
        <div className="text-sm font-medium mb-2" style={{ color: "#aaa" }}>
          Select Contracts:
        </div>
        <div className="flex flex-wrap gap-2">
          {contracts.map((c) => (
            <label
              key={String(c.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
              style={{
                background: selectedIds.has(String(c.id))
                  ? "#3a1f00"
                  : "#2a2a2a",
                border: `1px solid ${selectedIds.has(String(c.id)) ? "#f97316" : "#3a3a3a"}`,
              }}
            >
              <input
                data-ocid={`payments.contract.checkbox.${contracts.indexOf(c) + 1}`}
                type="checkbox"
                checked={selectedIds.has(String(c.id))}
                onChange={() => toggleContract(String(c.id))}
                style={{ accentColor: "#f97316" }}
              />
              <span className="text-sm">{c.name}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          data-ocid="payments.calculate.button"
          onClick={calculate}
          disabled={selectedIds.size === 0 || loading}
          className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold"
          style={{
            background: "#f97316",
            color: "#fff",
            opacity: selectedIds.size === 0 ? 0.5 : 1,
          }}
        >
          {loading ? "Calculating..." : "Calculate Payments"}
        </button>
      </div>

      {payments.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
            <thead>
              <tr>
                <th
                  style={{ ...thStyle, position: "sticky", left: 0, zIndex: 2 }}
                >
                  Labour
                </th>
                {selectedContracts.map((c) => (
                  <th key={String(c.id)} style={thStyle}>
                    {c.name}
                  </th>
                ))}
                <th style={thStyle}>Total Attendance</th>
                <th style={thStyle}>Advances</th>
                <th style={thStyle}>Final Payment</th>
                <th style={thStyle}>Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((lp, i) => (
                <>
                  <tr
                    key={String(lp.labourId)}
                    data-ocid={`payments.item.${i + 1}`}
                    style={{ background: i % 2 === 0 ? "#242424" : "#222" }}
                  >
                    <td
                      style={{
                        ...tdStyle,
                        position: "sticky",
                        left: 0,
                        background: "#242424",
                        zIndex: 1,
                        fontWeight: 600,
                      }}
                    >
                      {lp.labourName}
                    </td>
                    {selectedContracts.map((c) => {
                      const cbd = lp.contractBreakdowns.find(
                        (b) => String(b.contractId) === String(c.id),
                      );
                      return (
                        <td key={String(c.id)} style={tdStyle}>
                          {cbd
                            ? `₹${Number(cbd.netSalary).toLocaleString()}`
                            : "-"}
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, color: "#a3e635" }}>
                      ₹{lp.totalAttendance.toFixed(0)}
                    </td>
                    <td style={{ ...tdStyle, color: "#f87171" }}>
                      ₹{lp.totalAdvances.toLocaleString()}
                    </td>
                    <td
                      style={{ ...tdStyle, color: "#f97316", fontWeight: 700 }}
                    >
                      ₹{lp.finalPayment.toFixed(0)}
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        data-ocid={`payments.breakdown.button.${i + 1}`}
                        onClick={() => toggleBreakdown(String(lp.labourId))}
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          background: "#333",
                          color: "#f97316",
                          border: "1px solid #f97316",
                        }}
                      >
                        {expandedLabours.has(String(lp.labourId))
                          ? "Hide"
                          : "Show"}
                      </button>
                    </td>
                  </tr>
                  {expandedLabours.has(String(lp.labourId)) && (
                    <tr style={{ background: "#1a1a1a" }}>
                      <td
                        colSpan={selectedContracts.length + 5}
                        style={{ padding: "12px 24px" }}
                      >
                        <div
                          className="text-xs font-semibold mb-2"
                          style={{ color: "#f97316" }}
                        >
                          Salary Breakdown for {lp.labourName}
                        </div>
                        <div className="flex flex-col gap-1">
                          {lp.contractBreakdowns.map((b) => (
                            <div
                              key={String(b.contractId)}
                              className="flex gap-4 text-xs"
                              style={{ color: "#ccc" }}
                            >
                              <span
                                className="font-semibold"
                                style={{ minWidth: 120 }}
                              >
                                {b.contractName}:
                              </span>
                              <span>
                                Bed: ₹{Number(b.bedSalary).toFixed(0)}
                              </span>
                              <span>
                                Paper: ₹{Number(b.paperSalary).toFixed(0)}
                              </span>
                              <span>
                                Mesh: ₹{Number(b.meshSalary).toFixed(0)}
                              </span>
                              <span
                                style={{ color: "#f97316", fontWeight: 600 }}
                              >
                                Net: ₹{Number(b.netSalary).toFixed(0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {/* Totals */}
              <tr style={{ background: "#2a2a2a", fontWeight: 700 }}>
                <td
                  style={{
                    ...tdStyle,
                    position: "sticky",
                    left: 0,
                    background: "#2a2a2a",
                    zIndex: 1,
                  }}
                >
                  Total
                </td>
                {selectedContracts.map((c) => (
                  <td
                    key={String(c.id)}
                    style={{ ...tdStyle, color: "#f97316" }}
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
                <td style={{ ...tdStyle, color: "#a3e635" }}>
                  ₹
                  {payments
                    .reduce((s, lp) => s + lp.totalAttendance, 0)
                    .toFixed(0)}
                </td>
                <td style={{ ...tdStyle, color: "#f87171" }}>
                  ₹
                  {payments
                    .reduce((s, lp) => s + lp.totalAdvances, 0)
                    .toLocaleString()}
                </td>
                <td style={{ ...tdStyle, color: "#f97316" }}>
                  ₹
                  {payments
                    .reduce((s, lp) => s + lp.finalPayment, 0)
                    .toFixed(0)}
                </td>
                <td style={tdStyle} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
