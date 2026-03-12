import {
  CalendarCheck,
  CheckCircle,
  ChevronLeft,
  CreditCard,
  FileText,
  TrendingDown,
  Users,
} from "lucide-react";
import { useState } from "react";
import { AdvancesTab } from "./components/AdvancesTab";
import { AttendanceTab } from "./components/AttendanceTab";
import { ContractsTab } from "./components/ContractsTab";
import { LaboursTab } from "./components/LaboursTab";
import { PaymentsTab } from "./components/PaymentsTab";
import { SettledTab } from "./components/SettledTab";

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

export default function App() {
  const [mode, setMode] = useState<AppMode>("view");
  const [screen, setScreen] = useState<Screen>("home");
  const [activeTab, setActiveTab] = useState<TabId>("Contracts");

  const visibleTabs = TABS.filter(
    (tab) => !(tab.id === "Settled" && mode === "view"),
  );

  if (screen === "home") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-between relative"
        style={{ background: "#FFFFFF" }}
      >
        {/* Top section */}
        <div className="flex flex-col items-center pt-16 px-6 flex-1 justify-center">
          {/* Logo block */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
            style={{ background: "#FF7F11" }}
          >
            <CalendarCheck size={32} color="#FFFFFF" strokeWidth={2.5} />
          </div>

          {/* App title */}
          <h1
            className="text-2xl font-bold text-center mb-2 tracking-tight"
            style={{ color: "#1F1F1F" }}
          >
            Attendance &amp; Salary
          </h1>
          <p className="text-sm mb-12" style={{ color: "#9E9E9E" }}>
            Manager
          </p>

          {/* View AttendPay button */}
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

        {/* Welcome text at very bottom — tapping opens edit mode */}
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

  // If Settled tab is active but mode is view, redirect to Contracts
  const safeActiveTab =
    activeTab === "Settled" && mode === "view" ? "Contracts" : activeTab;

  // App screen
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#F2F2F2" }}
    >
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
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-3 pb-24">
        {safeActiveTab === "Contracts" && <ContractsTab mode={mode} />}
        {safeActiveTab === "Attendance" && <AttendanceTab mode={mode} />}
        {safeActiveTab === "Advances" && <AdvancesTab mode={mode} />}
        {safeActiveTab === "Payments" && <PaymentsTab />}
        {safeActiveTab === "Labours" && <LaboursTab mode={mode} />}
        {safeActiveTab === "Settled" && <SettledTab mode={mode} />}
      </div>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 flex z-50"
        style={{ background: "#FFFFFF", borderTop: "1px solid #E5E5E5" }}
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = safeActiveTab === tab.id;
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
  );
}
