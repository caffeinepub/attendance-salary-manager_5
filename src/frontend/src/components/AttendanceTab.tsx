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
const GRAD = "linear-gradient(135deg, #6366f1, #8b5cf6)";
const PAGE_BG = "#f1f3f8";
const CARD_BG = "rgba(255,255,255,0.88)";
const CARD_BORDER = "1px solid rgba(120,80,255,0.14)";
const CARD_SHADOW =
  "0 2px 16px rgba(99,102,241,0.08), 0 1px 4px rgba(0,0,0,0.04)";
const TEXT_PRIMARY = "#1e1b4b";
const TEXT_SECONDARY = "#6b7280";

function markAttendanceToday(
  contractId: bigint,
  presentCount = 0,
  colKey?: string,
) {
  try {
    const raw = localStorage.getItem(LAST_ATTENDANCE_KEY);
    const data: Record<
      string,
      { ts: string; count: number; colKey?: string } | string
    > = raw ? JSON.parse(raw) : {};
    data[String(contractId)] = {
      ts: new Date().toISOString(),
      count: presentCount,
      ...(colKey ? { colKey } : {}),
    };
    localStorage.setItem(LAST_ATTENDANCE_KEY, JSON.stringify(data));
  } catch (_) {}
}

interface Props {
  mode: AppMode;
  initialContractId?: bigint | null;
  onContractIdConsumed?: () => void;
  onViewModeContractSelected?: (selected: boolean) => void;
  triggerClearViewContract?: number;
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
    bg = "#dcfce7";
    color = "#16a34a";
    label = "Present";
  } else if (val === "Absent") {
    bg = "#fee2e2";
    color = "#dc2626";
    label = "Absent";
  } else {
    bg = "#fef3c7";
    color = "#d97706";
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
        border: `1px solid ${color}33`,
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
        background: "#f3f4f6",
        color: TEXT_SECONDARY,
        fontWeight: 700,
        fontSize: 11,
        borderRadius: 999,
        padding: "2px 9px",
        letterSpacing: "0.03em",
        border: "1px solid #e5e7eb",
      }}
    >
      Holiday
    </span>
  );
}

function getSelectStyle(val: string): React.CSSProperties {
  if (val === "Present") {
    return {
      background: "#dcfce7",
      border: "1.5px solid #16a34a",
      color: "#15803d",
      borderRadius: 8,
      padding: "4px 8px",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 700,
      outline: "none",
    };
  }
  if (val === "Absent") {
    return {
      background: "#fee2e2",
      border: "1.5px solid #dc2626",
      color: "#b91c1c",
      borderRadius: 8,
      padding: "4px 8px",
      fontSize: 12,
      cursor: "pointer",
      fontWeight: 700,
      outline: "none",
    };
  }
  return {
    background: "#fef3c7",
    border: "1.5px solid #d97706",
    color: "#b45309",
    borderRadius: 8,
    padding: "4px 8px",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 700,
    outline: "none",
  };
}

