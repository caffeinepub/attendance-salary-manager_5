import { useEffect, useRef, useState } from "react";
import type { AppMode } from "../App";
import type { Attendance, Contract, Labour } from "../backend.d";
import { useActor } from "../hooks/useActor";

interface Props {
  mode: AppMode;
}

const ATTENDANCE_VALUES = [
  "Absent",
  "Present",
  "0.33",
  "0.4",
  "0.5",
  "0.66",
  "0.7",
  "0.8",
  "0.9",
];

function attendanceNum(v: string): number {
  if (v === "Present") return 1;
  if (v === "Absent") return 0;
  return Number.parseFloat(v) || 0;
}

function cellColor(v: string): string {
  if (v === "Present") return "#14532d";
  if (v === "Absent") return "#3b1010";
  const n = Number.parseFloat(v);
  if (n >= 0.8) return "#1e3a1e";
  if (n >= 0.5) return "#3a2d0a";
  return "#2a1a1a";
}

export function AttendanceTab({ mode }: Props) {
  const { actor } = useActor();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<bigint | null>(
    null,
  );
  const [contract, setContract] = useState<Contract | null>(null);
  const [attendance, setAttendance] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [meshCols, setMeshCols] = useState<string[]>([]);
  const [renamingCol, setRenamingCol] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!actor) return;
    actor
      .getAllContracts()
      .then((cs) => setContracts(cs.filter((c) => !c.isSettled)));
    actor.getAllLabours().then(setLabours);
  }, [actor]);

  useEffect(() => {
    if (!selectedContractId || !actor) return;
    actor.getContract(selectedContractId).then((c) => {
      setContract(c);
      setMeshCols(c.meshColumns);
    });
    actor.getAttendanceByContract(selectedContractId).then((records) => {
      const map = new Map<string, string>();
      for (const r of records) {
        const colKey =
          r.columnType.__kind__ === "mesh"
            ? `mesh_${r.columnType.mesh}`
            : r.columnType.__kind__;
        map.set(`${r.labourId}_${colKey}`, r.value);
      }
      setAttendance(map);
    });
  }, [selectedContractId, actor]);

  const getVal = (labourId: bigint, colKey: string) =>
    attendance.get(`${labourId}_${colKey}`) || "Absent";

  const setVal = (labourId: bigint, colKey: string, val: string) => {
    setAttendance((prev) => new Map(prev).set(`${labourId}_${colKey}`, val));
  };

  const colSum = (colKey: string) =>
    labours.reduce((s, l) => s + attendanceNum(getVal(l.id, colKey)), 0);

  const allMeshSum = () =>
    meshCols.reduce((s, _, i) => s + colSum(`mesh_${i}`), 0);

  const labourNetSalary = (labourId: bigint) => {
    if (!contract) return 0;
    const bedS =
      colSum("bed") > 0
        ? (attendanceNum(getVal(labourId, "bed")) / colSum("bed")) *
          Number(contract.bedAmount)
        : 0;
    const papS =
      colSum("paper") > 0
        ? (attendanceNum(getVal(labourId, "paper")) / colSum("paper")) *
          Number(contract.paperAmount)
        : 0;
    const meshTotal = allMeshSum();
    const labourMesh = meshCols.reduce(
      (s, _, i) => s + attendanceNum(getVal(labourId, `mesh_${i}`)),
      0,
    );
    const meshS =
      meshTotal > 0
        ? (labourMesh / meshTotal) * Number(contract.meshAmount)
        : 0;
    return bedS + papS + meshS;
  };

  const handleSave = async () => {
    if (!selectedContractId) return;
    setSaving(true);
    try {
      for (const labour of labours) {
        const bedVal = getVal(labour.id, "bed");
        await actor?.saveAttendance(
          selectedContractId,
          labour.id,
          { __kind__: "bed", bed: null },
          bedVal,
        );
        const papVal = getVal(labour.id, "paper");
        await actor?.saveAttendance(
          selectedContractId,
          labour.id,
          { __kind__: "paper", paper: null },
          papVal,
        );
        for (let i = 0; i < meshCols.length; i++) {
          const meshVal = getVal(labour.id, `mesh_${i}`);
          await actor?.saveAttendance(
            selectedContractId,
            labour.id,
            { __kind__: "mesh", mesh: BigInt(i) },
            meshVal,
          );
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const addMeshCol = async () => {
    if (!contract) return;
    const newCols = [...meshCols, `Mesh ${meshCols.length + 1}`];
    setMeshCols(newCols);
    await actor?.updateContract(
      contract.id,
      contract.name,
      contract.multiplierValue,
      contract.contractAmount,
      contract.machineExp,
      contract.bedAmount,
      contract.paperAmount,
      newCols,
    );
  };

  const deleteMeshCol = async (idx: number) => {
    if (!contract) return;
    const newCols = meshCols.filter((_, i) => i !== idx);
    setMeshCols(newCols);
    await actor?.updateContract(
      contract.id,
      contract.name,
      contract.multiplierValue,
      contract.contractAmount,
      contract.machineExp,
      contract.bedAmount,
      contract.paperAmount,
      newCols,
    );
  };

  const startRename = (idx: number) => {
    setRenamingCol(idx);
    setRenameVal(meshCols[idx]);
    setTimeout(() => renameRef.current?.focus(), 50);
  };

  const commitRename = async (idx: number) => {
    if (!contract) return;
    const newCols = meshCols.map((c, i) => (i === idx ? renameVal : c));
    setMeshCols(newCols);
    setRenamingCol(null);
    await actor?.updateContract(
      contract.id,
      contract.name,
      contract.multiplierValue,
      contract.contractAmount,
      contract.machineExp,
      contract.bedAmount,
      contract.paperAmount,
      newCols,
    );
  };

  const inputStyle = {
    background: "#1e1e1e",
    border: "1px solid #444",
    color: "#f5f5f5",
    borderRadius: 6,
    padding: "4px 8px",
  };
  const selectStyle = { ...inputStyle, cursor: "pointer", fontSize: 12 };
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
    padding: "6px 8px",
    borderBottom: "1px solid #2a2a2a",
    fontSize: 13,
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-4">
        <h2 className="text-lg font-bold">Attendance</h2>
        <select
          data-ocid="attendance.contract.select"
          value={selectedContractId ? String(selectedContractId) : ""}
          onChange={(e) =>
            setSelectedContractId(
              e.target.value ? BigInt(e.target.value) : null,
            )
          }
          style={{ ...inputStyle, minWidth: 200 }}
        >
          <option value="">-- Select Contract --</option>
          {contracts.map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedContractId && (
        <div style={{ color: "#666" }} className="text-sm">
          Select a contract to view attendance.
        </div>
      )}

      {selectedContractId && contract && (
        <>
          <div className="flex items-center gap-2 mb-3">
            {mode === "edit" && (
              <button
                type="button"
                data-ocid="attendance.addmesh.button"
                onClick={addMeshCol}
                className="text-xs px-3 py-1 rounded"
                style={{ background: "#f97316", color: "#fff" }}
              >
                + Add Mesh Column
              </button>
            )}
            <div className="text-xs" style={{ color: "#888" }}>
              Bed: ₹{Number(contract.bedAmount).toLocaleString()} | Paper: ₹
              {Number(contract.paperAmount).toLocaleString()} | Mesh: ₹
              {Number(contract.meshAmount).toLocaleString()}
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...thStyle,
                      position: "sticky",
                      left: 0,
                      zIndex: 2,
                      background: "#252525",
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      ...thStyle,
                      position: "sticky",
                      left: 40,
                      zIndex: 2,
                      background: "#252525",
                      minWidth: 140,
                    }}
                  >
                    Labour
                  </th>
                  <th style={thStyle}>Bed</th>
                  <th style={thStyle}>Paper</th>
                  {meshCols.map((col, i) => (
                    <th key={col + String(i)} style={thStyle}>
                      <div className="flex items-center gap-1">
                        {renamingCol === i ? (
                          <input
                            ref={renameRef}
                            style={{ ...inputStyle, width: 80 }}
                            value={renameVal}
                            onChange={(e) => setRenameVal(e.target.value)}
                            onBlur={() => commitRename(i)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && commitRename(i)
                            }
                          />
                        ) : (
                          <span>{col}</span>
                        )}
                        {mode === "edit" && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              data-ocid={`attendance.rename_mesh.button.${i + 1}`}
                              onClick={() => startRename(i)}
                              className="text-xs"
                              style={{ color: "#f97316" }}
                              title="Rename"
                            >
                              ✏
                            </button>
                            <button
                              type="button"
                              data-ocid={`attendance.delete_mesh.button.${i + 1}`}
                              onClick={() => deleteMeshCol(i)}
                              className="text-xs"
                              style={{ color: "#f87171" }}
                              title="Delete"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </th>
                  ))}
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Net Salary</th>
                </tr>
              </thead>
              <tbody>
                {labours.map((labour, idx) => {
                  const net = labourNetSalary(labour.id);
                  return (
                    <tr
                      key={String(labour.id)}
                      style={{ background: idx % 2 === 0 ? "#242424" : "#222" }}
                    >
                      <td
                        style={{
                          ...tdStyle,
                          position: "sticky",
                          left: 0,
                          background: "#242424",
                          zIndex: 1,
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          position: "sticky",
                          left: 40,
                          background: "#242424",
                          zIndex: 1,
                          minWidth: 140,
                        }}
                      >
                        {labour.name}
                      </td>
                      {[
                        "bed",
                        "paper",
                        ...meshCols.map((_, i) => `mesh_${i}`),
                      ].map((colKey) => {
                        const val = getVal(labour.id, colKey);
                        return (
                          <td
                            key={colKey}
                            style={{
                              ...tdStyle,
                              background: cellColor(val),
                              padding: "4px 6px",
                            }}
                          >
                            {mode === "edit" ? (
                              <select
                                data-ocid={`attendance.${colKey}.select.${idx + 1}`}
                                style={selectStyle}
                                value={val}
                                onChange={(e) =>
                                  setVal(labour.id, colKey, e.target.value)
                                }
                              >
                                {ATTENDANCE_VALUES.map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                style={{
                                  color:
                                    val === "Present"
                                      ? "#86efac"
                                      : val === "Absent"
                                        ? "#fca5a5"
                                        : "#fcd34d",
                                }}
                              >
                                {val}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td
                        style={{
                          ...tdStyle,
                          color: "#f97316",
                          fontWeight: 600,
                        }}
                      >
                        ₹{net.toFixed(0)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: "#f97316",
                          fontWeight: 600,
                        }}
                      >
                        ₹{net.toFixed(0)}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr style={{ background: "#2a2a2a", fontWeight: 700 }}>
                  <td
                    style={{
                      ...tdStyle,
                      position: "sticky",
                      left: 0,
                      background: "#2a2a2a",
                      zIndex: 1,
                    }}
                    colSpan={2}
                  >
                    Total
                  </td>
                  {["bed", "paper", ...meshCols.map((_, i) => `mesh_${i}`)].map(
                    (colKey) => (
                      <td key={colKey} style={{ ...tdStyle, color: "#f97316" }}>
                        {colSum(colKey).toFixed(2)}
                      </td>
                    ),
                  )}
                  <td style={{ ...tdStyle, color: "#f97316" }}>
                    ₹
                    {labours
                      .reduce((s, l) => s + labourNetSalary(l.id), 0)
                      .toFixed(0)}
                  </td>
                  <td style={{ ...tdStyle, color: "#f97316" }}>
                    ₹
                    {labours
                      .reduce((s, l) => s + labourNetSalary(l.id), 0)
                      .toFixed(0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {mode === "edit" && (
            <button
              type="button"
              data-ocid="attendance.save.button"
              onClick={handleSave}
              disabled={saving}
              className="mt-4 px-5 py-2 rounded-lg font-semibold"
              style={{
                background: "#f97316",
                color: "#fff",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Attendance"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
