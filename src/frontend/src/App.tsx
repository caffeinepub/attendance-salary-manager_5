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
import { Toaster } from "@/components/ui/sonner";
import {
  CalendarCheck,
  CheckCircle,
  ChevronLeft,
  CreditCard,
  Download,
  Eye,
  FileText,
  HardDrive,
  Home,
  Loader2,
  Lock,
  MoreVertical,
  ShieldCheck,
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
  { id: "Advances", label: "Advances", short: "Advances", icon: TrendingDown },
  { id: "Payments", label: "Payments", short: "Pay", icon: CreditCard },
  { id: "Labours", label: "Labours", short: "Labour", icon: Users },
  { id: "Settled", label: "Settled", short: "Settled", icon: CheckCircle },
] as const;

type TabId = (typeof TABS)[number]["id"] | "Attendance";

const VIEW_ONLY_HIDDEN_TABS: TabId[] = [
  "Contracts",
  "Payments",
  "Settled",
  "Advances",
  "Labours",
];

const REMINDER_KEY = "attendpay_reminder_date";
const REMEMBER_DEVICE_KEY = "attendpay_remember_device";

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

function getTodayWorkingContractId(): bigint | null {
  try {
    const raw = localStorage.getItem("attendpay_last_attendance");
    if (!raw) return null;
    const data: Record<string, string> = JSON.parse(raw);
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(23, 0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    let latestId: string | null = null;
    let latestTime = 0;
    for (const [id, ts] of Object.entries(data)) {
      const t = new Date(ts).getTime();
      if (
        new Date(ts) >= todayStart &&
        new Date(ts) <= cutoff &&
        t > latestTime
      ) {
        latestTime = t;
        latestId = id;
      }
    }
    return latestId ? BigInt(latestId) : null;
  } catch (_) {
    return null;
  }
}

export default function App() {
  const [mode, setMode] = useState<AppMode>("view");
  const [screen, setScreen] = useState<Screen>("home");
  const [homeVisible, setHomeVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("Contracts");
  const [attendanceContractId, setAttendanceContractId] = useState<
    bigint | null
  >(null);
  const [viewModeSelectedContract, setViewModeSelectedContract] =
    useState(false);
  const [triggerClearViewContract, setTriggerClearViewContract] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const { actor } = useActor();
  const [appReady, setAppReady] = useState(false);
  const [appReadyDom, setAppReadyDom] = useState(false);

  // App loading screen
  useEffect(() => {
    if (actor && !appReady) {
      const t = setTimeout(() => {
        setAppReady(true);
        setTimeout(() => setAppReadyDom(true), 600);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [actor, appReady]);

  // Home screen fade-in
  useEffect(() => {
    if (screen === "home") {
      const t = setTimeout(() => setHomeVisible(true), 10);
      return () => clearTimeout(t);
    }
    setHomeVisible(false);
  }, [screen]);

  // Admin credential state
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminDialogMode, setAdminDialogMode] = useState<
    "set" | "enter" | "change"
  >("enter");
  const [adminDialogChecking, setAdminDialogChecking] = useState(false);
  const [adminTokenInput, setAdminTokenInput] = useState("");
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [changeOldToken, setChangeOldToken] = useState("");
  const [changeOldPassword, setChangeOldPassword] = useState("");
  const [changeNewToken, setChangeNewToken] = useState("");
  const [changeNewPassword, setChangeNewPassword] = useState("");

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
    if (screen !== "app") return;
    if (mode === "view" && VIEW_ONLY_HIDDEN_TABS.includes(activeTab)) {
      setActiveTab("Attendance");
    }
  }, [mode, activeTab, screen]);

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
        `Imported ${contractRows.length} contract${
          contractRows.length !== 1 ? "s" : ""
        } and ${labourRows.length} labour${labourRows.length !== 1 ? "s" : ""}`,
      );
    } catch (err) {
      console.error("Import failed:", err);
      setImportResult("Import failed. Please check the file format.");
    } finally {
      setImporting(false);
    }
  };

  // ----------- Admin credential logic -----------
  const handleWelcomeTap = async () => {
    if (!actor) return;
    // Check if device is remembered
    const remembered = localStorage.getItem(REMEMBER_DEVICE_KEY) === "true";
    if (remembered) {
      setMode("edit");
      setScreen("app");
      setActiveTab("Contracts");
      return;
    }
    setAdminTokenInput("");
    setAdminPasswordInput("");
    setAdminPasswordConfirm("");
    setAdminError("");
    setRememberDevice(false);
    // Open dialog immediately with a loading state
    setAdminDialogChecking(true);
    setAdminDialogMode("enter"); // default; will be updated after check
    setShowAdminDialog(true);
    // Check credentials in the background
    try {
      const hasCreds = await actor.hasAdminCredentials();
      setAdminDialogMode(hasCreds ? "enter" : "set");
    } catch {
      setAdminDialogMode("enter");
    } finally {
      setAdminDialogChecking(false);
    }
  };

  const handleAdminSubmit = async () => {
    if (!actor) return;
    setAdminLoading(true);
    setAdminError("");
    try {
      if (adminDialogMode === "set") {
        if (!adminTokenInput.trim()) {
          setAdminError("Username is required.");
          return;
        }
        if (!adminPasswordInput.trim()) {
          setAdminError("Password is required.");
          return;
        }
        if (adminPasswordInput !== adminPasswordConfirm) {
          setAdminError("Passwords do not match.");
          return;
        }
        const ok = await actor.setAdminCredentials(
          adminTokenInput.trim(),
          adminPasswordInput,
        );
        if (ok) {
          setShowAdminDialog(false);
          setMode("edit");
          setScreen("app");
          setActiveTab("Contracts");
        } else {
          setAdminError("Credentials already set. Please log in.");
          setAdminDialogMode("enter");
        }
      } else if (adminDialogMode === "enter") {
        if (!adminTokenInput.trim() || !adminPasswordInput.trim()) {
          setAdminError("Enter username and password.");
          return;
        }
        const ok = await actor.verifyAdminCredentials(
          adminTokenInput.trim(),
          adminPasswordInput,
        );
        if (ok) {
          if (rememberDevice) {
            localStorage.setItem(REMEMBER_DEVICE_KEY, "true");
          }
          setShowAdminDialog(false);
          setMode("edit");
          setScreen("app");
          setActiveTab("Contracts");
        } else {
          setAdminError("Incorrect username or password.");
          setAdminPasswordInput("");
        }
      } else if (adminDialogMode === "change") {
        if (!changeOldToken.trim() || !changeOldPassword.trim()) {
          setAdminError("Enter current username and password.");
          return;
        }
        if (!changeNewToken.trim() || !changeNewPassword.trim()) {
          setAdminError("Enter new username and password.");
          return;
        }
        const ok = await actor.changeAdminCredentials(
          changeOldToken.trim(),
          changeOldPassword,
          changeNewToken.trim(),
          changeNewPassword,
        );
        if (ok) {
          setShowAdminDialog(false);
          setAdminError("");
        } else {
          setAdminError("Current username or password is incorrect.");
        }
      }
    } catch {
      setAdminError("Error communicating with backend.");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleChangeAdminCredentials = () => {
    setChangeOldToken("");
    setChangeOldPassword("");
    setChangeNewToken("");
    setChangeNewPassword("");
    setAdminError("");
    setAdminDialogMode("change");
    setShowAdminDialog(true);
  };

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
        {/* Dark premium background */}
        <div
          className="min-h-screen flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden"
          style={{
            background: "#0B1120",
            opacity: homeVisible ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          {/* Mesh gradient blob — top right */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: "-80px",
              right: "-80px",
              width: "360px",
              height: "360px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,127,17,0.22) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          {/* Mesh gradient blob — bottom left */}
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: "-100px",
              left: "-80px",
              width: "400px",
              height: "400px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,127,17,0.10) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* App branding */}
          <div className="flex flex-col items-center mb-10 z-10">
            {/* Icon with glow halo */}
            <div style={{ position: "relative", marginBottom: "20px" }}>
              {/* Outer glow */}
              <div
                style={{
                  position: "absolute",
                  inset: "-10px",
                  borderRadius: "36px",
                  background:
                    "radial-gradient(circle, rgba(255,127,17,0.4) 0%, transparent 70%)",
                  filter: "blur(14px)",
                }}
              />
              <div
                style={{
                  width: "88px",
                  height: "88px",
                  borderRadius: "28px",
                  background:
                    "linear-gradient(135deg, #FF7F11 0%, #EA580C 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  boxShadow:
                    "0 0 0 1px rgba(255,127,17,0.4), 0 8px 32px rgba(255,127,17,0.45)",
                }}
              >
                <CalendarCheck size={42} color="#FFFFFF" strokeWidth={2.2} />
              </div>
            </div>

            <h1
              style={{
                fontSize: "28px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#FFFFFF",
                textAlign: "center",
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Attendance &amp; Salary
            </h1>
            <p
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#FF7F11",
                margin: "4px 0 0",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Manager
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "rgba(255,255,255,0.38)",
                marginTop: "8px",
                fontWeight: 400,
              }}
            >
              Your workforce, simplified
            </p>
          </div>

          {/* Glassmorphism login card */}
          <div
            className="w-full z-10"
            style={{
              maxWidth: "360px",
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "28px",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              overflow: "hidden",
              boxShadow:
                "0 4px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            {/* Card header */}
            <div
              style={{
                padding: "24px 24px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  margin: 0,
                }}
              >
                Welcome back
              </h2>
              <p
                style={{
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.45)",
                  margin: "4px 0 0",
                }}
              >
                Select how you would like to continue
              </p>
            </div>

            {/* Login buttons */}
            <div
              style={{
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {/* Admin Login — gradient orange */}
              <button
                type="button"
                data-ocid="home.welcome.text"
                onClick={handleWelcomeTap}
                className="w-full transition-all active:scale-95"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "15px 20px",
                  borderRadius: "16px",
                  background:
                    "linear-gradient(135deg, #FF7F11 0%, #EA580C 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  cursor: "pointer",
                  boxShadow:
                    "0 4px 24px rgba(255,127,17,0.5), 0 1px 6px rgba(0,0,0,0.25)",
                  fontFamily: "inherit",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "38px",
                    height: "38px",
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.18)",
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={20} color="#FFFFFF" strokeWidth={2.2} />
                </span>
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    flex: 1,
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      lineHeight: 1.3,
                    }}
                  >
                    Admin Login
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 400,
                      color: "rgba(255,255,255,0.75)",
                      marginTop: "2px",
                    }}
                  >
                    Full access to all features
                  </span>
                </span>
                <Lock size={15} color="rgba(255,255,255,0.7)" />
              </button>

              {/* Divider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    background: "rgba(255,255,255,0.1)",
                  }}
                />
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.25)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  or
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    background: "rgba(255,255,255,0.1)",
                  }}
                />
              </div>

              {/* User Login — ghost outline */}
              <button
                type="button"
                data-ocid="home.view_attendpay.button"
                onClick={() => {
                  const todayContractId = getTodayWorkingContractId();
                  if (todayContractId !== null)
                    setAttendanceContractId(todayContractId);
                  setMode("view");
                  setScreen("app");
                  setActiveTab("Attendance");
                }}
                className="w-full transition-all active:scale-95"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "15px 20px",
                  borderRadius: "16px",
                  background: "transparent",
                  color: "#FFFFFF",
                  border: "1.5px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "38px",
                    height: "38px",
                    borderRadius: "12px",
                    background: "rgba(255,127,17,0.15)",
                    border: "1px solid rgba(255,127,17,0.25)",
                    flexShrink: 0,
                  }}
                >
                  <Eye size={20} color="#FF7F11" strokeWidth={2.2} />
                </span>
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    flex: 1,
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      lineHeight: 1.3,
                    }}
                  >
                    User Login
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 400,
                      color: "rgba(255,255,255,0.45)",
                      marginTop: "2px",
                    }}
                  >
                    View attendance data only
                  </span>
                </span>
              </button>
            </div>

            {/* Card footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.25)",
                  margin: 0,
                }}
              >
                Made with❤️ by Shiv
              </p>
            </div>
          </div>
        </div>

        {/* Admin Login Dialog */}
        <Dialog
          open={showAdminDialog && adminDialogMode !== "change"}
          onOpenChange={(open) => {
            if (!open) setShowAdminDialog(false);
          }}
        >
          <DialogContent data-ocid="admin.dialog">
            <DialogHeader>
              <DialogTitle
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <Lock size={18} style={{ color: "#F97316" }} />
                {adminDialogChecking
                  ? "Admin Login"
                  : adminDialogMode === "set"
                    ? "Create Admin Credentials"
                    : "Admin Login"}
              </DialogTitle>
            </DialogHeader>

            {adminDialogChecking ? (
              <div
                data-ocid="admin.loading_state"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "24px 0",
                  gap: 12,
                }}
              >
                <Loader2
                  size={28}
                  className="animate-spin"
                  style={{ color: "#F97316" }}
                />
                <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
                  Checking...
                </p>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {adminDialogMode === "set" && (
                  <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>
                    First time setup. Create an admin username and password to
                    protect edit mode.
                  </p>
                )}
                <div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#64748B",
                      margin: "0 0 4px",
                    }}
                  >
                    Username
                  </p>
                  <input
                    data-ocid="admin.token.input"
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={adminTokenInput}
                    onChange={(e) => {
                      setAdminTokenInput(e.target.value);
                      setAdminError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleAdminSubmit()}
                    placeholder="Enter username"
                    style={{
                      border: "2px solid #E2E8F0",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 15,
                      outline: "none",
                      width: "100%",
                    }}
                  />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "#64748B",
                      margin: "0 0 4px",
                    }}
                  >
                    Password
                  </p>
                  <input
                    data-ocid="admin.password.input"
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => {
                      setAdminPasswordInput(e.target.value);
                      setAdminError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleAdminSubmit()}
                    placeholder="Enter password"
                    style={{
                      border: "2px solid #E2E8F0",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 15,
                      outline: "none",
                      width: "100%",
                    }}
                  />
                </div>
                {adminDialogMode === "set" && (
                  <div>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#64748B",
                        margin: "0 0 4px",
                      }}
                    >
                      Confirm Password
                    </p>
                    <input
                      data-ocid="admin.password.confirm.input"
                      type="password"
                      value={adminPasswordConfirm}
                      onChange={(e) => {
                        setAdminPasswordConfirm(e.target.value);
                        setAdminError("");
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAdminSubmit()
                      }
                      placeholder="Confirm password"
                      style={{
                        border: "2px solid #E2E8F0",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 15,
                        outline: "none",
                        width: "100%",
                      }}
                    />
                  </div>
                )}
                {adminError && (
                  <p
                    data-ocid="admin.error_state"
                    style={{ color: "#DC2626", fontSize: 13, margin: 0 }}
                  >
                    {adminError}
                  </p>
                )}
                {adminDialogMode === "enter" && (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      color: "#64748B",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      style={{ accentColor: "#F97316", width: 15, height: 15 }}
                    />
                    Remember this device
                  </label>
                )}
              </div>
            )}

            {!adminDialogChecking && (
              <DialogFooter>
                <Button
                  data-ocid="admin.submit_button"
                  onClick={handleAdminSubmit}
                  disabled={adminLoading}
                  style={{
                    background: "linear-gradient(135deg, #F97316, #EA580C)",
                    color: "#fff",
                    border: "none",
                    width: "100%",
                  }}
                >
                  {adminLoading
                    ? "Verifying..."
                    : adminDialogMode === "set"
                      ? "Create & Enter Edit Mode"
                      : "Login"}
                </Button>
              </DialogFooter>
            )}
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
      {/* App Loading Screen */}
      {!appReadyDom && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#0B1120",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: appReady ? 0 : 1,
            transition: "opacity 0.5s ease",
            pointerEvents: appReady ? "none" : "auto",
          }}
        >
          {/* Orange glow blob */}
          <div
            style={{
              position: "absolute",
              top: "-80px",
              right: "-80px",
              width: 360,
              height: 360,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,127,17,0.22) 0%, transparent 70%)",
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          />
          {/* App icon with pulse */}
          <div style={{ position: "relative", marginBottom: 28 }}>
            <div
              style={{
                position: "absolute",
                inset: "-14px",
                borderRadius: "40px",
                background:
                  "radial-gradient(circle, rgba(255,127,17,0.5) 0%, transparent 70%)",
                filter: "blur(18px)",
                animation: "pulse-glow 2s ease-in-out infinite",
              }}
            />
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 30,
                background: "linear-gradient(135deg, #FF7F11 0%, #EA580C 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  "0 0 0 1px rgba(255,127,17,0.4), 0 12px 40px rgba(255,127,17,0.5)",
                position: "relative",
              }}
            >
              <CalendarCheck size={48} color="#FFFFFF" strokeWidth={2.2} />
            </div>
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#FFFFFF",
              margin: 0,
              letterSpacing: "-0.02em",
              textAlign: "center",
            }}
          >
            Attendance &amp; Salary
          </h1>
          <p
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#FF7F11",
              margin: "4px 0 0",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Manager
          </p>
          <div style={{ marginTop: 36 }}>
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: "#FF7F11" }}
            />
          </div>
          <style>
            {
              "@keyframes pulse-glow { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }"
            }
          </style>
        </div>
      )}
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
        style={{ background: "#0B1120", position: "relative" }}
      >
        {/* Orange glow blobs - decorative, matches home screen */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: "-120px",
            right: "-120px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,127,17,0.12) 0%, transparent 70%)",
            filter: "blur(60px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            bottom: "-120px",
            left: "-80px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,127,17,0.07) 0%, transparent 70%)",
            filter: "blur(60px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

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
          style={{
            background: "rgba(255,255,255,0.055)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            position: "relative",
          }}
        >
          {/* Maaya - centered in header */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: 22,
                fontWeight: 900,
                background: "linear-gradient(90deg, #FF7F11, #FBBF24, #FF7F11)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                letterSpacing: "0.04em",
              }}
            >
              Maaya
            </span>
          </div>

          <div className="flex items-center gap-2">
            {mode === "edit" ? (
              activeTab !== "Contracts" ? (
                <button
                  type="button"
                  data-ocid="nav.back.button"
                  onClick={() => setActiveTab("Contracts")}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 transition-all active:scale-95"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  <ChevronLeft size={18} />
                  <span className="text-xs">Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  data-ocid="nav.home.button"
                  onClick={() => {
                    setScreen("home");
                    setMode("view");
                  }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 transition-all active:scale-95"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  <Home size={18} />
                  <span className="text-xs">Home</span>
                </button>
              )
            ) : viewModeSelectedContract ? (
              <button
                type="button"
                data-ocid="nav.back.button"
                onClick={() => {
                  setTriggerClearViewContract((prev) => prev + 1);
                  setViewModeSelectedContract(false);
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1 transition-all active:scale-95"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                <ChevronLeft size={18} />
                <span className="text-xs">Back</span>
              </button>
            ) : (
              <button
                type="button"
                data-ocid="nav.home.button"
                onClick={() => {
                  setScreen("home");
                  setMode("view");
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1 transition-all active:scale-95"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                <Home size={18} />
                <span className="text-xs">Home</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Edit mode menu */}
            {mode === "edit" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-ocid="header.menu.button"
                    className="flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-95"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      color: "rgba(255,255,255,0.6)",
                      border: "1px solid rgba(255,255,255,0.1)",
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
                    data-ocid="header.change_admin.button"
                    onClick={handleChangeAdminCredentials}
                    style={{ gap: 8, cursor: "pointer" }}
                  >
                    <Lock size={14} />
                    Change Admin Password
                  </DropdownMenuItem>
                  {localStorage.getItem(REMEMBER_DEVICE_KEY) === "true" && (
                    <DropdownMenuItem
                      data-ocid="header.forget_device.button"
                      onClick={() => {
                        localStorage.removeItem(REMEMBER_DEVICE_KEY);
                      }}
                      style={{ gap: 8, cursor: "pointer", color: "#EF4444" }}
                    >
                      <X size={14} />
                      Forget This Device
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Main content */}
        <div
          className={`flex-1 overflow-auto p-3 ${mode === "edit" ? "pb-24" : "pb-4"}`}
        >
          {activeTab === "Contracts" && (
            <ContractsTab
              mode={mode}
              onViewAttendance={handleViewAttendance}
              onGoHome={() => {
                setScreen("home");
                setMode("view");
              }}
            />
          )}
          {activeTab === "Attendance" && (
            <AttendanceTab
              mode={mode}
              initialContractId={attendanceContractId}
              onContractIdConsumed={() => setAttendanceContractId(null)}
              onViewModeContractSelected={(selected) =>
                setViewModeSelectedContract(selected)
              }
              triggerClearViewContract={triggerClearViewContract}
            />
          )}
          {activeTab === "Advances" && <AdvancesTab mode={mode} />}
          {activeTab === "Payments" && <PaymentsTab />}
          {activeTab === "Labours" && <LaboursTab mode={mode} />}
          {activeTab === "Settled" && <SettledTab mode={mode} />}
        </div>

        {/* Bottom nav */}
        {mode === "edit" && (
          <nav
            className="fixed bottom-0 left-0 right-0 flex z-50"
            style={{
              background: "rgba(15,23,42,0.92)",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
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
                  style={{
                    color: isActive ? "#FF7F11" : "rgba(255,255,255,0.4)",
                  }}
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
        )}
      </div>

      <Toaster
        position="top-center"
        offset={8}
        toastOptions={{
          style: {
            background: "rgba(15,23,42,0.5)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "white",
          },
        }}
      />

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
          <p style={{ fontSize: 14, color: "#94A3B8" }}>
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
          <p style={{ fontSize: 14, color: "#94A3B8" }}>{importResult}</p>
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

      {/* Change Admin Credentials Dialog */}
      <Dialog
        open={showAdminDialog && adminDialogMode === "change"}
        onOpenChange={(open) => {
          if (!open) setShowAdminDialog(false);
        }}
      >
        <DialogContent data-ocid="admin.change.dialog">
          <DialogHeader>
            <DialogTitle
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Lock size={18} style={{ color: "#F97316" }} />
              Change Admin Credentials
            </DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 4px" }}>
                Current Username
              </p>
              <input
                type="text"
                autoCapitalize="none"
                value={changeOldToken}
                onChange={(e) => {
                  setChangeOldToken(e.target.value);
                  setAdminError("");
                }}
                placeholder="Current username"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 15,
                  outline: "none",
                  width: "100%",
                  color: "#F1F5F9",
                }}
              />
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 4px" }}>
                Current Password
              </p>
              <input
                type="password"
                value={changeOldPassword}
                onChange={(e) => {
                  setChangeOldPassword(e.target.value);
                  setAdminError("");
                }}
                placeholder="Current password"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 15,
                  outline: "none",
                  width: "100%",
                  color: "#F1F5F9",
                }}
              />
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 4px" }}>
                New Username
              </p>
              <input
                type="text"
                autoCapitalize="none"
                value={changeNewToken}
                onChange={(e) => {
                  setChangeNewToken(e.target.value);
                  setAdminError("");
                }}
                placeholder="New username"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 15,
                  outline: "none",
                  width: "100%",
                  color: "#F1F5F9",
                }}
              />
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 4px" }}>
                New Password
              </p>
              <input
                type="password"
                value={changeNewPassword}
                onChange={(e) => {
                  setChangeNewPassword(e.target.value);
                  setAdminError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAdminSubmit()}
                placeholder="New password"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 15,
                  outline: "none",
                  width: "100%",
                  color: "#F1F5F9",
                }}
              />
            </div>
            {adminError && (
              <p
                data-ocid="admin.change.error_state"
                style={{ color: "#DC2626", fontSize: 13, margin: 0 }}
              >
                {adminError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              data-ocid="admin.change.submit_button"
              onClick={handleAdminSubmit}
              disabled={adminLoading}
              style={{
                background: "linear-gradient(135deg, #F97316, #EA580C)",
                color: "#fff",
                border: "none",
                width: "100%",
              }}
            >
              {adminLoading ? "Saving..." : "Change Credentials"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ErrorBoundary>
  );
}
