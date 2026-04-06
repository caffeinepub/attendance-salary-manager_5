import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AppMode } from "../App";
import type { ActivityLogEntry, Contract } from "../backend.d";
import { useActor } from "../hooks/useActor";

const PAGE_BG = "#f1f3f8";
const CARD_BG = "rgba(255,255,255,0.88)";
const CARD_BORDER = "1px solid rgba(120,80,255,0.14)";
const CARD_SHADOW =
  "0 2px 16px rgba(99,102,241,0.08), 0 1px 4px rgba(0,0,0,0.04)";
const TEXT_PRIMARY = "#1e1b4b";
const TEXT_SECONDARY = "#6b7280";
const GRAD = "linear-gradient(135deg, #6366f1, #8b5cf6)";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

interface Props {
  mode: AppMode;
}

export function SettledTab({ mode }: Props) {
  const { actor } = useActor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = actor as any;

  const [settled, setSettled] = useState<Contract[]>([]);
  const [unsettled, setUnsettled] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<bigint | null>(null);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const load = async () => {
    if (!a) return;
    setLoading(true);
    try {
      const all = (await a.getAllContracts()) ?? [];
      setSettled(all.filter((c: Contract) => c.isSettled));
      setUnsettled(all.filter((c: Contract) => !c.isSettled));
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load captures actor from closure
  useEffect(() => {
    if (a) load();
  }, [actor]);

  const loadActivityLog = async () => {
    if (!a) return;
    setActivityLoading(true);
    try {
      const log = await a.getActivityLog();
      setActivityLog(log ?? []);
    } catch (err) {
      console.error("Failed to load activity log", err);
      setActivityLog([]);
    } finally {
      setActivityLoading(false);
    }
  };

  const toggleActivityLog = () => {
    if (!showActivityLog) {
      loadActivityLog();
    }
    setShowActivityLog((v) => !v);
  };

  const handleSettle = async (c: Contract) => {
    setUnsettled((prev) => prev.filter((x) => x.id !== c.id));
    setSettled((prev) => [{ ...c, isSettled: true }, ...prev]);
    setPendingId(c.id);
    try {
      await a?.settleContract(c.id, new Date().toISOString());
      toast.success(`"${c.name}" marked as settled`);
    } catch (_) {
      setSettled((prev) => prev.filter((x) => x.id !== c.id));
      setUnsettled((prev) => [c, ...prev]);
      toast.error("Failed to settle contract");
    } finally {
      setPendingId(null);
    }
  };

  const handleUnsettle = async (c: Contract) => {
    setSettled((prev) => prev.filter((x) => x.id !== c.id));
    setUnsettled((prev) => [{ ...c, isSettled: false }, ...prev]);
    setPendingId(c.id);
    try {
      await a?.unsettleContract(c.id);
      toast.success(`"${c.name}" moved back to active`);
    } catch (_) {
      setUnsettled((prev) => prev.filter((x) => x.id !== c.id));
      setSettled((prev) => [c, ...prev]);
      toast.error("Failed to unsettle contract");
    } finally {
      setPendingId(null);
    }
  };

  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 700,
    fontSize: 11,
    color: TEXT_SECONDARY,
    background: "rgba(99,102,241,0.06)",
    borderBottom: "1px solid rgba(99,102,241,0.1)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid rgba(99,102,241,0.07)",
    fontSize: 13,
    color: TEXT_PRIMARY,
    verticalAlign: "middle",
  };

  return (
    <div style={{ background: PAGE_BG, minHeight: "100%" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: TEXT_PRIMARY }}>
          Settled Contracts
        </h2>
        <button
          type="button"
          data-ocid="settled.activity_log.button"
          onClick={toggleActivityLog}
          className="text-sm px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95"
          style={{
            background: showActivityLog ? GRAD : "rgba(99,102,241,0.1)",
            color: showActivityLog ? "#fff" : "#6366f1",
            border: showActivityLog ? "none" : "1px solid rgba(99,102,241,0.2)",
            boxShadow: showActivityLog
              ? "0 4px 12px rgba(99,102,241,0.3)"
              : "none",
          }}
        >
          📋 Activity Log
        </button>
      </div>

      {/* Activity Log Section */}
      {showActivityLog && (
        <div
          data-ocid="settled.activity_log.panel"
          className="mb-6 rounded-2xl overflow-hidden"
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            boxShadow: CARD_SHADOW,
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              background: GRAD,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
              Activity Log
            </span>
            {activityLoading && (
              <Loader2
                size={14}
                className="animate-spin"
                style={{ color: "#fff" }}
              />
            )}
          </div>

          {activityLoading ? (
            <div
              data-ocid="settled.activity_log.loading_state"
              style={{
                padding: "24px",
                textAlign: "center",
                color: TEXT_SECONDARY,
                fontSize: 13,
              }}
            >
              Loading activity log...
            </div>
          ) : activityLog.length === 0 ? (
            <div
              data-ocid="settled.activity_log.empty_state"
              style={{
                padding: "24px",
                textAlign: "center",
                color: TEXT_SECONDARY,
                fontSize: 13,
              }}
            >
              No activity recorded yet.
            </div>
          ) : (
            <div
              style={{
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {activityLog.map((entry, i) => (
                <div
                  key={String(entry.contractId)}
                  data-ocid={`settled.activity_log.item.${i + 1}`}
                  style={{
                    background:
                      i % 2 === 0
                        ? "rgba(255,255,255,0.9)"
                        : "rgba(245,247,255,0.8)",
                    border: "1px solid rgba(99,102,241,0.1)",
                    borderRadius: 10,
                    padding: "10px 14px",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: TEXT_PRIMARY,
                      fontSize: 14,
                      marginBottom: 4,
                    }}
                  >
                    {entry.contractName}
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
                      📅 Created: {formatDate(entry.createdAt)}
                    </span>
                    {entry.settledAt && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#6366f1",
                          fontWeight: 600,
                        }}
                      >
                        ✓ Settled: {formatDate(entry.settledAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "edit" && unsettled.length > 0 && (
        <div className="mb-6">
          <div
            className="text-sm font-semibold mb-2"
            style={{ color: TEXT_SECONDARY }}
          >
            Mark a contract as settled:
          </div>
          <div className="flex flex-wrap gap-2">
            {unsettled.map((c, idx) => (
              <button
                type="button"
                key={String(c.id)}
                data-ocid={`settled.mark.button.${idx + 1}`}
                onClick={() => handleSettle(c)}
                disabled={pendingId === c.id}
                className="text-xs px-3 py-2 rounded-xl flex items-center gap-1 font-semibold transition-all active:scale-95"
                style={{
                  background: CARD_BG,
                  border: CARD_BORDER,
                  color: pendingId === c.id ? TEXT_SECONDARY : TEXT_PRIMARY,
                  opacity: pendingId === c.id ? 0.6 : 1,
                  cursor: pendingId === c.id ? "not-allowed" : "pointer",
                  boxShadow: CARD_SHADOW,
                }}
              >
                {pendingId === c.id ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  "✓"
                )}{" "}
                Settle &quot;{c.name}&quot;
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && settled.length === 0 ? (
        <div
          data-ocid="settled.loading_state"
          className="flex items-center gap-2 text-sm"
          style={{ color: TEXT_SECONDARY }}
        >
          <Loader2
            size={15}
            className="animate-spin"
            style={{ color: "#6366f1" }}
          />
          Loading settled contracts…
        </div>
      ) : settled.length === 0 ? (
        <div
          data-ocid="settled.empty_state"
          style={{
            color: TEXT_SECONDARY,
            fontSize: 14,
            background: "rgba(255,255,255,0.8)",
            border: "1px dashed rgba(99,102,241,0.2)",
            borderRadius: 12,
            padding: "32px 20px",
            textAlign: "center",
          }}
        >
          No settled contracts.
        </div>
      ) : (
        <div
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            borderRadius: 16,
            boxShadow: CARD_SHADOW,
            backdropFilter: "blur(10px)",
            overflowX: "auto",
          }}
        >
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Contract Name</th>
                <th style={thStyle}>Contract Amount</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Settled</th>
                {mode === "edit" && <th style={thStyle}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {settled.map((c, i) => (
                <tr
                  key={String(c.id)}
                  data-ocid={`settled.item.${i + 1}`}
                  style={{
                    background:
                      i % 2 === 0
                        ? "rgba(255,255,255,0.9)"
                        : "rgba(245,247,255,0.8)",
                  }}
                >
                  <td style={tdStyle}>{i + 1}</td>
                  <td
                    style={{
                      ...tdStyle,
                      color: TEXT_SECONDARY,
                      textDecoration: "line-through",
                    }}
                  >
                    {c.name}
                  </td>
                  <td style={{ ...tdStyle, color: "#6366f1", fontWeight: 700 }}>
                    ₹{Number(c.contractAmount).toLocaleString()}
                  </td>
                  <td
                    style={{ ...tdStyle, color: TEXT_SECONDARY, fontSize: 12 }}
                  >
                    {c.createdAt ? formatDate(c.createdAt) : "—"}
                  </td>
                  <td style={{ ...tdStyle, color: "#6366f1", fontSize: 12 }}>
                    {c.settledAt ? formatDate(c.settledAt) : "—"}
                  </td>
                  {mode === "edit" && (
                    <td style={tdStyle}>
                      <button
                        type="button"
                        data-ocid={`settled.unsettle.button.${i + 1}`}
                        onClick={() => handleUnsettle(c)}
                        disabled={pendingId === c.id}
                        className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold"
                        style={{
                          background: "rgba(99,102,241,0.08)",
                          color:
                            pendingId === c.id ? TEXT_SECONDARY : "#6366f1",
                          border: "1px solid rgba(99,102,241,0.2)",
                          opacity: pendingId === c.id ? 0.6 : 1,
                          cursor:
                            pendingId === c.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {pendingId === c.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : null}
                        Unsettle
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
