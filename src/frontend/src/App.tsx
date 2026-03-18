import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarCheck,
  CheckCircle,
  ChevronLeft,
  CreditCard,
  Download,
  FileText,
  HardDrive,
  Loader2,
  Lock,
  MoreVertical,
  TrendingDown,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import type { Attendance } from "./backend";
import { AdvancesTab } from "./components/AdvancesTab";
import { AttendanceTab } from "./components/AttendanceTab";
import { ContractsTab } from "./components/ContractsTab";
import { LaboursTab } from "./components/LaboursTab";
import { PaymentsTab } from "./components/PaymentsTab";
import { SettledTab } from "./components/SettledTab";
import { useActor } from "./hooks/useActor";
import { buildCsv, downloadCsv } from "./utils/exportCsv";

export type AppMode = "view" | "edit";
type Screen = "home" | "app";

const TABS = [
  { id: "Contracts", label: "Contracts", short: "Contracts", icon: FileText },
  {
    id: "Attendance",
    label: "Attendance",
    short: "Attend",
    icon: CalendarCheck,
  },
  { id: "Advances", label: "Advances", short: "Advances", icon: TrendingDown },
  { id: "Payments", label: "Payments", short: "Pay", icon: CreditCard },
  { id: "Labours", label: "Labours", short: "Labour", icon: Users },
  { id: "Settled", label: "Settled", short: "Settled", icon: CheckCircle },
] as const;

type TabId = (typeof TABS)[number]["id"];

const VIEW_ONLY_HIDDEN_TABS: TabId[] = ["Contracts", "Payments", "Settled"];

