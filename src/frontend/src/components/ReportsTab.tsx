import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AppMode } from "../App";
import type {
  Advance,
  Attendance,
  Contract,
  Labour,
  SalaryBreakdown,
} from "../backend.d";
import { useActor } from "../hooks/useActor";

interface Props {
  mode: AppMode;
}

interface AttendanceRate {
  name: string;
  present: number;
  absent: number;
  other: number;
  total: number;
}

export function ReportsTab({ mode: _mode }: Props) {
  const { actor } = useActor();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<bigint, Attendance[]>>(
    new Map(),
  );
  const [salariesMap, setSalariesMap] = useState<
    Map<bigint, SalaryBreakdown[]>
  >(new Map());

  useEffect(() => {
    if (!actor) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [cs, ls, advs] = await Promise.all([
          actor.getAllContracts(),
          actor.getAllLabours(),
          actor.getAllAdvances(),
        ]);
        if (cancelled) return;
        const [attendanceResults, salariesResults] = await Promise.all([
          Promise.all(cs.map((c) => actor.getAttendanceByContract(c.id))),
          Promise.all(cs.map((c) => actor.calculateNetSalaries(c.id))),
        ]);
        if (cancelled) return;
        const aMap = new Map<bigint, Attendance[]>();
        const sMap = new Map<bigint, SalaryBreakdown[]>();
        cs.forEach((c, i) => {
          aMap.set(c.id, attendanceResults[i]);
          sMap.set(c.id, salariesResults[i]);
        });
        setContracts(cs);
        setLabours(ls);
        setAdvances(advs);
        setAttendanceMap(aMap);
        setSalariesMap(sMap);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [actor]);

  // Summary stats
  const totalSalaryPaid = [...salariesMap.values()]
    .flat()
    .reduce((s, sb) => s + Number(sb.netSalary), 0);
  const totalAdvances = advances.reduce((s, a) => s + Number(a.amount), 0);

  // Bar chart data
  const chartData = contracts.map((c) => {
    const salaries = salariesMap.get(c.id) ?? [];
    const total = salaries.reduce((s, sb) => s + Number(sb.netSalary), 0);
    return {
      name: c.name.length > 12 ? `${c.name.slice(0, 11)}…` : c.name,
      salary: Math.round(total),
      fullName: c.name,
    };
  });

  // Attendance rate per labour
  const allAttendance = [...attendanceMap.values()].flat();
  const attendanceRates: AttendanceRate[] = labours
    .map((l) => {
      const records = allAttendance.filter((a) => a.labourId === l.id);
      const total = records.length;
      if (total === 0)
        return { name: l.name, present: 0, absent: 0, other: 0, total: 0 };
      const present = records.filter((a) => a.value === "Present").length;
      const absent = records.filter((a) => a.value === "Absent").length;
      const other = total - present - absent;
      return {
        name: l.name,
        present: Math.round((present / total) * 100),
        absent: Math.round((absent / total) * 100),
        other: Math.round((other / total) * 100),
        total,
      };
    })
    .sort((a, b) => b.present - a.present);

  // Labour salary history
  const labourSalaryHistory = labours.map((l) => {
    const perContract = contracts.map((c) => {
      const salaries = salariesMap.get(c.id) ?? [];
      const entry = salaries.find((sb) => sb.labourId === l.id);
      return {
        contractId: c.id,
        contractName: c.name,
        net: entry ? Number(entry.netSalary) : 0,
      };
    });
    const total = perContract.reduce((s, x) => s + x.net, 0);
    return { labour: l, perContract, total };
  });

  const CARD_STYLE = {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 14,
    padding: "16px 18px",
    boxShadow: "0 2px 8px rgba(15,23,42,0.07)",
  };

  if (loading) {
    return (
      <div
        data-ocid="reports.loading_state"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 200,
          color: "#94A3B8",
          fontSize: 15,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid #F97316",
              borderTopColor: "transparent",
              borderRadius: "50%",
              margin: "0 auto 12px",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <style>
            {"@keyframes spin { to { transform: rotate(360deg); } }"}
          </style>
          Loading reports…
        </div>
      </div>
    );
  }

  return (
    <div data-ocid="reports.page">
      {/* Header */}
      <div
        style={{
          borderLeft: "4px solid #F97316",
          paddingLeft: 12,
          marginBottom: 20,
        }}
      >
        <h2
          style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: 0 }}
        >
          Reports &amp; Analysis
        </h2>
        <p style={{ fontSize: 12, color: "#64748B", margin: 0, marginTop: 2 }}>
          Overview of contracts, attendance, and salaries
        </p>
      </div>

      {/* Summary Cards 2x2 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}
        data-ocid="reports.section"
      >
        {[
          {
            label: "Total Contracts",
            value: contracts.length,
            color: "#F97316",
            emoji: "📋",
          },
          {
            label: "Total Labours",
            value: labours.length,
            color: "#1D4ED8",
            emoji: "👷",
          },
          {
            label: "Total Salary Paid",
            value: `₹${totalSalaryPaid.toLocaleString()}`,
            color: "#16A34A",
            emoji: "💰",
          },
          {
            label: "Total Advances",
            value: `₹${totalAdvances.toLocaleString()}`,
            color: "#DC2626",
            emoji: "📤",
          },
        ].map((card) => (
          <div key={card.label} style={CARD_STYLE} data-ocid="reports.card">
            <div style={{ fontSize: 18, marginBottom: 4 }}>{card.emoji}</div>
            <div
              style={{
                fontSize: 10,
                color: "#94A3B8",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: card.color,
                marginTop: 2,
              }}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Salary per Contract Bar Chart */}
      {chartData.length > 0 && (
        <div style={{ ...CARD_STYLE, marginBottom: 24 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#0F172A",
              marginBottom: 14,
            }}
          >
            Salary per Contract
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => [
                  `₹${value.toLocaleString()}`,
                  "Net Salary",
                ]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullName ?? ""
                }
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #E2E8F0",
                }}
              />
              <Bar dataKey="salary" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Attendance Rate per Labour */}
      <div style={{ ...CARD_STYLE, marginBottom: 24 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#0F172A",
            marginBottom: 12,
          }}
        >
          Attendance Rate per Labour
        </div>
        {attendanceRates.length === 0 ? (
          <div
            data-ocid="reports.attendance_rate.empty_state"
            style={{
              color: "#94A3B8",
              fontSize: 13,
              textAlign: "center",
              padding: "16px 0",
            }}
          >
            No attendance data yet
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{ borderCollapse: "collapse", width: "100%" }}
              data-ocid="reports.attendance_rate.table"
            >
              <thead>
                <tr style={{ background: "#1E293B" }}>
                  {["Labour", "Present%", "Absent%", "Other%", "Records"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "9px 12px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#FFFFFF",
                          whiteSpace: "nowrap",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {attendanceRates.map((r, idx) => (
                  <tr
                    key={r.name}
                    style={{
                      background: idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                    }}
                    data-ocid={`reports.attendance_rate.item.${idx + 1}`}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#0F172A",
                        borderBottom: "1px solid #F1F5F9",
                      }}
                    >
                      {r.name}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#16A34A",
                        borderBottom: "1px solid #F1F5F9",
                      }}
                    >
                      {r.present}%
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#DC2626",
                        borderBottom: "1px solid #F1F5F9",
                      }}
                    >
                      {r.absent}%
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#EA580C",
                        borderBottom: "1px solid #F1F5F9",
                      }}
                    >
                      {r.other}%
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#64748B",
                        borderBottom: "1px solid #F1F5F9",
                      }}
                    >
                      {r.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Labour Salary History */}
      <div style={{ ...CARD_STYLE, marginBottom: 8 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#0F172A",
            marginBottom: 12,
          }}
        >
          Labour Salary History
        </div>
        {labourSalaryHistory.length === 0 ? (
          <div
            data-ocid="reports.salary_history.empty_state"
            style={{
              color: "#94A3B8",
              fontSize: 13,
              textAlign: "center",
              padding: "16px 0",
            }}
          >
            No salary data yet
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{ borderCollapse: "collapse", minWidth: "100%" }}
              data-ocid="reports.salary_history.table"
            >
              <thead>
                <tr style={{ background: "#1E293B" }}>
                  <th
                    style={{
                      padding: "9px 12px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      whiteSpace: "nowrap",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      position: "sticky",
                      left: 0,
                      background: "#1E293B",
                      zIndex: 2,
                    }}
                  >
                    Labour
                  </th>
                  {contracts.map((c) => (
                    <th
                      key={String(c.id)}
                      style={{
                        padding: "9px 12px",
                        textAlign: "right",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#FED7AA",
                        whiteSpace: "nowrap",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        minWidth: 90,
                      }}
                    >
                      {c.name.length > 10 ? `${c.name.slice(0, 9)}…` : c.name}
                    </th>
                  ))}
                  <th
                    style={{
                      padding: "9px 12px",
                      textAlign: "right",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#FDE68A",
                      whiteSpace: "nowrap",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {labourSalaryHistory.map((row, idx) => (
                  <tr
                    key={String(row.labour.id)}
                    style={{
                      background: idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                    }}
                    data-ocid={`reports.salary_history.item.${idx + 1}`}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#0F172A",
                        borderBottom: "1px solid #F1F5F9",
                        position: "sticky",
                        left: 0,
                        background: idx % 2 === 0 ? "#EFF6FF" : "#EFF6FF",
                        zIndex: 1,
                      }}
                    >
                      {row.labour.name}
                    </td>
                    {row.perContract.map((pc) => (
                      <td
                        key={String(pc.contractId)}
                        style={{
                          padding: "8px 12px",
                          fontSize: 13,
                          textAlign: "right",
                          color: pc.net > 0 ? "#F97316" : "#CBD5E1",
                          fontWeight: pc.net > 0 ? 700 : 400,
                          borderBottom: "1px solid #F1F5F9",
                        }}
                      >
                        {pc.net > 0 ? `₹${pc.net.toLocaleString()}` : "—"}
                      </td>
                    ))}
                    <td
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        textAlign: "right",
                        fontWeight: 800,
                        color: "#16A34A",
                        borderBottom: "1px solid #F1F5F9",
                      }}
                    >
                      ₹{row.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