export function AttendanceTab({
  mode,
  initialContractId,
  onContractIdConsumed,
  onViewModeContractSelected,
  triggerClearViewContract,
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
        if (actor) {
          actor
            .recordWorkingToday(
              selectedContractId,
              BigInt(0),
              new Date().toISOString(),
            )
            .catch(() => {});
        }
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only reacts to triggerClearViewContract
  useEffect(() => {
    if (triggerClearViewContract && triggerClearViewContract > 0) {
      setSelectedContractId(null);
      onViewModeContractSelected?.(false);
    }
  }, [triggerClearViewContract]);

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
      const workingCount = labours.filter((l) => {
        const v = l.id === labour.id ? val : getVal(l.id, colKey);
        return v !== "Absent" && v !== "";
      }).length;
      markAttendanceToday(selectedContractId, workingCount, colKey);
      if (actor) {
        actor
          .recordWorkingToday(
            selectedContractId,
            BigInt(workingCount),
            new Date().toISOString(),
          )
          .catch(() => {});
      }
      setDirtyKeys((prev) => {
        const s = new Set(prev);
        s.delete(`${labour.id}_${colKey}`);
        return s;
      });
    } catch (_e) {}
  };

  const handleMarkAttendanceChange = (val: string) => {
    if (labours.length === 0) return;
    const labour = labours[markDialogIndex];
    saveAttendanceSingle(labour, markDialogCol, val);
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

  const TH: React.CSSProperties = {
    padding: "11px 14px",
    textAlign: "left",
    fontWeight: 700,
    fontSize: 11,
    color: TEXT_SECONDARY,
    background: "rgba(99,102,241,0.06)",
    whiteSpace: "nowrap",
    borderBottom: "1px solid rgba(99,102,241,0.1)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  };
  const TD: React.CSSProperties = {
    padding: "8px 14px",
    fontSize: 13,
    color: TEXT_PRIMARY,
    borderBottom: "1px solid rgba(99,102,241,0.07)",
    verticalAlign: "middle",
  };
  const STICKY_BG = "rgba(246,247,252,0.96)";

  return (
    <div style={{ background: PAGE_BG, minHeight: "100%" }}>
      <div
        style={{
          borderLeft: "4px solid #6366f1",
          paddingLeft: 12,
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: TEXT_PRIMARY,
            margin: 0,
          }}
        >
          {mode === "view" && !selectedContractId
            ? "Select Contract"
            : "Attendance List"}
        </h2>
        <p
          style={{
            fontSize: 12,
            color: TEXT_SECONDARY,
            margin: 0,
            marginTop: 2,
          }}
        >
          Track daily attendance and salary calculations
        </p>
      </div>

      {mode === "view" && !selectedContractId ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: TEXT_SECONDARY,
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Select Contract
            </h3>
          </div>
          {contracts.length === 0 && (
            <div
              data-ocid="attendance.empty_state"
              style={{
                background: "rgba(255,255,255,0.8)",
                border: "1px dashed rgba(99,102,241,0.2)",
                borderRadius: 12,
                padding: "32px 20px",
                textAlign: "center",
                color: TEXT_SECONDARY,
                fontSize: 14,
              }}
            >
              No active contracts
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {contracts.map((c) => (
              <button
                type="button"
                key={String(c.id)}
                data-ocid="attendance.contract.card.button"
                onClick={() => {
                  setSelectedContractId(c.id);
                  onViewModeContractSelected?.(true);
                }}
                style={{
                  background: CARD_BG,
                  border: CARD_BORDER,
                  borderRadius: 14,
                  backdropFilter: "blur(10px)",
                  boxShadow: CARD_SHADOW,
                  padding: "14px 16px",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "all 0.15s",
                }}
              >
                <span
                  style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}
                >
                  {c.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : mode === "view" && selectedContractId ? (
        <div>
          {contract && (
            <div style={{ marginBottom: 16, textAlign: "center" }}>
              <h1
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  background: GRAD,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {contract.name}
              </h1>
              <p
                style={{
                  fontSize: 12,
                  color: TEXT_SECONDARY,
                  margin: "4px 0 0 0",
                }}
              >
                Attendance
              </p>
            </div>
          )}
        </div>
      ) : !selectedContractId ? (
        <div className="mb-4">
          <label
            htmlFor="attendance-contract-select"
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: TEXT_SECONDARY,
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
              background: "#ffffff",
              border: "1.5px solid rgba(99,102,241,0.2)",
              color: TEXT_PRIMARY,
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              minWidth: 220,
              outline: "none",
              cursor: "pointer",
              appearance: "auto",
            }}
          >
            <option value="">-- Select Contract --</option>
            {contracts.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
          <div
            data-ocid="attendance.empty_state"
            style={{
              background: "rgba(255,255,255,0.8)",
              border: "1px dashed rgba(99,102,241,0.2)",
              borderRadius: 12,
              padding: "32px 20px",
              textAlign: "center",
              color: TEXT_SECONDARY,
              fontSize: 14,
              marginTop: 12,
            }}
          >
            Select a contract above to view and manage attendance
          </div>
        </div>
      ) : null}

      {mode === "edit" && selectedContractId && (
        <div className="mb-4">
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
              background: "#ffffff",
              border: "1.5px solid rgba(99,102,241,0.2)",
              color: TEXT_PRIMARY,
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              minWidth: 220,
              outline: "none",
              cursor: "pointer",
              appearance: "auto",
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
              { label: "Labours", value: labours.length, color: "#6366f1" },
              { label: "Present Today", value: presentCount, color: "#3b82f6" },
              {
                label: "Bed Pool",
                value: `₹${Number(contract.bedAmount).toLocaleString()}`,
                color: "#7c3aed",
              },
              {
                label: "Paper Pool",
                value: `₹${Number(contract.paperAmount).toLocaleString()}`,
                color: "#0ea5e9",
              },
              ...(mode !== "view"
                ? [
                    {
                      label: "Total Net",
                      value: `₹${totalNet.toFixed(0)}`,
                      color: "#059669",
                    },
                  ]
                : []),
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: CARD_BG,
                  border: CARD_BORDER,
                  borderRadius: 10,
                  padding: "8px 14px",
                  minWidth: 90,
                  boxShadow: CARD_SHADOW,
                  backdropFilter: "blur(8px)",
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
                    fontSize: 15,
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

          {/* Mark Attendance + Add Mesh (edit mode) */}
          {mode === "edit" && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                data-ocid="attendance.mark.open_modal_button"
                onClick={openMarkDialog}
                className="text-sm px-4 py-2 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background: GRAD,
                  color: "#fff",
                  border: "none",
                  boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
                }}
              >
                ✓ Mark Attendance
              </button>
              <button
                type="button"
                data-ocid="attendance.add_mesh.button"
                onClick={addMeshCol}
                className="text-sm px-3 py-2 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background: "rgba(99,102,241,0.1)",
                  color: "#6366f1",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                + Add Column
              </button>
            </div>
          )}

          {/* Attendance table */}
          <div
            style={{
              overflowX: "auto",
              background: CARD_BG,
              border: CARD_BORDER,
              borderRadius: 16,
              boxShadow: CARD_SHADOW,
              backdropFilter: "blur(10px)",
            }}
          >
            <table
              style={{
                borderCollapse: "collapse",
                minWidth: "max-content",
                width: "100%",
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      ...TH,
                      position: "sticky",
                      left: 0,
                      background: "rgba(248,249,255,0.98)",
                      zIndex: 2,
                      borderRadius: "16px 0 0 0",
                      width: 40,
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      ...TH,
                      position: "sticky",
                      left: 40,
                      background: "rgba(248,249,255,0.98)",
                      zIndex: 2,
                      minWidth: 140,
                    }}
                  >
                    Labour
                  </th>
                  <th style={TH}>Bed</th>
                  <th style={TH}>Paper</th>

                  {meshCols.map((col, i) => {
                    const colKey = `mesh_${i}`;
                    const isHoliday = holidays.has(colKey);
                    return (
                      <th key={col + String(i)} style={TH}>
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
                                background: "#fff",
                                border: "1.5px solid #6366f1",
                                color: TEXT_PRIMARY,
                                borderRadius: 6,
                                padding: "2px 6px",
                                width: 80,
                                fontSize: 12,
                                outline: "none",
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
                                background: "#7c3aed",
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
                                  color: "#6366f1",
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
                                  color: "#dc2626",
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

                  <th style={TH}>Total</th>
                  {mode !== "view" && <th style={TH}>Net Salary</th>}
                  {mode !== "view" && <th style={TH}>Note</th>}
                </tr>
              </thead>
              <tbody>
                {labours.map((labour, idx) => {
                  const net = labourNetSalary(labour.id);
                  const rowBg =
                    idx % 2 === 0
                      ? "rgba(255,255,255,0.95)"
                      : "rgba(245,247,255,0.85)";
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
                          background: STICKY_BG,
                          zIndex: 1,
                          fontWeight: 700,
                          color: TEXT_SECONDARY,
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
                          background: STICKY_BG,
                          zIndex: 1,
                          minWidth: 140,
                          fontWeight: 700,
                          color: TEXT_PRIMARY,
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
                          color: "#3b82f6",
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
                            color: "#6366f1",
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
                                  ? "rgba(99,102,241,0.1)"
                                  : "rgba(99,102,241,0.05)",
                                border: `1px solid ${hasNote ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.12)"}`,
                                borderRadius: 6,
                                padding: "4px 6px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                color: hasNote ? "#6366f1" : TEXT_SECONDARY,
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

                {/* Totals row */}
                <tr
                  style={{
                    background: "rgba(243,244,255,0.95)",
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
                          color: holidays.has(colKey)
                            ? TEXT_SECONDARY
                            : "#6366f1",
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
                      color: "#3b82f6",
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
                        color: "#6366f1",
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
                background: saving || dirtyKeys.size === 0 ? "#e5e7eb" : GRAD,
                color: saving || dirtyKeys.size === 0 ? TEXT_SECONDARY : "#fff",
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
                    : "0 4px 16px rgba(99,102,241,0.35)",
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
                style={{ background: GRAD, color: "#fff", border: "none" }}
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
            background: "#ffffff",
          }}
        >
          {/* Header */}
          <div style={{ background: GRAD, padding: "20px 24px 16px" }}>
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
                  background: "rgba(255,255,255,0.2)",
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
            <div style={{ marginTop: 12 }}>
              <label
                htmlFor="mark-col-select"
                style={{
                  display: "block",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.75)",
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
                  background: "rgba(255,255,255,0.2)",
                  border: "1.5px solid rgba(255,255,255,0.35)",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "8px 14px",
                  fontSize: 14,
                  fontWeight: 600,
                  width: "100%",
                  cursor: "pointer",
                  appearance: "auto",
                  outline: "none",
                }}
              >
                {allColKeys.map((ck) => (
                  <option
                    key={ck}
                    value={ck}
                    style={{ background: "#4f46e5", color: "#fff" }}
                  >
                    {allColLabels[ck] ?? ck}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "28px 24px 24px", background: "#ffffff" }}>
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
                    color: "#16a34a",
                    marginBottom: 8,
                  }}
                >
                  All Done!
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: TEXT_SECONDARY,
                    marginBottom: 24,
                  }}
                >
                  Attendance marked for all {labours.length} labours.
                </div>
                <button
                  type="button"
                  data-ocid="attendance.mark.close_button"
                  onClick={() => setMarkDialogOpen(false)}
                  style={{
                    background: GRAD,
                    color: "#fff",
                    border: "none",
                    borderRadius: 999,
                    padding: "12px 36px",
                    fontSize: 16,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(99,102,241,0.35)",
                  }}
                >
                  Close
                </button>
              </div>
            ) : currentMarkLabour ? (
              <>
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 13,
                      color: TEXT_SECONDARY,
                      fontWeight: 600,
                    }}
                  >
                    Labour {markDialogIndex + 1} of {labours.length}
                  </span>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 32,
                    fontWeight: 900,
                    color: TEXT_PRIMARY,
                    lineHeight: 1.15,
                    marginBottom: 16,
                    letterSpacing: "-0.02em",
                    wordBreak: "break-word",
                  }}
                >
                  {currentMarkLabour.name}
                </div>

                {/* Current values summary */}
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
                          color: TEXT_SECONDARY,
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

                <div style={{ marginBottom: 28 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: TEXT_SECONDARY,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: 14,
                      textAlign: "center",
                    }}
                  >
                    Mark as — auto-advances on selection
                  </div>

                  <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                    <button
                      type="button"
                      data-ocid="attendance.mark.present_button"
                      onClick={() => handleMarkAttendanceChange("Present")}
                      style={{
                        flex: 1,
                        padding: "22px 0",
                        fontSize: 22,
                        fontWeight: 900,
                        borderRadius: 16,
                        border:
                          currentMarkVal === "Present"
                            ? "3px solid #16a34a"
                            : "2.5px solid #dcfce7",
                        background:
                          currentMarkVal === "Present" ? "#16a34a" : "#f0fdf4",
                        color:
                          currentMarkVal === "Present" ? "#fff" : "#16a34a",
                        cursor: "pointer",
                        boxShadow:
                          currentMarkVal === "Present"
                            ? "0 4px 18px rgba(22,163,74,0.3)"
                            : "none",
                        transition: "all 0.15s",
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
                        fontSize: 22,
                        fontWeight: 900,
                        borderRadius: 16,
                        border:
                          currentMarkVal === "Absent"
                            ? "3px solid #dc2626"
                            : "2.5px solid #fee2e2",
                        background:
                          currentMarkVal === "Absent" ? "#dc2626" : "#fff5f5",
                        color: currentMarkVal === "Absent" ? "#fff" : "#dc2626",
                        cursor: "pointer",
                        boxShadow:
                          currentMarkVal === "Absent"
                            ? "0 4px 18px rgba(220,38,38,0.3)"
                            : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      ✕ Absent
                    </button>
                  </div>

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
                      border: "1.5px solid rgba(99,102,241,0.2)",
                      background: ["Present", "Absent"].includes(currentMarkVal)
                        ? "#f8fafc"
                        : "#fef3c7",
                      color: ["Present", "Absent"].includes(currentMarkVal)
                        ? TEXT_SECONDARY
                        : "#d97706",
                      cursor: "pointer",
                      appearance: "auto" as const,
                      outline: "none",
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
                      fontSize: 15,
                      fontWeight: 800,
                      borderRadius: 14,
                      border: "1.5px solid rgba(99,102,241,0.2)",
                      background: markDialogIndex === 0 ? "#f3f4f6" : "#fff",
                      color:
                        markDialogIndex === 0 ? TEXT_SECONDARY : TEXT_PRIMARY,
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
                      fontSize: 15,
                      fontWeight: 800,
                      borderRadius: 14,
                      border: "none",
                      background:
                        markDialogIndex >= labours.length - 1
                          ? "#e5e7eb"
                          : GRAD,
                      color: "#fff",
                      cursor:
                        markDialogIndex >= labours.length - 1
                          ? "not-allowed"
                          : "pointer",
                      boxShadow:
                        markDialogIndex >= labours.length - 1
                          ? "none"
                          : "0 4px 14px rgba(99,102,241,0.3)",
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
                  color: TEXT_SECONDARY,
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
