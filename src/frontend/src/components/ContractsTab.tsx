import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AppMode } from "../App";
import type { Contract } from "../backend.d";
import { useActor } from "../hooks/useActor";

const LAST_ATTENDANCE_KEY = "attendpay_last_attendance";

function getTodayWorkingData(): Map<string, { ts: string; count: number }> {
  const result = new Map<string, { ts: string; count: number }>();
  try {
    const raw = localStorage.getItem(LAST_ATTENDANCE_KEY);
    if (!raw) return result;
    const data = JSON.parse(raw) as Record<
      string,
      { ts: string; count: number } | string
    >;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setHours(23, 0, 0, 0);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    for (const [id, val] of Object.entries(data)) {
      const entry = typeof val === "string" ? { ts: val, count: 0 } : val;
      const t = new Date(entry.ts);
      if (t >= todayStart && t <= cutoff) result.set(id, entry);
    }
  } catch (_) {}
  return result;
}

interface Props {
  mode: AppMode;
  onViewAttendance?: (contractId: bigint) => void;
  onGoHome?: () => void;
}

function fmt(n: bigint) {
  return Number(n).toLocaleString();
}

export function ContractsTab({
  mode,
  onViewAttendance,
  onGoHome: _onGoHome,
}: Props) {
  const { actor } = useActor();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [todayWorkingData, setTodayWorkingData] = useState<
    Map<string, { ts: string; count: number }>
  >(() => getTodayWorkingData());
  const [backendWorkingData, setBackendWorkingData] = useState<
    Map<string, { ts: string; count: number }>
  >(new Map());
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [form, setForm] = useState({
    name: "",
    multiplier: "",
    amount: "",
    machineExp: "",
  });
  const [editBed, setEditBed] = useState("");
  const [editPaper, setEditPaper] = useState("");
  const [editingAmounts, setEditingAmounts] = useState(false);
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    multiplier: "",
    amount: "",
    machineExp: "",
    bedOverride: "",
    paperOverride: "",
  });

  const load = async () => {
    if (!actor) return;
    setLoading(true);
    try {
      const [all] = await Promise.all([actor.getAllContracts()]);
      setContracts((all ?? []).filter((c) => !c.isSettled));
      // Load working today from backend for cross-device badge
      try {
        const map = await actor.getWorkingTodayMap();
        const now = new Date();
        const cutoff = new Date(now);
        cutoff.setHours(23, 0, 0, 0);
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const bwd = new Map<string, { ts: string; count: number }>();
        for (const [id, val] of map) {
          const t = new Date(val.ts);
          if (t >= todayStart && t <= cutoff) {
            bwd.set(String(id), { ts: val.ts, count: Number(val.count) });
          }
        }
        setBackendWorkingData(bwd);
        // Refresh localStorage data too
        setTodayWorkingData(getTodayWorkingData());
      } catch (_) {
        // Fall back to localStorage only
        setTodayWorkingData(getTodayWorkingData());
      }
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load captures actor from closure
  useEffect(() => {
    if (actor) load();
  }, [actor]);

  const calcBed = (m: number) => Math.round(11000 * m);
  const calcPaper = (m: number) => Math.round(7000 * m);

  const handleAdd = async () => {
    if (!actor || !form.name.trim()) return;
    const m = Number.parseFloat(form.multiplier) || 0;
    const ca = Number.parseFloat(form.amount) || 0;
    const me = Number.parseFloat(form.machineExp) || 0;
    const bed = calcBed(m);
    const paper = calcPaper(m);
    const mesh = ca - bed - paper - me;

    // Optimistic update: add a placeholder contract immediately
    const tempId = BigInt(-Date.now());
    const optimistic: Contract = {
      id: tempId,
      name: form.name,
      multiplierValue: m,
      contractAmount: BigInt(Math.round(ca)),
      machineExp: BigInt(Math.round(me)),
      bedAmount: BigInt(bed),
      paperAmount: BigInt(paper),
      meshAmount: BigInt(Math.round(mesh)),
      meshColumns: ["Mesh"],
      isSettled: false,
    };
    setContracts((prev) => [optimistic, ...prev]);
    setForm({ name: "", multiplier: "", amount: "", machineExp: "" });
    setShowAdd(false);
    setAdding(true);

    try {
      await actor.createContract(
        form.name,
        m,
        BigInt(Math.round(ca)),
        BigInt(Math.round(me)),
        null,
        null,
        ["Mesh"],
      );
      // Refresh to get real ID
      const all = await actor.getAllContracts();
      setContracts((all ?? []).filter((c) => !c.isSettled));
      toast.success(`Contract "${form.name}" added`);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (c: Contract) => {
    setEditContract(c);
    setEditForm({
      name: c.name,
      multiplier: String(c.multiplierValue),
      amount: String(Number(c.contractAmount)),
      machineExp: String(Number(c.machineExp)),
      bedOverride: String(Number(c.bedAmount)),
      paperOverride: String(Number(c.paperAmount)),
    });
  };

  const handleUpdate = async () => {
    if (!editContract) return;
    setUpdating(true);
    const m = Number.parseFloat(editForm.multiplier) || 0;
    const ca = Number.parseFloat(editForm.amount) || 0;
    const me = Number.parseFloat(editForm.machineExp) || 0;
    const bedO = editForm.bedOverride
      ? BigInt(Math.round(Number.parseFloat(editForm.bedOverride)))
      : null;
    const papO = editForm.paperOverride
      ? BigInt(Math.round(Number.parseFloat(editForm.paperOverride)))
      : null;
    await actor?.updateContract(
      editContract.id,
      editForm.name,
      m,
      BigInt(Math.round(ca)),
      BigInt(Math.round(me)),
      bedO,
      papO,
      editContract.meshColumns,
    );
    toast.success(`Contract "${editForm.name}" updated`);
    setEditContract(null);
    if (selected?.id === editContract.id) {
      const updated = await actor?.getContract(editContract.id);
      setSelected(updated ?? null);
    }
    await load();
    setUpdating(false);
  };

  const handleSaveAmounts = async () => {
    if (!selected) return;
    setUpdating(true);
    const bedO = editBed
      ? BigInt(Math.round(Number.parseFloat(editBed)))
      : null;
    const papO = editPaper
      ? BigInt(Math.round(Number.parseFloat(editPaper)))
      : null;
    await actor?.updateContract(
      selected.id,
      selected.name,
      selected.multiplierValue,
      selected.contractAmount,
      selected.machineExp,
      bedO,
      papO,
      selected.meshColumns,
    );
    const updated = await actor?.getContract(selected.id);
    setSelected(updated ?? null);
    setEditingAmounts(false);
    await load();
    setUpdating(false);
  };

  const inputStyle = {
    background: "#FFFFFF",
    border: "1px solid #E5E5E5",
    color: "#1E293B",
    borderRadius: 6,
    padding: "6px 10px",
    width: "100%",
  };
  const labelStyle = {
    color: "#94A3B8",
    fontSize: 12,
    marginBottom: 2,
    display: "block" as const,
  };

  if (selected && !editContract) {
    const previewBed = Number(selected.bedAmount);
    const previewPaper = Number(selected.paperAmount);
    const previewMesh = Number(selected.meshAmount);
    return (
      <div>
        <button
          type="button"
          data-ocid="contract.back.button"
          onClick={() => setSelected(null)}
          className="mb-4 text-sm flex items-center gap-1"
          style={{ color: "#FF7F11" }}
        >
          ← Back to Contracts
        </button>
        <div
          className="rounded-xl p-6 max-w-xl"
          style={{
            background: "rgba(255,255,255,0.055)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: "#F1F5F9" }}>
              {selected.name}
            </h2>
            {mode === "edit" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  data-ocid="contract.edit.button"
                  onClick={() => openEdit(selected)}
                  className="text-xs px-3 py-1 rounded"
                  style={{
                    background: "transparent",
                    color: "#FF7F11",
                    border: "1px solid rgba(255,127,17,0.6)",
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span style={{ color: "#94A3B8" }}>Contract Amount:</span>
              <br />
              <span className="font-semibold" style={{ color: "#F1F5F9" }}>
                ₹{fmt(selected.contractAmount)}
              </span>
            </div>
            <div>
              <span style={{ color: "#94A3B8" }}>Multiplier:</span>
              <br />
              <span className="font-semibold" style={{ color: "#F1F5F9" }}>
                {selected.multiplierValue}
              </span>
            </div>
            <div>
              <span style={{ color: "#94A3B8" }}>Machine Exp:</span>
              <br />
              <span className="font-semibold" style={{ color: "#F1F5F9" }}>
                ₹{fmt(selected.machineExp)}
              </span>
            </div>
            <div>
              <span style={{ color: "#94A3B8" }}>Mesh Amount:</span>
              <br />
              <span className="font-semibold" style={{ color: "#FF7F11" }}>
                ₹{previewMesh.toLocaleString()}
              </span>
            </div>
          </div>
          <div
            className="mt-4 p-3 rounded-lg"
            style={{ background: "#111827", border: "1px solid #E5E5E5" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-sm font-medium"
                style={{ color: "#FF7F11" }}
              >
                Bed &amp; Paper Amounts
              </span>
              {mode === "edit" && !editingAmounts && (
                <button
                  type="button"
                  data-ocid="contract.editamounts.button"
                  onClick={() => {
                    setEditBed(String(previewBed));
                    setEditPaper(String(previewPaper));
                    setEditingAmounts(true);
                  }}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: "#FF7F11", color: "#fff" }}
                >
                  Edit
                </button>
              )}
            </div>
            {editingAmounts ? (
              <div className="flex flex-col gap-2">
                <div>
                  <span style={labelStyle}>Bed Amount</span>
                  <input
                    style={inputStyle}
                    value={editBed}
                    onChange={(e) => setEditBed(e.target.value)}
                  />
                </div>
                <div>
                  <span style={labelStyle}>Paper Amount</span>
                  <input
                    style={inputStyle}
                    value={editPaper}
                    onChange={(e) => setEditPaper(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    data-ocid="contract.saveamounts.button"
                    onClick={handleSaveAmounts}
                    disabled={updating}
                    className="text-xs px-3 py-1 rounded"
                    style={{
                      background: updating ? "#334155" : "#FF7F11",
                      color: updating ? "#64748B" : "#fff",
                      cursor: updating ? "not-allowed" : "pointer",
                    }}
                  >
                    {updating ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAmounts(false)}
                    className="text-xs px-3 py-1 rounded"
                    style={{
                      background: "#111827",
                      color: "#94A3B8",
                      border: "1px solid #E5E5E5",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span style={{ color: "#94A3B8" }}>Bed:</span>{" "}
                  <span className="font-semibold" style={{ color: "#F1F5F9" }}>
                    ₹{previewBed.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#94A3B8" }}>Paper:</span>{" "}
                  <span className="font-semibold" style={{ color: "#F1F5F9" }}>
                    ₹{previewPaper.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* View Attendance Button */}
          <button
            type="button"
            data-ocid="contract.view_attendance.button"
            onClick={() => onViewAttendance?.(selected.id)}
            className="mt-4 w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg, #1E293B, #334155)",
              color: "#FFFFFF",
              border: "none",
            }}
          >
            <span>📋</span> View Attendance
          </button>
        </div>
      </div>
    );
  }

  if (editContract) {
    const m = Number.parseFloat(editForm.multiplier) || 0;
    const ca = Number.parseFloat(editForm.amount) || 0;
    const me = Number.parseFloat(editForm.machineExp) || 0;
    const bedO = editForm.bedOverride
      ? Number.parseFloat(editForm.bedOverride)
      : calcBed(m);
    const papO = editForm.paperOverride
      ? Number.parseFloat(editForm.paperOverride)
      : calcPaper(m);
    const meshP = ca - bedO - papO - me;
    return (
      <div>
        <button
          type="button"
          onClick={() => setEditContract(null)}
          className="mb-4 text-sm"
          style={{ color: "#FF7F11" }}
        >
          ← Cancel
        </button>
        <div
          className="rounded-xl p-6 max-w-md"
          style={{
            background: "rgba(255,255,255,0.055)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
          }}
        >
          <h2 className="text-lg font-bold mb-4" style={{ color: "#F1F5F9" }}>
            Edit Contract
          </h2>
          <div className="flex flex-col gap-3">
            <div>
              <span style={labelStyle}>Contract Name</span>
              <input
                data-ocid="contract.edit.name.input"
                style={inputStyle}
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div>
              <span style={labelStyle}>Multiplier Value</span>
              <input
                data-ocid="contract.edit.multiplier.input"
                type="number"
                style={inputStyle}
                value={editForm.multiplier}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, multiplier: e.target.value }))
                }
              />
            </div>
            <div>
              <span style={labelStyle}>Contract Amount</span>
              <input
                data-ocid="contract.edit.amount.input"
                type="number"
                style={inputStyle}
                value={editForm.amount}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </div>
            <div>
              <span style={labelStyle}>Machine Exp</span>
              <input
                data-ocid="contract.edit.machineexp.input"
                type="number"
                style={inputStyle}
                value={editForm.machineExp}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, machineExp: e.target.value }))
                }
              />
            </div>
            <div>
              <span style={labelStyle}>
                Bed Amount Override (default: {calcBed(m).toLocaleString()})
              </span>
              <input
                type="number"
                style={inputStyle}
                value={editForm.bedOverride}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, bedOverride: e.target.value }))
                }
              />
            </div>
            <div>
              <span style={labelStyle}>
                Paper Amount Override (default: {calcPaper(m).toLocaleString()})
              </span>
              <input
                type="number"
                style={inputStyle}
                value={editForm.paperOverride}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, paperOverride: e.target.value }))
                }
              />
            </div>
            <div className="p-3 rounded" style={{ background: "#111827" }}>
              <div className="text-xs" style={{ color: "#94A3B8" }}>
                Mesh Amount Preview:{" "}
                <span style={{ color: "#FF7F11" }}>
                  ₹{meshP.toLocaleString()}
                </span>
              </div>
            </div>
            <button
              type="button"
              data-ocid="contract.update.submit.button"
              onClick={handleUpdate}
              disabled={updating}
              className="py-2 rounded font-semibold"
              style={{
                background: updating ? "#334155" : "#FF7F11",
                color: updating ? "#64748B" : "#fff",
                cursor: updating ? "not-allowed" : "pointer",
              }}
            >
              {updating ? "Updating…" : "Update Contract"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2" />
        <h2 className="text-lg font-bold" style={{ color: "#F1F5F9" }}>
          Contracts
        </h2>
        {mode === "edit" && (
          <button
            type="button"
            data-ocid="contract.add.button"
            onClick={() => setShowAdd((v) => !v)}
            className="text-sm px-4 py-2 rounded-lg font-semibold"
            style={{ background: "#FF7F11", color: "#fff" }}
          >
            + Add Contract
          </button>
        )}
      </div>

      {showAdd && mode === "edit" && (
        <div
          className="rounded-xl p-5 mb-4 max-w-md"
          style={{
            background: "rgba(255,255,255,0.055)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
          }}
        >
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "#FF7F11" }}
          >
            New Contract
          </h3>
          <div className="flex flex-col gap-3">
            <div>
              <span style={labelStyle}>Contract Name</span>
              <input
                data-ocid="contract.add.name.input"
                style={inputStyle}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div>
              <span style={labelStyle}>Multiplier Value</span>
              <input
                data-ocid="contract.add.multiplier.input"
                type="number"
                style={inputStyle}
                value={form.multiplier}
                onChange={(e) =>
                  setForm((f) => ({ ...f, multiplier: e.target.value }))
                }
              />
            </div>
            <div>
              <span style={labelStyle}>Contract Amount</span>
              <input
                data-ocid="contract.add.amount.input"
                type="number"
                style={inputStyle}
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </div>
            <div>
              <span style={labelStyle}>Machine Exp</span>
              <input
                data-ocid="contract.add.machineexp.input"
                type="number"
                style={inputStyle}
                value={form.machineExp}
                onChange={(e) =>
                  setForm((f) => ({ ...f, machineExp: e.target.value }))
                }
              />
            </div>
            {form.multiplier && (
              <div
                className="p-3 rounded text-xs"
                style={{ background: "#111827", color: "#94A3B8" }}
              >
                Bed: ₹
                {calcBed(
                  Number.parseFloat(form.multiplier) || 0,
                ).toLocaleString()}{" "}
                &nbsp;| Paper: ₹
                {calcPaper(
                  Number.parseFloat(form.multiplier) || 0,
                ).toLocaleString()}{" "}
                &nbsp;| Mesh: ₹
                {(
                  Number.parseFloat(form.amount || "0") -
                  calcBed(Number.parseFloat(form.multiplier) || 0) -
                  calcPaper(Number.parseFloat(form.multiplier) || 0) -
                  Number.parseFloat(form.machineExp || "0")
                ).toLocaleString()}
              </div>
            )}
            <button
              type="button"
              data-ocid="contract.add.submit.button"
              onClick={handleAdd}
              disabled={adding}
              className="py-2 rounded font-semibold"
              style={{
                background: adding ? "#334155" : "#FF7F11",
                color: adding ? "#64748B" : "#fff",
                cursor: adding ? "not-allowed" : "pointer",
              }}
            >
              {adding ? "Saving…" : "Save Contract"}
            </button>
          </div>
        </div>
      )}

      {loading && contracts.length === 0 ? (
        <div data-ocid="contracts.loading_state" style={{ color: "#94A3B8" }}>
          Loading...
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-ocid="contracts.list">
          {contracts.length === 0 && (
            <div
              data-ocid="contracts.empty_state"
              className="text-sm"
              style={{ color: "#94A3B8" }}
            >
              No contracts yet.
            </div>
          )}
          {contracts.map((c, i) => (
            <button
              type="button"
              key={String(c.id)}
              data-ocid={`contract.item.${i + 1}`}
              className="flex items-center justify-between w-full px-4 py-3 rounded-lg cursor-pointer transition-all text-left"
              style={{
                background: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.1)",
                opacity: c.id < 0n ? 0.6 : 1,
              }}
              onClick={() => c.id >= 0n && setSelected(c)}
            >
              <div className="flex flex-col gap-0.5 items-start">
                <span className="font-medium" style={{ color: "#F1F5F9" }}>
                  {c.name}
                  {c.id < 0n ? " (saving…)" : ""}
                </span>
                {(() => {
                  const localWd = todayWorkingData.get(String(c.id));
                  const backendWd = backendWorkingData.get(String(c.id));
                  // Use whichever has the more recent timestamp
                  let mergedWd: { ts: string; count: number } | undefined;
                  if (localWd && backendWd) {
                    mergedWd =
                      new Date(localWd.ts) >= new Date(backendWd.ts)
                        ? localWd
                        : backendWd;
                  } else {
                    mergedWd = localWd ?? backendWd;
                  }
                  const count = mergedWd?.count;
                  return count && count > 0 ? (
                    <span
                      className="flex items-center gap-1 text-xs font-semibold"
                      style={{
                        color: "#22C55E",
                        background: "rgba(34,197,94,0.12)",
                        border: "1px solid rgba(34,197,94,0.25)",
                        borderRadius: 8,
                        padding: "1px 7px",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#22C55E",
                          display: "inline-block",
                        }}
                      />
                      Working Today · {count} labours
                    </span>
                  ) : null;
                })()}
              </div>
              <span className="text-sm" style={{ color: "#FF7F11" }}>
                ₹{fmt(c.contractAmount)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
