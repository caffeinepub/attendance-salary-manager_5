import { useEffect, useState } from "react";
import type { AppMode } from "../App";
import type { Contract } from "../backend.d";
import { useActor } from "../hooks/useActor";

interface Props {
  mode: AppMode;
}

function fmt(n: bigint) {
  return Number(n).toLocaleString();
}

export function ContractsTab({ mode }: Props) {
  const { actor } = useActor();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);

  // form state
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
    const m = Number.parseFloat(form.multiplier) || 0;
    const ca = Number.parseFloat(form.amount) || 0;
    const me = Number.parseFloat(form.machineExp) || 0;
    await actor?.createContract(
      form.name,
      m,
      BigInt(Math.round(ca)),
      BigInt(Math.round(me)),
      null,
      null,
      ["Mesh"],
    );
    setForm({ name: "", multiplier: "", amount: "", machineExp: "" });
    setShowAdd(false);
    await load();
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
    setEditContract(null);
    if (selected?.id === editContract.id) {
      const updated = await actor?.getContract(editContract.id);
      setSelected(updated ?? null);
    }
    await load();
  };

  const handleSaveAmounts = async () => {
    if (!selected) return;
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
  };

  const inputStyle = {
    background: "#FFFFFF",
    border: "1px solid #E5E5E5",
    color: "#1F1F1F",
    borderRadius: 6,
    padding: "6px 10px",
    width: "100%",
  };
  const labelStyle = {
    color: "#9E9E9E",
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
          style={{ background: "#FFFFFF", border: "1px solid #E5E5E5" }}
        >
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: "#1F1F1F" }}>
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
                    background: "#FFFFFF",
                    color: "#FF7F11",
                    border: "1px solid #FF7F11",
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span style={{ color: "#9E9E9E" }}>Contract Amount:</span>
              <br />
              <span className="font-semibold" style={{ color: "#1F1F1F" }}>
                ₹{fmt(selected.contractAmount)}
              </span>
            </div>
            <div>
              <span style={{ color: "#9E9E9E" }}>Multiplier:</span>
              <br />
              <span className="font-semibold" style={{ color: "#1F1F1F" }}>
                {selected.multiplierValue}
              </span>
            </div>
            <div>
              <span style={{ color: "#9E9E9E" }}>Machine Exp:</span>
              <br />
              <span className="font-semibold" style={{ color: "#1F1F1F" }}>
                ₹{fmt(selected.machineExp)}
              </span>
            </div>
            <div>
              <span style={{ color: "#9E9E9E" }}>Mesh Amount:</span>
              <br />
              <span className="font-semibold" style={{ color: "#FF7F11" }}>
                ₹{previewMesh.toLocaleString()}
              </span>
            </div>
          </div>
          <div
            className="mt-4 p-3 rounded-lg"
            style={{ background: "#F2F2F2", border: "1px solid #E5E5E5" }}
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
                    className="text-xs px-3 py-1 rounded"
                    style={{ background: "#FF7F11", color: "#fff" }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingAmounts(false)}
                    className="text-xs px-3 py-1 rounded"
                    style={{
                      background: "#F2F2F2",
                      color: "#9E9E9E",
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
                  <span style={{ color: "#9E9E9E" }}>Bed:</span>{" "}
                  <span className="font-semibold" style={{ color: "#1F1F1F" }}>
                    ₹{previewBed.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#9E9E9E" }}>Paper:</span>{" "}
                  <span className="font-semibold" style={{ color: "#1F1F1F" }}>
                    ₹{previewPaper.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
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
          style={{ background: "#FFFFFF", border: "1px solid #E5E5E5" }}
        >
          <h2 className="text-lg font-bold mb-4" style={{ color: "#1F1F1F" }}>
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
            <div className="p-3 rounded" style={{ background: "#F2F2F2" }}>
              <div className="text-xs" style={{ color: "#9E9E9E" }}>
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
              className="py-2 rounded font-semibold"
              style={{ background: "#FF7F11", color: "#fff" }}
            >
              Update Contract
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "#1F1F1F" }}>
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
          style={{ background: "#FFFFFF", border: "1px solid #E5E5E5" }}
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
                style={{ background: "#F2F2F2", color: "#9E9E9E" }}
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
              className="py-2 rounded font-semibold"
              style={{ background: "#FF7F11", color: "#fff" }}
            >
              Save Contract
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div data-ocid="contracts.loading_state" style={{ color: "#9E9E9E" }}>
          Loading...
        </div>
      ) : (
        <div className="flex flex-col gap-2" data-ocid="contracts.list">
          {contracts.length === 0 && (
            <div
              data-ocid="contracts.empty_state"
              className="text-sm"
              style={{ color: "#9E9E9E" }}
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
              style={{ background: "#FFFFFF", border: "1px solid #E5E5E5" }}
              onClick={() => setSelected(c)}
            >
              <span className="font-medium" style={{ color: "#1F1F1F" }}>
                {c.name}
              </span>
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
