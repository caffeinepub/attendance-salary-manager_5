import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AppMode } from "../App";
import type { Contract } from "../backend.d";
import { useActor } from "../hooks/useActor";

const _LAST_ATTENDANCE_KEY = "attendpay_last_attendance";

// Design tokens
const GRAD = "linear-gradient(135deg, #6366f1, #8b5cf6)";
const PAGE_BG = "#f1f3f8";
const CARD_BG = "rgba(255,255,255,0.88)";
const CARD_BORDER = "1px solid rgba(120,80,255,0.14)";
const CARD_SHADOW =
  "0 2px 16px rgba(99,102,241,0.08), 0 1px 4px rgba(0,0,0,0.04)";
const TEXT_PRIMARY = "#1e1b4b";
const TEXT_SECONDARY = "#6b7280";

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
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editBed, setEditBed] = useState("");
  const [editPaper, setEditPaper] = useState("");
  const [editingAmounts, setEditingAmounts] = useState(false);
  const [editContract, setEditContract] = useState<Contract | null>(null);

  const [form, setForm] = useState({
    name: "",
    multiplier: "",
    amount: "",
    machineExp: "",
  });
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
      const all = await actor.getAllContracts();
      setContracts((all ?? []).filter((c) => !c.isSettled));
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
    border: "1.5px solid rgba(99,102,241,0.2)",
    color: TEXT_PRIMARY,
    borderRadius: 8,
    padding: "8px 12px",
    width: "100%",
    fontSize: 14,
    outline: "none",
  };
  const labelStyle = {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginBottom: 4,
    display: "block" as const,
    fontWeight: 600,
  };

  if (selected && !editContract) {
    const previewBed = Number(selected.bedAmount);
    const previewPaper = Number(selected.paperAmount);
    const previewMesh = Number(selected.meshAmount);
    return (
      <div style={{ background: PAGE_BG, minHeight: "100%" }}>
        <button
          type="button"
          data-ocid="contract.back.button"
          onClick={() => setSelected(null)}
          className="mb-4 text-sm flex items-center gap-1 font-semibold"
          style={{ color: "#6366f1" }}
        >
          ← Back to Contracts
        </button>
        <div
          className="rounded-2xl p-5 max-w-xl"
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            backdropFilter: "blur(12px)",
            boxShadow: CARD_SHADOW,
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: TEXT_PRIMARY }}>
              {selected.name}
            </h2>
            {mode === "edit" && (
              <button
                type="button"
                data-ocid="contract.edit.button"
                onClick={() => openEdit(selected)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{
                  background: "rgba(99,102,241,0.1)",
                  color: "#6366f1",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                Edit
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.1)",
              }}
            >
              <span
                style={{
                  color: TEXT_SECONDARY,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Contract Amount
              </span>
              <div
                className="font-bold mt-1"
                style={{ color: TEXT_PRIMARY, fontSize: 16 }}
              >
                ₹{fmt(selected.contractAmount)}
              </div>
            </div>
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.1)",
              }}
            >
              <span
                style={{
                  color: TEXT_SECONDARY,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Multiplier
              </span>
              <div
                className="font-bold mt-1"
                style={{ color: TEXT_PRIMARY, fontSize: 16 }}
              >
                {selected.multiplierValue}
              </div>
            </div>
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.1)",
              }}
            >
              <span
                style={{
                  color: TEXT_SECONDARY,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Machine Exp
              </span>
              <div
                className="font-bold mt-1"
                style={{ color: TEXT_PRIMARY, fontSize: 16 }}
              >
                ₹{fmt(selected.machineExp)}
              </div>
            </div>
            <div
              className="rounded-xl p-3"
              style={{
                background: "rgba(139,92,246,0.08)",
                border: "1px solid rgba(139,92,246,0.15)",
              }}
            >
              <span
                style={{
                  color: TEXT_SECONDARY,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Mesh Amount
              </span>
              <div
                className="font-bold mt-1"
                style={{ color: "#7c3aed", fontSize: 16 }}
              >
                ₹{previewMesh.toLocaleString()}
              </div>
            </div>
          </div>
          <div
            className="mt-4 p-4 rounded-xl"
            style={{
              background: "rgba(99,102,241,0.05)",
              border: "1px solid rgba(99,102,241,0.12)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-sm font-semibold"
                style={{ color: "#6366f1" }}
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
                  className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                  style={{ background: GRAD, color: "#fff" }}
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
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    data-ocid="contract.saveamounts.button"
                    onClick={handleSaveAmounts}
                    disabled={updating}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                    style={{
                      background: updating ? "#e5e7eb" : GRAD,
                      color: updating ? TEXT_SECONDARY : "#fff",
                      cursor: updating ? "not-allowed" : "pointer",
                      border: "none",
                    }}
                  >
                    {updating ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAmounts(false)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                    style={{
                      background: "#f3f4f6",
                      color: TEXT_SECONDARY,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                    Bed:
                  </span>{" "}
                  <span
                    className="font-semibold"
                    style={{ color: TEXT_PRIMARY }}
                  >
                    ₹{previewBed.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                    Paper:
                  </span>{" "}
                  <span
                    className="font-semibold"
                    style={{ color: TEXT_PRIMARY }}
                  >
                    ₹{previewPaper.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            data-ocid="contract.view_attendance.button"
            onClick={() => onViewAttendance?.(selected.id)}
            className="mt-4 w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{
              background: GRAD,
              color: "#FFFFFF",
              border: "none",
              boxShadow: "0 4px 14px rgba(99,102,241,0.35)",
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
      <div style={{ background: PAGE_BG, minHeight: "100%" }}>
        <button
          type="button"
          onClick={() => setEditContract(null)}
          className="mb-4 text-sm font-semibold"
          style={{ color: "#6366f1" }}
        >
          ← Cancel
        </button>
        <div
          className="rounded-2xl p-5 max-w-md"
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            backdropFilter: "blur(12px)",
            boxShadow: CARD_SHADOW,
          }}
        >
          <h2
            className="text-lg font-bold mb-4"
            style={{ color: TEXT_PRIMARY }}
          >
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
            <div
              className="p-3 rounded-xl text-xs"
              style={{
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.1)",
              }}
            >
              <span style={{ color: TEXT_SECONDARY }}>
                Mesh Amount Preview:{" "}
              </span>
              <span style={{ color: "#7c3aed", fontWeight: 700 }}>
                ₹{meshP.toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              data-ocid="contract.update.submit.button"
              onClick={handleUpdate}
              disabled={updating}
              className="py-2.5 rounded-xl font-semibold text-sm"
              style={{
                background: updating ? "#e5e7eb" : GRAD,
                color: updating ? TEXT_SECONDARY : "#fff",
                border: "none",
                cursor: updating ? "not-allowed" : "pointer",
                boxShadow: updating
                  ? "none"
                  : "0 4px 14px rgba(99,102,241,0.35)",
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
    <div style={{ background: PAGE_BG, minHeight: "100%" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: TEXT_PRIMARY }}>
          Contracts
        </h2>
        {mode === "edit" && (
          <button
            type="button"
            data-ocid="contract.add.button"
            onClick={() => setShowAdd((v) => !v)}
            className="text-sm px-4 py-2 rounded-xl font-semibold transition-all active:scale-95"
            style={{
              background: GRAD,
              color: "#fff",
              border: "none",
              boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
            }}
          >
            + Add Contract
          </button>
        )}
      </div>

      {showAdd && mode === "edit" && (
        <div
          className="rounded-2xl p-5 mb-4 max-w-md"
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            backdropFilter: "blur(12px)",
            boxShadow: CARD_SHADOW,
          }}
        >
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "#6366f1" }}
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
                className="p-3 rounded-xl text-xs"
                style={{
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.1)",
                  color: TEXT_SECONDARY,
                }}
              >
                Bed: ₹
                {calcBed(
                  Number.parseFloat(form.multiplier) || 0,
                ).toLocaleString()}
                &nbsp;| Paper: ₹
                {calcPaper(
                  Number.parseFloat(form.multiplier) || 0,
                ).toLocaleString()}
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
              className="py-2.5 rounded-xl font-semibold text-sm"
              style={{
                background: adding ? "#e5e7eb" : GRAD,
                color: adding ? TEXT_SECONDARY : "#fff",
                border: "none",
                cursor: adding ? "not-allowed" : "pointer",
                boxShadow: adding ? "none" : "0 4px 14px rgba(99,102,241,0.3)",
              }}
            >
              {adding ? "Saving…" : "Save Contract"}
            </button>
          </div>
        </div>
      )}

      {loading && contracts.length === 0 ? (
        <div
          data-ocid="contracts.loading_state"
          style={{ color: TEXT_SECONDARY, fontSize: 14 }}
        >
          Loading...
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-ocid="contracts.list">
          {contracts.length === 0 && (
            <div
              data-ocid="contracts.empty_state"
              className="text-sm"
              style={{
                background: "rgba(255,255,255,0.8)",
                border: "1px dashed rgba(99,102,241,0.2)",
                borderRadius: 12,
                padding: "32px 20px",
                textAlign: "center",
                color: TEXT_SECONDARY,
              }}
            >
              No contracts yet.
            </div>
          )}
          {[...contracts].map((c, i) => (
            <button
              type="button"
              key={String(c.id)}
              data-ocid={`contract.item.${i + 1}`}
              className="flex items-center justify-between w-full px-4 py-3.5 rounded-2xl cursor-pointer transition-all text-left active:scale-98"
              style={{
                background: CARD_BG,
                border: CARD_BORDER,
                backdropFilter: "blur(10px)",
                boxShadow: CARD_SHADOW,
                opacity: c.id < 0n ? 0.6 : 1,
              }}
              onClick={() => c.id >= 0n && setSelected(c)}
            >
              <div className="flex flex-col gap-0.5 items-start">
                <span
                  className="font-semibold"
                  style={{ color: TEXT_PRIMARY, fontSize: 15 }}
                >
                  {c.name}
                  {c.id < 0n ? " (saving…)" : ""}
                </span>
                <span style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                  Multiplier: {c.multiplierValue}
                </span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span
                  className="font-bold text-sm"
                  style={{
                    background: GRAD,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  ₹{fmt(c.contractAmount)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