const PIN_KEY = "attendpay_pin";
const REMINDER_KEY = "attendpay_reminder_date";

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export default function App() {
  const [mode, setMode] = useState<AppMode>("view");
  const [screen, setScreen] = useState<Screen>("home");
  const [activeTab, setActiveTab] = useState<TabId>("Attendance");
  const [attendanceContractId, setAttendanceContractId] = useState<
    bigint | null
  >(null);
  const [exporting, setExporting] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const { actor } = useActor();

  // PIN state
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinDialogMode, setPinDialogMode] = useState<
    "set" | "enter" | "change"
  >("enter");
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [changePinOld, setChangePinOld] = useState("");
  const [changePinNew, setChangePinNew] = useState("");
  const [changePinConfirm, setChangePinConfirm] = useState("");

  // Backup/Restore/Import state
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleViewAttendance = (contractId: bigint) => {
    setAttendanceContractId(contractId);
    setActiveTab("Attendance");
  };

  useEffect(() => {
    if (mode === "view" && VIEW_ONLY_HIDDEN_TABS.includes(activeTab)) {
      setActiveTab("Attendance");
    }
  }, [mode, activeTab]);

  // ----------- Export CSV -----------
  const handleExport = useCallback(async () => {
    if (!actor || exporting) return;
    setExporting(true);
    try {
      const [contracts, labours] = await Promise.all([
        actor.getAllContracts(),
        actor.getAllLabours(),
      ]);
      const advancesPerContract = await Promise.all(
        contracts.map((c) => actor.getAdvancesByContract(c.id)),
      );
      const allAdvances = advancesPerContract.flat();
      const attendancePerContract = await Promise.all(
        contracts.map((c) => actor.getAttendanceByContract(c.id)),
      );
      const attendanceMap = new Map<bigint, Attendance[]>();
      contracts.forEach((c, i) => {
        attendanceMap.set(c.id, attendancePerContract[i]);
      });
      const csv = buildCsv(contracts, labours, allAdvances, attendanceMap);
      downloadCsv(csv);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [actor, exporting]);

  // ----------- Backup -----------
  const handleBackup = async () => {
    if (!actor || backingUp) return;
    setBackingUp(true);
    try {
      const [contracts, labours, advances] = await Promise.all([
        actor.getAllContracts(),
        actor.getAllLabours(),
        actor.getAllAdvances(),
      ]);
      const attendanceResults = await Promise.all(
        contracts.map((c) => actor.getAttendanceByContract(c.id)),
      );
      const attendanceByContract = contracts.map((c, i) => ({
        contractId: String(c.id),
        contractName: c.name,
        records: attendanceResults[i].map((a) => ({
          labourId: String(a.labourId),
          columnType: a.columnType.__kind__,
          columnMesh:
            a.columnType.__kind__ === "mesh" ? String(a.columnType.mesh) : null,
          value: a.value,
        })),
      }));

      const backup = {
        version: 1,
        date: new Date().toISOString(),
        contracts: contracts.map((c) => ({
          name: c.name,
          multiplierValue: c.multiplierValue,
          contractAmount: String(c.contractAmount),
          machineExp: String(c.machineExp),
          bedAmount: String(c.bedAmount),
          paperAmount: String(c.paperAmount),
          meshAmount: String(c.meshAmount),
          meshColumns: c.meshColumns,
          isSettled: c.isSettled,
        })),
        labours: labours.map((l) => ({ name: l.name, phone: l.phone ?? null })),
        advances: advances.map((a) => ({
          contractId: String(a.contractId),
          labourId: String(a.labourId),
          amount: String(a.amount),
          note: a.note,
        })),
        attendance: attendanceByContract,
      };

      const json = JSON.stringify(backup, null, 2);
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const blob = new Blob([json], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendpay-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Backup failed:", err);
    } finally {
      setBackingUp(false);
    }
  };

  // ----------- Restore -----------
  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Record<
          string,
          unknown
        >;
        setPendingRestoreData(data);
        setShowRestoreConfirm(true);
      } catch {
        alert("Invalid backup file. Please select a valid JSON backup.");
      }
    };
    reader.readAsText(file);
    if (restoreInputRef.current) restoreInputRef.current.value = "";
  };

  const doRestore = async () => {
    if (!actor || !pendingRestoreData) return;
    setRestoring(true);
    setShowRestoreConfirm(false);
    try {
      const contractsList =
        (pendingRestoreData.contracts as Array<Record<string, unknown>>) ?? [];
      const laboursList =
        (pendingRestoreData.labours as Array<Record<string, unknown>>) ?? [];
      await Promise.all(
        contractsList.map((c) =>
          actor.createContract(
            String(c.name),
            Number(c.multiplierValue) || 1,
            BigInt(String(c.contractAmount) || "0"),
            BigInt(String(c.machineExp) || "0"),
            BigInt(String(c.bedAmount) || "0"),
            BigInt(String(c.paperAmount) || "0"),
            (c.meshColumns as string[]) ?? [],
          ),
        ),
      );
      await Promise.all(
        laboursList.map((l) =>
          actor.createLabour(
            String(l.name),
            l.phone ? String(l.phone) : null,
            null,
          ),
        ),
      );
      alert(
        `Restore complete! Added ${contractsList.length} contracts and ${laboursList.length} labours.`,
      );
    } catch (err) {
      console.error("Restore failed:", err);
      alert("Restore failed. Check console for details.");
    } finally {
      setRestoring(false);
      setPendingRestoreData(null);
    }
  };

  // ----------- Import CSV -----------
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = (ev.target?.result as string) ?? "";
      await processImportCsv(text);
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = "";
  };

  const processImportCsv = async (text: string) => {
    if (!actor) return;
    setImporting(true);
    try {
      const lines = text.split("\n");
      let section = "";
      let headerSkipped = false;
      const contractRows: string[][] = [];
      const labourRows: string[][] = [];

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith("=== CONTRACTS")) {
          section = "contracts";
          headerSkipped = false;
          continue;
        }
        if (line.startsWith("=== LABOURS")) {
          section = "labours";
          headerSkipped = false;
          continue;
        }
        if (line.startsWith("===") || line.startsWith("---")) {
          section = "";
          continue;
        }
        if (!line) continue;
        if (!headerSkipped) {
          headerSkipped = true;
          continue;
        }
        const cols = parseCsvLine(line);
        if (section === "contracts" && cols.length >= 8)
          contractRows.push(cols);
        else if (section === "labours" && cols.length >= 2)
          labourRows.push(cols);
      }

      await Promise.all(
        contractRows.map((cols) =>
          actor.createContract(
            cols[1] ?? "Imported Contract",
            Number.parseFloat(cols[7]) || 1,
            BigInt(cols[2] || "0"),
            BigInt(cols[6] || "0"),
            BigInt(cols[3] || "0"),
            BigInt(cols[4] || "0"),
            cols[8] ? cols[8].split(" | ").filter(Boolean) : [],
          ),
        ),
      );
      await Promise.all(
        labourRows.map((cols) =>
          actor.createLabour(
            cols[1] ?? "Imported Labour",
            cols[2] || null,
            null,
          ),
        ),
      );

      setImportResult(
        `Imported ${contractRows.length} contract${contractRows.length !== 1 ? "s" : ""} and ${labourRows.length} labour${labourRows.length !== 1 ? "s" : ""}`,
      );
    } catch (err) {
      console.error("Import failed:", err);
      setImportResult("Import failed. Please check the file format.");
    } finally {
      setImporting(false);
    }
  };

  // ----------- PIN logic -----------
  const handleWelcomeTap = () => {
    const existingPin = localStorage.getItem(PIN_KEY);
    setPinInput("");
    setPinConfirm("");
    setPinError("");
    if (!existingPin) {
      setPinDialogMode("set");
    } else {
      setPinDialogMode("enter");
    }
    setShowPinDialog(true);
  };

  const handlePinSubmit = () => {
    if (pinDialogMode === "set") {
      if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
        setPinError("PIN must be exactly 4 digits.");
        return;
      }
      if (pinInput !== pinConfirm) {
        setPinError("PINs do not match.");
        return;
      }
      localStorage.setItem(PIN_KEY, pinInput);
      setShowPinDialog(false);
      setMode("edit");
      setScreen("app");
    } else if (pinDialogMode === "enter") {
      const stored = localStorage.getItem(PIN_KEY);
      if (pinInput === stored) {
        setShowPinDialog(false);
        setMode("edit");
        setScreen("app");
      } else {
        setPinError("Incorrect PIN. Try again.");
        setPinInput("");
      }
    } else if (pinDialogMode === "change") {
      const stored = localStorage.getItem(PIN_KEY);
      if (changePinOld !== stored) {
        setPinError("Current PIN is incorrect.");
        return;
      }
      if (changePinNew.length !== 4 || !/^\d{4}$/.test(changePinNew)) {
        setPinError("New PIN must be exactly 4 digits.");
        return;
      }
      if (changePinNew !== changePinConfirm) {
        setPinError("New PINs do not match.");
        return;
      }
      localStorage.setItem(PIN_KEY, changePinNew);
      setShowPinDialog(false);
      setPinError("");
    }
  };

  const handleChangePin = () => {
    setPinDialogMode("change");
    setChangePinOld("");
    setChangePinNew("");
    setChangePinConfirm("");
    setPinError("");
    setShowPinDialog(true);
  };

  // ----------- 6pm reminder -----------
  const reminderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  useEffect(() => {
    if (screen !== "app") return;
    const check = () => {
      const now = new Date();
      if (now.getHours() === 18 && now.getMinutes() < 5) {
        const today = getTodayStr();
        const lastReminder = localStorage.getItem(REMINDER_KEY);
        if (lastReminder !== today) {
          setShowReminder(true);
          localStorage.setItem(REMINDER_KEY, today);
        }
      }
    };
    check();
    reminderIntervalRef.current = setInterval(check, 60_000);
    return () => {
      if (reminderIntervalRef.current)
        clearInterval(reminderIntervalRef.current);
    };
  }, [screen]);

  const dismissReminder = () => setShowReminder(false);
  const handleReminderExport = async () => {
    dismissReminder();
    await handleExport();
  };

  // ----------- Home screen -----------
  if (screen === "home") {
    return (
      <>
        <div
          className="min-h-screen flex flex-col items-center justify-between relative"
          style={{ background: "#FFFFFF" }}
        >
          <div className="flex flex-col items-center pt-16 px-6 flex-1 justify-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
              style={{ background: "#FF7F11" }}
            >
              <CalendarCheck size={32} color="#FFFFFF" strokeWidth={2.5} />
            </div>
            <h1
              className="text-2xl font-bold text-center mb-2 tracking-tight"
              style={{ color: "#1F1F1F" }}
            >
              Attendance &amp; Salary
            </h1>
            <p className="text-sm mb-12" style={{ color: "#9E9E9E" }}>
              Manager
            </p>
            <button
              type="button"
              data-ocid="home.view_attendpay.button"
              onClick={() => {
                setMode("view");
                setScreen("app");
                setActiveTab("Attendance");
              }}
              className="px-10 py-4 rounded-2xl font-bold text-lg shadow-xl transition-all active:scale-95 hover:opacity-90"
              style={{ background: "#FF7F11", color: "#FFFFFF" }}
            >
              View AttendPay
            </button>
          </div>
          <button
            type="button"
            data-ocid="home.welcome.text"
            onClick={handleWelcomeTap}
            className="pb-8 text-xs bg-transparent border-0 cursor-pointer"
            style={{ color: "#000000" }}
          >
            Welcome
          </button>
        </div>

        {/* PIN Dialog */}
        <Dialog
          open={showPinDialog}
          onOpenChange={(open) => {
            if (!open) setShowPinDialog(false);
          }}
        >
          <DialogContent data-ocid="pin.dialog">
            <DialogHeader>
              <DialogTitle
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <Lock size={18} style={{ color: "#F97316" }} />
                {pinDialogMode === "set"
                  ? "Set Edit PIN"
                  : pinDialogMode === "change"
                    ? "Change PIN"
                    : "Enter PIN"}
              </DialogTitle>
            </DialogHeader>

            {pinDialogMode === "enter" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
                  Enter your 4-digit PIN to access edit mode.
                </p>
                <input
                  data-ocid="pin.input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                    setPinError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                  placeholder="••••"
                  style={{
                    border: "2px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 24,
                    textAlign: "center",
                    letterSpacing: 8,
                    outline: "none",
                    width: "100%",
                  }}
                />
                {pinError && (
                  <p
                    data-ocid="pin.error_state"
                    style={{ color: "#DC2626", fontSize: 13, margin: 0 }}
                  >
                    {pinError}
                  </p>
                )}
              </div>
            )}

            {pinDialogMode === "set" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
                  No PIN set. Create a 4-digit PIN to protect edit mode.
                </p>
                <input
                  data-ocid="pin.input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                    setPinError("");
                  }}
                  placeholder="New PIN (4 digits)"
                  style={{
                    border: "2px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 24,
                    textAlign: "center",
                    letterSpacing: 8,
                    outline: "none",
                    width: "100%",
                  }}
                />
                <input
                  data-ocid="pin.confirm_input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinConfirm}
                  onChange={(e) => {
                    setPinConfirm(
                      e.target.value.replace(/\D/g, "").slice(0, 4),
                    );
                    setPinError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                  placeholder="Confirm PIN"
                  style={{
                    border: "2px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 24,
                    textAlign: "center",
                    letterSpacing: 8,
                    outline: "none",
                    width: "100%",
                  }}
                />
                {pinError && (
                  <p
                    data-ocid="pin.error_state"
                    style={{ color: "#DC2626", fontSize: 13, margin: 0 }}
                  >
                    {pinError}
                  </p>
                )}
              </div>
            )}

            {pinDialogMode === "change" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={changePinOld}
                  onChange={(e) => {
                    setChangePinOld(
                      e.target.value.replace(/\D/g, "").slice(0, 4),
                    );
                    setPinError("");
                  }}
                  placeholder="Current PIN"
                  style={{
                    border: "2px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 20,
                    textAlign: "center",
                    letterSpacing: 6,
                    outline: "none",
                    width: "100%",
                  }}
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={changePinNew}
                  onChange={(e) => {
                    setChangePinNew(
                      e.target.value.replace(/\D/g, "").slice(0, 4),
                    );
                    setPinError("");
                  }}
                  placeholder="New PIN (4 digits)"
                  style={{
                    border: "2px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 20,
                    textAlign: "center",
                    letterSpacing: 6,
                    outline: "none",
                    width: "100%",
                  }}
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={changePinConfirm}
                  onChange={(e) => {
                    setChangePinConfirm(
                      e.target.value.replace(/\D/g, "").slice(0, 4),
                    );
                    setPinError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
                  placeholder="Confirm New PIN"
                  style={{
                    border: "2px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 20,
                    textAlign: "center",
                    letterSpacing: 6,
                    outline: "none",
                    width: "100%",
                  }}
                />
                {pinError && (
                  <p
                    data-ocid="pin.error_state"
                    style={{ color: "#DC2626", fontSize: 13, margin: 0 }}
                  >
                    {pinError}
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                data-ocid="pin.submit_button"
                onClick={handlePinSubmit}
                style={{
                  background: "linear-gradient(135deg, #F97316, #EA580C)",
                  color: "#fff",
                  border: "none",
                  width: "100%",
                }}
              >
                {pinDialogMode === "set"
                  ? "Set PIN"
                  : pinDialogMode === "change"
                    ? "Change PIN"
                    : "Enter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const visibleTabs =
    mode === "view"
      ? TABS.filter((t) => !VIEW_ONLY_HIDDEN_TABS.includes(t.id))
      : TABS;

  return (
    <ErrorBoundary>
      {/* Hidden file inputs */}
      <input
        ref={restoreInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleRestoreFileSelect}
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={handleImportFileSelect}
      />

      <div
        className="min-h-screen flex flex-col"
        style={{ background: "#F2F2F2" }}
      >
        {/* 6pm Reminder Banner */}
        {showReminder && (
          <div
            data-ocid="reminder.banner.toast"
            className="flex items-center justify-between px-4 py-3 gap-3 shrink-0 z-50"
            style={{ background: "#FF7F11", borderBottom: "1px solid #E56A00" }}
          >
            <span
              className="text-sm font-semibold flex-1"
              style={{ color: "#000000" }}
            >
              It&apos;s 6 PM — time to export your daily data!
            </span>
            <button
              type="button"
              data-ocid="reminder.export.button"
              onClick={handleReminderExport}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-95"
              style={{ background: "#FFFFFF", color: "#FF7F11" }}
            >
              <Download size={13} />
              Export Now
            </button>
            <button
              type="button"
              data-ocid="reminder.close.button"
              onClick={dismissReminder}
              className="flex items-center justify-center w-7 h-7 rounded-full transition-all active:scale-95"
              style={{ background: "rgba(255,255,255,0.2)", color: "#FFFFFF" }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-3 shrink-0"
          style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E5E5" }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-ocid="nav.home.button"
              onClick={() => setScreen("home")}
              className="flex items-center gap-1 rounded-lg px-2 py-1 transition-all active:scale-95"
              style={{ color: "#9E9E9E" }}
            >
              <ChevronLeft size={18} />
              <span className="text-xs">Home</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: mode === "edit" ? "#FF7F11" : "#9E9E9E" }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: mode === "edit" ? "#FF7F11" : "#9E9E9E" }}
              >
                {mode === "edit" ? "Edit Mode" : "View Mode"}
              </span>
            </div>

            {/* Export CSV */}
            <button
              type="button"
              data-ocid="header.export_csv.button"
              onClick={handleExport}
              disabled={exporting || !actor}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: "#FFF3E8",
                color: "#FF7F11",
                border: "1px solid #FFD4A8",
              }}
              title="Export CSV"
            >
              {exporting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
            </button>

            {/* Edit mode menu */}
            {mode === "edit" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-ocid="header.menu.button"
                    className="flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-95"
                    style={{
                      background: "#F8FAFC",
                      color: "#64748B",
                      border: "1px solid #E2E8F0",
                    }}
                    title="More options"
                  >
                    <MoreVertical size={15} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  data-ocid="header.dropdown_menu"
                >
                  <DropdownMenuItem
                    data-ocid="header.backup.button"
                    onClick={handleBackup}
                    disabled={backingUp || !actor}
                    style={{ gap: 8, cursor: "pointer" }}
                  >
                    {backingUp ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <HardDrive size={14} />
                    )}
                    {backingUp ? "Backing up…" : "Backup Data"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-ocid="header.restore.button"
                    onClick={() => restoreInputRef.current?.click()}
                    disabled={restoring}
                    style={{ gap: 8, cursor: "pointer" }}
                  >
                    {restoring ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    {restoring ? "Restoring…" : "Restore Backup"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-ocid="header.import_csv.button"
                    onClick={() => importInputRef.current?.click()}
                    disabled={importing}
                    style={{ gap: 8, cursor: "pointer" }}
                  >
                    {importing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <FileText size={14} />
                    )}
                    {importing ? "Importing…" : "Import CSV"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-ocid="header.change_pin.button"
                    onClick={handleChangePin}
                    style={{ gap: 8, cursor: "pointer" }}
                  >
                    <Lock size={14} />
                    Change PIN
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-3 pb-24">
          {activeTab === "Contracts" && (
            <ContractsTab mode={mode} onViewAttendance={handleViewAttendance} />
          )}
          {activeTab === "Attendance" && (
            <AttendanceTab
              mode={mode}
              initialContractId={attendanceContractId}
              onContractIdConsumed={() => setAttendanceContractId(null)}
            />
          )}
          {activeTab === "Advances" && <AdvancesTab mode={mode} />}
          {activeTab === "Payments" && <PaymentsTab />}
          {activeTab === "Labours" && <LaboursTab mode={mode} />}
          {activeTab === "Settled" && <SettledTab mode={mode} />}
        </div>

        {/* Bottom nav */}
        <nav
          className="fixed bottom-0 left-0 right-0 flex z-50"
          style={{ background: "#FFFFFF", borderTop: "1px solid #E5E5E5" }}
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                data-ocid={`nav.${tab.id.toLowerCase()}.tab`}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all active:scale-95"
                style={{ color: isActive ? "#FF7F11" : "#9E9E9E" }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span
                  className="text-xs leading-tight"
                  style={{
                    fontWeight: isActive ? 600 : 400,
                    fontSize: "0.6rem",
                  }}
                >
                  {tab.short}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Restore Confirm Dialog */}
      <Dialog
        open={showRestoreConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setShowRestoreConfirm(false);
            setPendingRestoreData(null);
          }
        }}
      >
        <DialogContent data-ocid="restore.dialog">
          <DialogHeader>
            <DialogTitle>Restore Backup?</DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: 14, color: "#475569" }}>
            This will add all contracts and labours from the backup file on top
            of your existing data.
            {pendingRestoreData && " Contracts: "}
            {pendingRestoreData &&
              ((pendingRestoreData.contracts as unknown[]) ?? []).length}
            {pendingRestoreData && ", Labours: "}
            {pendingRestoreData &&
              ((pendingRestoreData.labours as unknown[]) ?? []).length}
            .
          </p>
          <DialogFooter style={{ gap: 8 }}>
            <Button
              data-ocid="restore.cancel_button"
              variant="outline"
              onClick={() => {
                setShowRestoreConfirm(false);
                setPendingRestoreData(null);
              }}
            >
              Cancel
            </Button>
            <Button
              data-ocid="restore.confirm_button"
              onClick={doRestore}
              style={{
                background: "linear-gradient(135deg, #F97316, #EA580C)",
                color: "#fff",
                border: "none",
              }}
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Result Dialog */}
      <Dialog
        open={importResult !== null}
        onOpenChange={(open) => {
          if (!open) setImportResult(null);
        }}
      >
        <DialogContent data-ocid="import.dialog">
          <DialogHeader>
            <DialogTitle>Import Complete</DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: 14, color: "#475569" }}>{importResult}</p>
          <DialogFooter>
            <Button
              data-ocid="import.close_button"
              onClick={() => setImportResult(null)}
              style={{
                background: "linear-gradient(135deg, #F97316, #EA580C)",
                color: "#fff",
                border: "none",
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change PIN dialog (when accessed from within app) */}
      <Dialog
        open={showPinDialog && pinDialogMode === "change"}
        onOpenChange={(open) => {
          if (!open) setShowPinDialog(false);
        }}
      >
        <DialogContent data-ocid="pin.change.dialog">
          <DialogHeader>
            <DialogTitle
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Lock size={18} style={{ color: "#F97316" }} />
              Change PIN
            </DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={changePinOld}
              onChange={(e) => {
                setChangePinOld(e.target.value.replace(/\D/g, "").slice(0, 4));
                setPinError("");
              }}
              placeholder="Current PIN"
              style={{
                border: "2px solid #E2E8F0",
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 20,
                textAlign: "center",
                letterSpacing: 6,
                outline: "none",
                width: "100%",
              }}
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={changePinNew}
              onChange={(e) => {
                setChangePinNew(e.target.value.replace(/\D/g, "").slice(0, 4));
                setPinError("");
              }}
              placeholder="New PIN (4 digits)"
              style={{
                border: "2px solid #E2E8F0",
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 20,
                textAlign: "center",
                letterSpacing: 6,
                outline: "none",
                width: "100%",
              }}
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={changePinConfirm}
              onChange={(e) => {
                setChangePinConfirm(
                  e.target.value.replace(/\D/g, "").slice(0, 4),
                );
                setPinError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
              placeholder="Confirm New PIN"
              style={{
                border: "2px solid #E2E8F0",
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 20,
                textAlign: "center",
                letterSpacing: 6,
                outline: "none",
                width: "100%",
              }}
            />
            {pinError && (
              <p
                data-ocid="pin.error_state"
                style={{ color: "#DC2626", fontSize: 13, margin: 0 }}
              >
                {pinError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              data-ocid="pin.change.submit_button"
              onClick={handlePinSubmit}
              style={{
                background: "linear-gradient(135deg, #F97316, #EA580C)",
                color: "#fff",
                border: "none",
                width: "100%",
              }}
            >
              Change PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}
