import {
  CalendarCheck,
  CheckCircle,
  ChevronLeft,
  CreditCard,
  Download,
  FileText,
  Loader2,
  TrendingDown,
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

const REMINDER_KEY = "attendpay_reminder_date";

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function App() {
  const [mode, setMode] = useState<AppMode>("view");
  const [screen, setScreen] = useState<Screen>("home");
  const [activeTab, setActiveTab] = useState<TabId>("Contracts");
  const [attendanceContractId, setAttendanceContractId] = useState<
    bigint | null
  >(null);
  const [exporting, setExporting] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const { actor } = useActor();

  const handleViewAttendance = (contractId: bigint) => {
    setAttendanceContractId(contractId);
    setActiveTab("Attendance");
  };

  // Export CSV handler
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

  // 6pm reminder check
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

  if (screen === "home") {
    return (
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
              setActiveTab("Contracts");
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
          onClick={() => {
            setMode("edit");
            setScreen("app");
          }}
          className="pb-8 text-xs bg-transparent border-0 cursor-pointer"
          style={{ color: "#FFFFFF" }}
        >
          Welcome
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "#F2F2F2" }}
      >
        {/* 6pm Reminder Banner */}
        {showReminder && (
          <div
            data-ocid="reminder.banner.toast"
            className="flex items-center justify-between px-4 py-3 gap-3 shrink-0 z-50"
            style={{
              background: "#FF7F11",
              borderBottom: "1px solid #E56A00",
            }}
          >
            <span
              className="text-sm font-semibold flex-1"
              style={{ color: "#FFFFFF" }}
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
          <div className="flex items-center gap-3">
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
          </div>
        </div>

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

        <nav
          className="fixed bottom-0 left-0 right-0 flex z-50"
          style={{ background: "#FFFFFF", borderTop: "1px solid #E5E5E5" }}
        >
          {TABS.map((tab) => {
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
    </ErrorBoundary>
  );
}
