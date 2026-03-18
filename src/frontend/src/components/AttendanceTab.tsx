import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Sun } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { AppMode } from "../App";
import type { AttendanceNote, Contract, Holiday, Labour } from "../backend.d";
import { useActor } from "../hooks/useActor";

interface Props {
  mode: AppMode;
  initialContractId?: bigint | null;
  onContractIdConsumed?: () => void;
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

function BadgeCell({ val }: { val: string }) {
  let bg: string;
  let color: string;
  let label: string;

  if (val === "Present") {
    bg = "#DCFCE7";
    color = "#16A34A";
    label = "Present";
  } else if (val === "Absent") {
    bg = "#FEE2E2";
    color = "#DC2626";
    label = "Absent";
  } else {
    bg = "#FFF7ED";
    color = "#EA580C";
    label = val;
  }

  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color,
        fontWeight: 700,
        fontSize: 11,
        borderRadius: 999,
        padding: "2px 9px",
        letterSpacing: "0.03em",
        border: `1px solid ${color}22`,
      }}
    >
      {label}
    </span>
  );
}

function HolidayBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        background: "#F1F5F9",
        color: "#64748B",
        fontWeight: 700,
        fontSize: 11,
        borderRadius: 999,
        padding: "2px 9px",
        letterSpacing: "0.03em",
        border: "1px solid #CBD5E1",
      }}
    >
      Holiday
    </span>
  );
}

function getSelectStyle(val: string): React.CSSProperties {
  if (val === "Present") {
    return {
      background: "#DCFCE7",
      border: "1.5px solid #16A34A",
      color: "#15803D",
      borderRadius: 8,
      padding: "4px 8px",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 700,
    };
  }
  if (val === "Absent") {
    return {
      background: "#FEE2E2",
      border: "1.5px solid #DC2626",
      color: "#B91C1C",
      borderRadius: 8,
      padding: "4px 8px",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 700,
    };
  }
  return {
    background: "#FFF7ED",
    border: "1.5px solid #EA580C",
    color: "#C2410C",
    borderRadius: 8,
    padding: "4px 8px",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 700,
  };
}

