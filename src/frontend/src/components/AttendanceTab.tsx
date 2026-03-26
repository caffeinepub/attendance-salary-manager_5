import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AppMode } from "../App";
import type { Contract, Labour } from "../backend.d";
import { useActor } from "../hooks/useActor";

const LAST_ATTENDANCE_KEY = "attendpay_last_attendance";

function markAttendanceToday(contractId: bigint) {
  try {
    const raw = localStorage.getItem(LAST_ATTENDANCE_KEY);
    const data: Record<string, string> = raw ? JSON.parse(raw) : {};
    data[String(contractId)] = new Date().toISOString();
    localStorage.setItem(LAST_ATTENDANCE_KEY, JSON.stringify(data));
  } catch (_) {}
}

interface Props {
  mode: AppMode;
  initialContractId?: bigint | null;
  onContractIdConsumed?: () => void;
}

const ATTENDANCE_VALUES = [
  "Present",
  "Absent",
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

// getLargeSelectStyle removed - replaced by Present/Absent buttons in dialog

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
  const [_togglingHoliday, setTogglingHoliday] = useState<string | null>(null);

  // Mark Attendance Dialog
  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  const [markDialogIndex, setMarkDialogIndex] = useState(0);
  const [markDialogCol, setMarkDialogCol] = useState("bed");
  const [markDone, setMarkDone] = useState(false);

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
      if (saves.length > 0) {
        markAttendanceToday(selectedContractId);
        toast.success("Attendance saved");
      }
    } finally {
      setSaving(false);
    }
  };

  const _toggleHoliday = async (colKey: string) => {
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

  // Mark Attendance Dialog helpers
  const allColKeys = ["bed", "paper", ...meshCols.map((_, i) => `mesh_${i}`)];
  const allColLabels: Record<string, string> = {
    bed: "Bed",
    paper: "Paper",
    ...Object.fromEntries(meshCols.map((name, i) => [`mesh_${i}`, name])),
  };

  const openMarkDialog = () => {
    setMarkDialogIndex(0);
    setMarkDialogCol("bed");
    setMarkDone(false);
    setMarkDialogOpen(true);
  };

  const saveAttendanceSingle = async (
    labour: Labour,
    colKey: string,
    val: string,
  ) => {
    if (!selectedContractId || !actor) return;
    setVal(labour.id, colKey, val);
    try {
      if (colKey === "bed") {
        await actor.saveAttendance(
          selectedContractId,
          labour.id,
          { __kind__: "bed", bed: null },
          val,
        );
        markAttendanceToday(selectedContractId);
      } else if (colKey === "paper") {
        await actor.saveAttendance(
          selectedContractId,
          labour.id,
          { __kind__: "paper", paper: null },
          val,
        );
      } else {
        const meshIdx = Number(colKey.replace("mesh_", ""));
        await actor.saveAttendance(
          selectedContractId,
          labour.id,
          { __kind__: "mesh", mesh: BigInt(meshIdx) },
          val,
        );
      }
      // remove from dirty after save
      setDirtyKeys((prev) => {
        const s = new Set(prev);
        s.delete(`${labour.id}_${colKey}`);
        return s;
      });
    } catch (_e) {
      // keep dirty if save failed
    }
  };

  const handleMarkAttendanceChange = (val: string) => {
    if (labours.length === 0) return;
    const labour = labours[markDialogIndex];
    // Fire-and-forget: save in background, advance immediately
    saveAttendanceSingle(labour, markDialogCol, val);
    // Auto-advance instantly without waiting for backend
    if (markDialogIndex < labours.length - 1) {
      setMarkDialogIndex((prev) => prev + 1);
    } else {
      setMarkDone(true);
    }
  };

  const currentMarkLabour = labours[markDialogIndex] ?? null;
  const currentMarkVal = currentMarkLabour
    ? getVal(currentMarkLabour.id, markDialogCol)
    : "Present";

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
    color: "#F1F5F9",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    verticalAlign: "middle",
  };
  const STICKY_BG_LIGHT = "#0F1C2E";

  // Suppress unused variable warning for toggleHoliday - it's still used for data consistency

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
          style={{ fontSize: 20, fontWeight: 800, color: "#F1F5F9", margin: 0 }}
        >
          Attendance List
        </h2>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: 0, marginTop: 2 }}>
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
            color: "#94A3B8",
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
            background: "rgba(255,255,255,0.07)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            color: "#F1F5F9",
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
            e.target.style.borderColor = "#FF7F11";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(255,255,255,0.15)";
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
            background: "rgba(255,255,255,0.04)",
            border: "1px dashed rgba(255,255,255,0.15)",
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
              { label: "Present Today", value: presentCount, color: "#60A5FA" },
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
              ...(mode !== "view"
                ? [
                    {
                      label: "Total Net",
                      value: `₹${totalNet.toFixed(0)}`,
                      color: "#F97316",
                    },
                  ]
                : []),
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "#111827",
                  border: "1px solid rgba(255,255,255,0.1)",
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
              <>
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
                <button
                  type="button"
                  data-ocid="attendance.mark.open_modal_button"
                  onClick={openMarkDialog}
                  style={{
                    background: "linear-gradient(135deg, #1E293B, #0F172A)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 999,
                    padding: "7px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(15,23,42,0.30)",
                    letterSpacing: "0.02em",
                  }}
                >
                  ✓ Mark Attendance
                </button>
              </>
            )}
          </div>

          {/* Table */}
          <div
            style={{
              overflowX: "auto",
              borderRadius: 14,
              boxShadow:
                "0 4px 24px rgba(255,127,17,0.08), 0 0 60px rgba(255,127,17,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
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
                            </div>
                          )}
                        </div>
                      </th>
                    );
                  })}

                  <th style={TH_DARK}>Total</th>
                  {mode !== "view" && (
                    <th
                      style={{
                        ...TH_DARK,
                        borderRadius: "0 14px 0 0",
                        color: "#FED7AA",
                      }}
                    >
                      Net Salary
                    </th>
                  )}
                  {mode !== "view" && <th style={{ ...TH_DARK }}>Note</th>}
                </tr>
              </thead>
              <tbody>
                {labours.map((labour, idx) => {
                  const net = labourNetSalary(labour.id);
                  const rowBg = idx % 2 === 0 ? "#111827" : "#0D1626";
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
                          color: "#F1F5F9",
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
                          color: "#7DD3FC",
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
                      {mode !== "view" && (
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
                      )}
                      {mode !== "view" && (
                        <td style={{ ...TD, padding: "6px 10px" }}>
                          {(mode === "edit" || hasNote) && (
                            <button
                              type="button"
                              data-ocid={`attendance.note.button.${idx + 1}`}
                              onClick={() => openNoteDialog(labour.id)}
                              title={hasNote ? "View/Edit note" : "Add note"}
                              style={{
                                background: hasNote
                                  ? "rgba(255,127,17,0.15)"
                                  : "rgba(255,255,255,0.06)",
                                border: `1px solid ${hasNote ? "#FF7F11" : "rgba(255,255,255,0.1)"}`,
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
                      )}
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
                  {mode !== "view" && (
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
                  )}
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
                color:
                  saving || dirtyKeys.size === 0
                    ? "rgba(255,255,255,0.3)"
                    : "#fff",
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

      {/* Mark Attendance Dialog */}
      <Dialog
        open={markDialogOpen}
        onOpenChange={(open) => {
          if (!open) setMarkDialogOpen(false);
        }}
      >
        <DialogContent
          data-ocid="attendance.mark.dialog"
          style={{
            maxWidth: 480,
            width: "95vw",
            padding: 0,
            overflow: "hidden",
            borderRadius: 20,
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #1E293B, #0F172A)",
              padding: "20px 24px 16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 800,
                  margin: 0,
                }}
              >
                Mark Attendance
              </h2>
              <button
                type="button"
                data-ocid="attendance.mark.close_button"
                onClick={() => setMarkDialogOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 16,
                  padding: "4px 10px",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            {/* Column selector */}
            <div style={{ marginTop: 12 }}>
              <label
                htmlFor="mark-col-select"
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#94A3B8",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                Column
              </label>
              <select
                id="mark-col-select"
                data-ocid="attendance.mark.col.select"
                value={markDialogCol}
                onChange={(e) => setMarkDialogCol(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1.5px solid rgba(255,255,255,0.25)",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "8px 14px",
                  fontSize: 14,
                  fontWeight: 600,
                  width: "100%",
                  cursor: "pointer",
                  appearance: "auto",
                }}
              >
                {allColKeys.map((ck) => (
                  <option
                    key={ck}
                    value={ck}
                    style={{ background: "#1E293B", color: "#fff" }}
                  >
                    {allColLabels[ck] ?? ck}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "28px 24px 24px" }}>
            {markDone ? (
              <div
                data-ocid="attendance.mark.success_state"
                style={{ textAlign: "center", padding: "24px 0" }}
              >
                <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#16A34A",
                    marginBottom: 8,
                  }}
                >
                  All Done!
                </div>
                <div
                  style={{ fontSize: 14, color: "#64748B", marginBottom: 24 }}
                >
                  Attendance marked for all {labours.length} labours.
                </div>
                <button
                  type="button"
                  data-ocid="attendance.mark.close_button"
                  onClick={() => setMarkDialogOpen(false)}
                  style={{
                    background: "linear-gradient(135deg, #F97316, #EA580C)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 999,
                    padding: "12px 36px",
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(249,115,22,0.35)",
                  }}
                >
                  Close
                </button>
              </div>
            ) : currentMarkLabour ? (
              <>
                {/* Labour counter */}
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <span
                    style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}
                  >
                    Labour {markDialogIndex + 1} of {labours.length}
                  </span>
                </div>

                {/* Labour name */}
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 32,
                    fontWeight: 900,
                    color: "#F1F5F9",
                    lineHeight: 1.15,
                    marginBottom: 16,
                    letterSpacing: "-0.02em",
                    wordBreak: "break-word",
                  }}
                >
                  {currentMarkLabour.name}
                </div>

                {/* Current values for all columns */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    justifyContent: "center",
                    marginBottom: 24,
                  }}
                >
                  {allColKeys.map((ck) => (
                    <div
                      key={ck}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          color: "#94A3B8",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {allColLabels[ck] ?? ck}
                      </span>
                      <BadgeCell val={getVal(currentMarkLabour.id, ck)} />
                    </div>
                  ))}
                </div>

                {/* Attendance select */}
                <div style={{ marginBottom: 28 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#64748B",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: 14,
                      textAlign: "center",
                    }}
                  >
                    Mark as — auto-advances on selection
                  </div>

                  {/* Large Present / Absent buttons */}
                  <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                    <button
                      type="button"
                      data-ocid="attendance.mark.present_button"
                      onClick={() => handleMarkAttendanceChange("Present")}
                      style={{
                        flex: 1,
                        padding: "22px 0",
                        fontSize: 24,
                        fontWeight: 900,
                        borderRadius: 16,
                        border:
                          currentMarkVal === "Present"
                            ? "3px solid #16A34A"
                            : "2.5px solid #DCFCE7",
                        background:
                          currentMarkVal === "Present" ? "#16A34A" : "#F0FDF4",
                        color:
                          currentMarkVal === "Present" ? "#fff" : "#16A34A",
                        cursor: "pointer",
                        boxShadow:
                          currentMarkVal === "Present"
                            ? "0 4px 18px rgba(22,163,74,0.35)"
                            : "none",
                        transition: "all 0.15s",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      ✓ Present
                    </button>
                    <button
                      type="button"
                      data-ocid="attendance.mark.absent_button"
                      onClick={() => handleMarkAttendanceChange("Absent")}
                      style={{
                        flex: 1,
                        padding: "22px 0",
                        fontSize: 24,
                        fontWeight: 900,
                        borderRadius: 16,
                        border:
                          currentMarkVal === "Absent"
                            ? "3px solid #DC2626"
                            : "2.5px solid #FEE2E2",
                        background:
                          currentMarkVal === "Absent" ? "#DC2626" : "#FFF5F5",
                        color: currentMarkVal === "Absent" ? "#fff" : "#DC2626",
                        cursor: "pointer",
                        boxShadow:
                          currentMarkVal === "Absent"
                            ? "0 4px 18px rgba(220,38,38,0.35)"
                            : "none",
                        transition: "all 0.15s",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      ✕ Absent
                    </button>
                  </div>

                  {/* Other values dropdown */}
                  <select
                    id="mark-value-select"
                    data-ocid="attendance.mark.value.select"
                    value={
                      ["Present", "Absent"].includes(currentMarkVal)
                        ? ""
                        : currentMarkVal
                    }
                    onChange={(e) => {
                      if (e.target.value)
                        handleMarkAttendanceChange(e.target.value);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                      borderRadius: 12,
                      border: "2px solid #E2E8F0",
                      background: ["Present", "Absent"].includes(currentMarkVal)
                        ? "#F8FAFC"
                        : "#FFF7ED",
                      color: ["Present", "Absent"].includes(currentMarkVal)
                        ? "#94A3B8"
                        : "#EA580C",
                      cursor: "pointer",
                      appearance: "auto" as const,
                    }}
                  >
                    <option value="">Other values...</option>
                    {ATTENDANCE_VALUES.filter(
                      (v) => v !== "Present" && v !== "Absent",
                    ).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Prev / Next */}
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    type="button"
                    data-ocid="attendance.mark.pagination_prev"
                    disabled={markDialogIndex === 0}
                    onClick={() =>
                      setMarkDialogIndex((prev) => Math.max(0, prev - 1))
                    }
                    style={{
                      flex: 1,
                      padding: "14px 0",
                      fontSize: 16,
                      fontWeight: 800,
                      borderRadius: 14,
                      border: "2px solid #E2E8F0",
                      background: markDialogIndex === 0 ? "#F8FAFC" : "#fff",
                      color: markDialogIndex === 0 ? "#CBD5E1" : "#1E293B",
                      cursor: markDialogIndex === 0 ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    data-ocid="attendance.mark.pagination_next"
                    disabled={markDialogIndex >= labours.length - 1}
                    onClick={() =>
                      setMarkDialogIndex((prev) =>
                        Math.min(labours.length - 1, prev + 1),
                      )
                    }
                    style={{
                      flex: 1,
                      padding: "14px 0",
                      fontSize: 16,
                      fontWeight: 800,
                      borderRadius: 14,
                      border: "2px solid #E2E8F0",
                      background:
                        markDialogIndex >= labours.length - 1
                          ? "#F8FAFC"
                          : "#fff",
                      color:
                        markDialogIndex >= labours.length - 1
                          ? "#CBD5E1"
                          : "#1E293B",
                      cursor:
                        markDialogIndex >= labours.length - 1
                          ? "not-allowed"
                          : "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    Next →
                  </button>
                </div>
              </>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  color: "#94A3B8",
                  padding: "24px 0",
                }}
              >
                No labours found. Add labours to mark attendance.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