export function AttendanceTab({
  mode,
  initialContractId,
  onContractIdConsumed,
}: Props) {
  const { actor } = useActor();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<bigint | null>(
    null,
  );
  const [contract, setContract] = useState<Contract | null>(null);
  const [attendance, setAttendance] = useState<Map<string, string>>(new Map());
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [meshCols, setMeshCols] = useState<string[]>([]);
  const [renamingCol, setRenamingCol] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  // Notes
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [noteDialogLabourId, setNoteDialogLabourId] = useState<bigint | null>(
    null,
  );
  const [noteDialogText, setNoteDialogText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Holidays
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [togglingHoliday, setTogglingHoliday] = useState<string | null>(null);

  useEffect(() => {
    if (!actor) return;
    actor
      .getAllContracts()
      .then((cs) => setContracts(cs.filter((c) => !c.isSettled)));
    actor.getAllLabours().then(setLabours);
  }, [actor]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: onContractIdConsumed is a stable callback
  useEffect(() => {
    if (initialContractId != null && contracts.length > 0) {
      setSelectedContractId(initialContractId);
      onContractIdConsumed?.();
    }
  }, [initialContractId, contracts.length]);

  useEffect(() => {
    if (!selectedContractId || !actor) return;
    setDirtyKeys(new Set());
    setNotes(new Map());
    setHolidays(new Set());
    Promise.all([
      actor.getContract(selectedContractId),
      actor.getAttendanceByContract(selectedContractId),
      actor.getNotesByContract(selectedContractId),
      actor.getHolidaysByContract(selectedContractId),
    ]).then(([c, records, noteRecords, holidayRecords]) => {
      setContract(c);
      setMeshCols(c.meshColumns);

      const map = new Map<string, string>();
      for (const r of records) {
        const colKey =
          r.columnType.__kind__ === "mesh"
            ? `mesh_${r.columnType.mesh}`
            : r.columnType.__kind__;
        map.set(`${r.labourId}_${colKey}`, r.value);
      }
      setAttendance(map);

      const nMap = new Map<string, string>();
      for (const n of noteRecords) {
        nMap.set(String(n.labourId), n.note);
      }
      setNotes(nMap);

      const hSet = new Set<string>();
      for (const h of holidayRecords) {
        hSet.add(h.columnKey);
      }
      setHolidays(hSet);
    });
  }, [selectedContractId, actor]);

  const getVal = (labourId: bigint, colKey: string) =>
    attendance.get(`${labourId}_${colKey}`) || "Absent";

  const setVal = (labourId: bigint, colKey: string, val: string) => {
    const key = `${labourId}_${colKey}`;
    setAttendance((prev) => new Map(prev).set(key, val));
    setDirtyKeys((prev) => new Set(prev).add(key));
  };

  const colSum = (colKey: string) =>
    labours.reduce((s, l) => s + attendanceNum(getVal(l.id, colKey)), 0);

  const labourNetSalary = (labourId: bigint) => {
    if (!contract) return 0;
    const bedIsHoliday = holidays.has("bed");
    const paperIsHoliday = holidays.has("paper");

    const bedS =
      !bedIsHoliday && colSum("bed") > 0
        ? (attendanceNum(getVal(labourId, "bed")) / colSum("bed")) *
          Number(contract.bedAmount)
        : 0;
    const papS =
      !paperIsHoliday && colSum("paper") > 0
        ? (attendanceNum(getVal(labourId, "paper")) / colSum("paper")) *
          Number(contract.paperAmount)
        : 0;

    const activeMeshKeys = meshCols
      .map((_, i) => `mesh_${i}`)
      .filter((ck) => !holidays.has(ck));
    const meshTotalPool = activeMeshKeys.reduce((s, ck) => s + colSum(ck), 0);
    const labourMeshSum = activeMeshKeys.reduce(
      (s, ck) => s + attendanceNum(getVal(labourId, ck)),
      0,
    );
    const meshS =
      meshTotalPool > 0
        ? (labourMeshSum / meshTotalPool) * Number(contract.meshAmount)
        : 0;

    return bedS + papS + meshS;
  };

  const handleSave = async () => {
    if (!selectedContractId || !actor) return;
    if (dirtyKeys.size === 0) return;
    setSaving(true);
    const keysToSave = new Set(dirtyKeys);
    try {
      const saves: Promise<unknown>[] = [];
      for (const labour of labours) {
        for (const colKey of [
          "bed",
          "paper",
          ...meshCols.map((_, i) => `mesh_${i}`),
        ]) {
          const key = `${labour.id}_${colKey}`;
          if (!keysToSave.has(key)) continue;
          if (colKey === "bed") {
            saves.push(
              actor.saveAttendance(
                selectedContractId,
                labour.id,
                { __kind__: "bed", bed: null },
                getVal(labour.id, "bed"),
              ),
            );
          } else if (colKey === "paper") {
            saves.push(
              actor.saveAttendance(
                selectedContractId,
                labour.id,
                { __kind__: "paper", paper: null },
                getVal(labour.id, "paper"),
              ),
            );
          } else {
            const meshIdx = Number(colKey.replace("mesh_", ""));
            saves.push(
              actor.saveAttendance(
                selectedContractId,
                labour.id,
                { __kind__: "mesh", mesh: BigInt(meshIdx) },
                getVal(labour.id, colKey),
              ),
            );
          }
        }
      }
      await Promise.all(saves);
      setDirtyKeys(new Set());
    } finally {
      setSaving(false);
    }
  };

  const toggleHoliday = async (colKey: string) => {
    if (!selectedContractId || !actor) return;
    setTogglingHoliday(colKey);
    try {
      if (holidays.has(colKey)) {
        await actor.removeHoliday(selectedContractId, colKey);
        setHolidays((prev) => {
          const s = new Set(prev);
          s.delete(colKey);
          return s;
        });
      } else {
        await actor.markHoliday(selectedContractId, colKey);
        setHolidays((prev) => new Set(prev).add(colKey));
      }
    } finally {
      setTogglingHoliday(null);
    }
  };

  const openNoteDialog = (labourId: bigint) => {
    setNoteDialogLabourId(labourId);
    setNoteDialogText(notes.get(String(labourId)) ?? "");
  };

  const handleSaveNote = async () => {
    if (!selectedContractId || !actor || noteDialogLabourId === null) return;
    setSavingNote(true);
    try {
      await actor.saveAttendanceNote(
        selectedContractId,
        noteDialogLabourId,
        noteDialogText,
      );
      setNotes((prev) =>
        new Map(prev).set(String(noteDialogLabourId), noteDialogText),
      );
      setNoteDialogLabourId(null);
    } finally {
      setSavingNote(false);
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

  const totalNet = labours.reduce((s, l) => s + labourNetSalary(l.id), 0);
  const presentCount = labours.filter(
    (l) => getVal(l.id, "bed") === "Present",
  ).length;

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
    padding: "8px 14px",
    fontSize: 13,
    color: "#1E293B",
    borderBottom: "1px solid #E2E8F0",
    verticalAlign: "middle",
  };
  const STICKY_BG_LIGHT = "#EFF6FF";

  return (
    <div>
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
          Attendance List
        </h2>
        <p style={{ fontSize: 12, color: "#64748B", margin: 0, marginTop: 2 }}>
          Track daily attendance and salary calculations
        </p>
      </div>

      <div className="mb-4">
        <label
          htmlFor="attendance-contract-select"
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 700,
            color: "#64748B",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Select Contract
        </label>
        <select
          id="attendance-contract-select"
          data-ocid="attendance.contract.select"
          value={selectedContractId ? String(selectedContractId) : ""}
          onChange={(e) =>
            setSelectedContractId(
              e.target.value ? BigInt(e.target.value) : null,
            )
          }
          style={{
            background: "#FFFFFF",
            border: "2px solid #E2E8F0",
            color: "#0F172A",
            borderRadius: 999,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            minWidth: 220,
            outline: "none",
            cursor: "pointer",
            appearance: "auto",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "#F97316";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#E2E8F0";
          }}
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
        <div
          data-ocid="attendance.empty_state"
          style={{
            background: "#F8FAFC",
            border: "1px dashed #CBD5E1",
            borderRadius: 12,
            padding: "32px 20px",
            textAlign: "center",
            color: "#94A3B8",
            fontSize: 14,
          }}
        >
          Select a contract above to view and manage attendance
        </div>
      )}

      {selectedContractId && contract && (
        <>
          {/* Stats bar */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Labours", value: labours.length, color: "#F97316" },
              { label: "Present Today", value: presentCount, color: "#1D4ED8" },
              {
                label: "Bed Pool",
                value: `₹${Number(contract.bedAmount).toLocaleString()}`,
                color: "#7C3AED",
              },
              {
                label: "Paper Pool",
                value: `₹${Number(contract.paperAmount).toLocaleString()}`,
                color: "#0EA5E9",
              },
              {
                label: "Total Net",
                value: `₹${totalNet.toFixed(0)}`,
                color: "#F97316",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: "8px 14px",
                  minWidth: 100,
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

          {/* Action buttons */}
          <div
            className="flex items-center gap-2 mb-3"
            style={{ flexWrap: "wrap" }}
          >
            {mode === "edit" && (
              <button
                type="button"
                data-ocid="attendance.addmesh.button"
                onClick={addMeshCol}
                style={{
                  background: "linear-gradient(135deg, #F97316, #EA580C)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 999,
                  padding: "7px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(249,115,22,0.35)",
                  letterSpacing: "0.02em",
                }}
              >
                + Add Mesh Column
              </button>
            )}
          </div>

          {/* Table */}
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
                      width: 40,
                      borderRadius: "14px 0 0 0",
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      ...TH_DARK,
                      position: "sticky",
                      left: 40,
                      zIndex: 3,
                      minWidth: 140,
                    }}
                  >
                    Labour
                  </th>

                  {/* Bed column */}
                  <th style={TH_DARK}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <span>Bed</span>
                      {holidays.has("bed") && (
                        <span
                          style={{
                            background: "#F97316",
                            color: "#fff",
                            fontSize: 9,
                            borderRadius: 4,
                            padding: "1px 5px",
                            fontWeight: 700,
                          }}
                        >
                          HOLIDAY
                        </span>
                      )}
                      {mode === "edit" && (
                        <button
                          type="button"
                          data-ocid="attendance.bed.toggle"
                          onClick={() => toggleHoliday("bed")}
                          disabled={togglingHoliday === "bed"}
                          title={
                            holidays.has("bed")
                              ? "Remove holiday"
                              : "Mark as holiday"
                          }
                          style={{
                            background: holidays.has("bed")
                              ? "#F97316"
                              : "rgba(255,255,255,0.15)",
                            border: "none",
                            borderRadius: 4,
                            padding: "2px 4px",
                            cursor: "pointer",
                            lineHeight: 1,
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Sun size={11} />
                        </button>
                      )}
                    </div>
                  </th>

                  {/* Paper column */}
                  <th style={TH_DARK}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <span>Paper</span>
                      {holidays.has("paper") && (
                        <span
                          style={{
                            background: "#F97316",
                            color: "#fff",
                            fontSize: 9,
                            borderRadius: 4,
                            padding: "1px 5px",
                            fontWeight: 700,
                          }}
                        >
                          HOLIDAY
                        </span>
                      )}
                      {mode === "edit" && (
                        <button
                          type="button"
                          data-ocid="attendance.paper.toggle"
                          onClick={() => toggleHoliday("paper")}
                          disabled={togglingHoliday === "paper"}
                          title={
                            holidays.has("paper")
                              ? "Remove holiday"
                              : "Mark as holiday"
                          }
                          style={{
                            background: holidays.has("paper")
                              ? "#F97316"
                              : "rgba(255,255,255,0.15)",
                            border: "none",
                            borderRadius: 4,
                            padding: "2px 4px",
                            cursor: "pointer",
                            lineHeight: 1,
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Sun size={11} />
                        </button>
                      )}
                    </div>
                  </th>

                  {/* Mesh columns */}
                  {meshCols.map((col, i) => {
                    const colKey = `mesh_${i}`;
                    const isHoliday = holidays.has(colKey);
                    return (
                      <th key={col + String(i)} style={TH_DARK}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          {renamingCol === i ? (
                            <input
                              ref={renameRef}
                              style={{
                                background: "#334155",
                                border: "1px solid #F97316",
                                color: "#fff",
                                borderRadius: 6,
                                padding: "2px 6px",
                                width: 80,
                                fontSize: 12,
                              }}
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
                          {isHoliday && (
                            <span
                              style={{
                                background: "#F97316",
                                color: "#fff",
                                fontSize: 9,
                                borderRadius: 4,
                                padding: "1px 5px",
                                fontWeight: 700,
                              }}
                            >
                              HOLIDAY
                            </span>
                          )}
                          {mode === "edit" && (
                            <div style={{ display: "flex", gap: 3 }}>
                              <button
                                type="button"
                                data-ocid={`attendance.rename_mesh.button.${i + 1}`}
                                onClick={() => startRename(i)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#FCD34D",
                                  fontSize: 12,
                                  padding: 0,
                                }}
                                title="Rename"
                              >
                                ✏
                              </button>
                              <button
                                type="button"
                                data-ocid={`attendance.delete_mesh.button.${i + 1}`}
                                onClick={() => deleteMeshCol(i)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#FCA5A5",
                                  fontSize: 12,
                                  padding: 0,
                                }}
                                title="Delete"
                              >
                                ✕
                              </button>
                              <button
                                type="button"
                                data-ocid={`attendance.mesh_holiday.toggle.${i + 1}`}
                                onClick={() => toggleHoliday(colKey)}
                                disabled={togglingHoliday === colKey}
                                title={
                                  isHoliday
                                    ? "Remove holiday"
                                    : "Mark as holiday"
                                }
                                style={{
                                  background: isHoliday
                                    ? "#F97316"
                                    : "rgba(255,255,255,0.15)",
                                  border: "none",
                                  borderRadius: 4,
                                  padding: "2px 4px",
                                  cursor: "pointer",
                                  lineHeight: 1,
                                  color: "#fff",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <Sun size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}

                  <th style={TH_DARK}>Total</th>
                  <th
                    style={{
                      ...TH_DARK,
                      borderRadius: "0 14px 0 0",
                      color: "#FED7AA",
                    }}
                  >
                    Net Salary
                  </th>
                  <th style={{ ...TH_DARK }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {labours.map((labour, idx) => {
                  const net = labourNetSalary(labour.id);
                  const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
                  const hasNote = !!notes.get(String(labour.id));
                  return (
                    <tr
                      key={String(labour.id)}
                      style={{
                        background: rowBg,
                        transition: "background 0.15s",
                      }}
                      data-ocid={`attendance.row.item.${idx + 1}`}
                    >
                      <td
                        style={{
                          ...TD,
                          position: "sticky",
                          left: 0,
                          background: STICKY_BG_LIGHT,
                          zIndex: 1,
                          fontWeight: 700,
                          color: "#64748B",
                          fontSize: 12,
                          width: 40,
                          textAlign: "center",
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td
                        style={{
                          ...TD,
                          position: "sticky",
                          left: 40,
                          background: STICKY_BG_LIGHT,
                          zIndex: 1,
                          minWidth: 140,
                          fontWeight: 700,
                          color: "#0F172A",
                        }}
                      >
                        {labour.name}
                      </td>

                      {[
                        "bed",
                        "paper",
                        ...meshCols.map((_, i) => `mesh_${i}`),
                      ].map((colKey) => {
                        const isHoliday = holidays.has(colKey);
                        const val = getVal(labour.id, colKey);
                        return (
                          <td
                            key={colKey}
                            style={{ ...TD, padding: "6px 10px" }}
                          >
                            {isHoliday ? (
                              <HolidayBadge />
                            ) : mode === "edit" ? (
                              <select
                                data-ocid={`attendance.${colKey}.select.${idx + 1}`}
                                style={getSelectStyle(val)}
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
                              <BadgeCell val={val} />
                            )}
                          </td>
                        );
                      })}

                      <td
                        style={{
                          ...TD,
                          fontWeight: 700,
                          color: "#0EA5E9",
                          fontSize: 13,
                        }}
                      >
                        {[
                          "bed",
                          "paper",
                          ...meshCols.map((_, i) => `mesh_${i}`),
                        ]
                          .filter((ck) => !holidays.has(ck))
                          .reduce(
                            (s, ck) => s + attendanceNum(getVal(labour.id, ck)),
                            0,
                          )
                          .toFixed(2)}
                      </td>
                      <td
                        style={{
                          ...TD,
                          fontWeight: 800,
                          color: "#F97316",
                          fontSize: 14,
                        }}
                      >
                        ₹{net.toFixed(0)}
                      </td>
                      <td style={{ ...TD, padding: "6px 10px" }}>
                        {(mode === "edit" || hasNote) && (
                          <button
                            type="button"
                            data-ocid={`attendance.note.button.${idx + 1}`}
                            onClick={() => openNoteDialog(labour.id)}
                            title={hasNote ? "View/Edit note" : "Add note"}
                            style={{
                              background: hasNote ? "#FFF7ED" : "#F8FAFC",
                              border: `1px solid ${hasNote ? "#F97316" : "#E2E8F0"}`,
                              borderRadius: 6,
                              padding: "4px 6px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              color: hasNote ? "#F97316" : "#94A3B8",
                            }}
                          >
                            <MessageSquare size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

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
                    colSpan={2}
                  >
                    Column Totals
                  </td>
                  {["bed", "paper", ...meshCols.map((_, i) => `mesh_${i}`)].map(
                    (colKey) => (
                      <td
                        key={colKey}
                        style={{
                          ...TD,
                          color: holidays.has(colKey) ? "#475569" : "#F97316",
                          fontWeight: 800,
                          borderBottom: "none",
                        }}
                      >
                        {holidays.has(colKey) ? "—" : colSum(colKey).toFixed(2)}
                      </td>
                    ),
                  )}
                  <td
                    style={{
                      ...TD,
                      color: "#7DD3FC",
                      fontWeight: 800,
                      borderBottom: "none",
                    }}
                  >
                    —
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
                    ₹{totalNet.toFixed(0)}
                  </td>
                  <td style={{ ...TD, borderBottom: "none" }} />
                </tr>
              </tbody>
            </table>
          </div>

          {mode === "edit" && (
            <button
              type="button"
              data-ocid="attendance.save.button"
              onClick={handleSave}
              disabled={saving || dirtyKeys.size === 0}
              style={{
                marginTop: 16,
                background:
                  saving || dirtyKeys.size === 0
                    ? "#CBD5E1"
                    : "linear-gradient(135deg, #F97316, #EA580C)",
                color: saving || dirtyKeys.size === 0 ? "#94A3B8" : "#fff",
                border: "none",
                borderRadius: 999,
                padding: "10px 28px",
                fontSize: 14,
                fontWeight: 800,
                cursor:
                  saving || dirtyKeys.size === 0 ? "not-allowed" : "pointer",
                boxShadow:
                  saving || dirtyKeys.size === 0
                    ? "none"
                    : "0 4px 16px rgba(249,115,22,0.40)",
                letterSpacing: "0.02em",
                transition: "all 0.2s",
              }}
            >
              {saving
                ? "Saving…"
                : dirtyKeys.size === 0
                  ? "No Changes"
                  : `Save ${dirtyKeys.size} Change${dirtyKeys.size > 1 ? "s" : ""}`}
            </button>
          )}
        </>
      )}

      {/* Note Dialog */}
      <Dialog
        open={noteDialogLabourId !== null}
        onOpenChange={(open) => {
          if (!open) setNoteDialogLabourId(null);
        }}
      >
        <DialogContent data-ocid="attendance.note.dialog">
          <DialogHeader>
            <DialogTitle>
              {mode === "edit" ? "Attendance Note" : "Note"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            data-ocid="attendance.note.textarea"
            value={noteDialogText}
            onChange={(e) => setNoteDialogText(e.target.value)}
            placeholder="Type a note for this labour..."
            readOnly={mode === "view"}
            rows={4}
            style={{ resize: "none" }}
          />
          {mode === "edit" && (
            <DialogFooter>
              <Button
                data-ocid="attendance.note.save_button"
                onClick={handleSaveNote}
                disabled={savingNote}
                style={{
                  background: "linear-gradient(135deg, #F97316, #EA580C)",
                  color: "#fff",
                  border: "none",
                }}
              >
                {savingNote ? "Saving…" : "Save Note"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
