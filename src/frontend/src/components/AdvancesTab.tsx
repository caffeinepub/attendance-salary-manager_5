import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AppMode } from "../App";
import type { Advance, Contract, Labour } from "../backend.d";
import { useActor } from "../hooks/useActor";

const GRAD = "linear-gradient(135deg, #6366f1, #8b5cf6)";
const PAGE_BG = "#f1f3f8";
const CARD_BG = "rgba(255,255,255,0.88)";
const CARD_BORDER = "1px solid rgba(120,80,255,0.14)";
const CARD_SHADOW =
  "0 2px 16px rgba(99,102,241,0.08), 0 1px 4px rgba(0,0,0,0.04)";
const TEXT_PRIMARY = "#1e1b4b";
const TEXT_SECONDARY = "#6b7280";

function formatDateTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

interface Props {
  mode: AppMode;
}

export function AdvancesTab({ mode }: Props) {
  const { actor } = useActor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = actor as any;

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<bigint | null>(
    null,
  );
  const [allAdvances, setAllAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    labourId: "",
    amount: "",
    note: "",
    contractId: "",
  });
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", note: "" });

  // biome-ignore lint/correctness/useExhaustiveDependencies: a is derived from actor
  useEffect(() => {
    if (!a) return;
    setLoading(true);
    Promise.all([a.getAllContracts(), a.getAllLabours()]).then(
      ([cs, ls]: [Contract[], Labour[]]) => {
        const activeContracts = cs.filter((c: Contract) => !c.isSettled);
        setContracts(activeContracts);
        setLabours(ls);
        Promise.all(
          activeContracts.map((c: Contract) => a.getAdvancesByContract(c.id)),
        ).then((advArrays: Advance[][]) => {
          setAllAdvances(advArrays.flat());
          setLoading(false);
        });
      },
    );
  }, [actor]);

  const loadForContract = async (contractId: bigint) => {
    const adv = await a?.getAdvancesByContract(contractId);
    setAllAdvances((prev) => [
      ...prev.filter((x: Advance) => x.contractId !== contractId),
      ...(adv ?? []),
    ]);
  };

  const displayedAdvances = selectedContractId
    ? allAdvances.filter((x) => x.contractId === selectedContractId)
    : allAdvances;

  const handleAdd = async () => {
    const cId =
      selectedContractId ??
      (addForm.contractId ? BigInt(addForm.contractId) : null);
    if (!cId || !addForm.labourId || !addForm.amount) return;
    setSavingAdvance(true);
    try {
      const timestamp = new Date().toISOString();
      await a?.createAdvance(
        cId,
        BigInt(addForm.labourId),
        BigInt(Math.round(Number.parseFloat(addForm.amount))),
        addForm.note,
        timestamp,
      );
      toast.success("Advance added");
      setAddForm({ labourId: "", amount: "", note: "", contractId: "" });
      setShowAdd(false);
      await loadForContract(cId);
    } finally {
      setSavingAdvance(false);
    }
  };

  const handleEditSave = async (adv: Advance) => {
    const newAmount = BigInt(Math.round(Number.parseFloat(editForm.amount)));
    const newNote = editForm.note;
    setAllAdvances((prev) =>
      prev.map((x) =>
        x.id === adv.id ? { ...x, amount: newAmount, note: newNote } : x,
      ),
    );
    setEditingId(null);
    toast.success("Advance updated");
    setSavingAdvance(true);
    try {
      await a?.updateAdvance(adv.id, newAmount, newNote);
    } catch (err) {
      console.error("Failed to update advance", err);
      setAllAdvances((prev) => prev.map((x) => (x.id === adv.id ? adv : x)));
      toast.error("Failed to update advance");
    } finally {
      setSavingAdvance(false);
    }
  };

  const inputStyle = {
    background: "#FFFFFF",
    border: "1.5px solid rgba(99,102,241,0.2)",
    color: TEXT_PRIMARY,
    borderRadius: 8,
    padding: "7px 11px",
    width: "100%",
    fontSize: 14,
    outline: "none",
  };
  const labelStyle = {
    color: TEXT_SECONDARY,
    fontSize: 12,
    marginBottom: 3,
    display: "block" as const,
    fontWeight: 600,
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

  const getLabourName = (id: bigint) =>
    labours.find((l) => l.id === id)?.name || String(id);
  const getContractName = (id: bigint) =>
    contracts.find((c) => c.id === id)?.name || String(id);

  return (
    <div style={{ background: PAGE_BG, minHeight: "100%" }}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-bold" style={{ color: TEXT_PRIMARY }}>
          Advances
        </h2>
        <select
          data-ocid="advances.contract.select"
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
            borderRadius: 8,
            padding: "7px 11px",
            minWidth: 180,
            fontSize: 13,
            outline: "none",
          }}
        >
          <option value="">All Contracts</option>
          {contracts.map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
        {mode === "edit" && (
          <button
            type="button"
            data-ocid="advances.add.button"
            onClick={() => setShowAdd((v) => !v)}
            className="text-sm px-3 py-2 rounded-xl font-semibold"
            style={{
              background: GRAD,
              color: "#fff",
              border: "none",
              boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
            }}
          >
            + Add Advance
          </button>
        )}
      </div>

      {savingAdvance && (
        <div
          data-ocid="advances.saving_state"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: "rgba(99,102,241,0.07)",
            border: "1px solid rgba(99,102,241,0.18)",
            borderRadius: 8,
            marginBottom: 12,
            color: "#6366f1",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <Loader2 size={14} className="animate-spin" />
          Saving advance...
        </div>
      )}

      {showAdd && mode === "edit" && (
        <div
          className="rounded-2xl p-4 mb-4 max-w-sm"
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
            New Advance
          </h3>
          <div className="flex flex-col gap-2">
            {!selectedContractId && (
              <div>
                <span style={labelStyle}>Contract</span>
                <select
                  data-ocid="advances.add.contract.select"
                  style={inputStyle}
                  value={addForm.contractId}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, contractId: e.target.value }))
                  }
                >
                  <option value="">Select Contract</option>
                  {contracts.map((c) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <span style={labelStyle}>Labour</span>
              <select
                data-ocid="advances.add.labour.select"
                style={inputStyle}
                value={addForm.labourId}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, labourId: e.target.value }))
                }
              >
                <option value="">Select Labour</option>
                {labours.map((l) => (
                  <option key={String(l.id)} value={String(l.id)}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span style={labelStyle}>Amount</span>
              <input
                data-ocid="advances.add.amount.input"
                type="number"
                style={inputStyle}
                value={addForm.amount}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </div>
            <div>
              <span style={labelStyle}>Note</span>
              <input
                data-ocid="advances.add.note.input"
                style={inputStyle}
                value={addForm.note}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, note: e.target.value }))
                }
              />
            </div>
            <button
              type="button"
              data-ocid="advances.add.submit.button"
              onClick={handleAdd}
              className="py-2 rounded-xl font-semibold text-sm"
              style={{
                background: GRAD,
                color: "#fff",
                border: "none",
                boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div
          style={{ color: TEXT_SECONDARY, textAlign: "center", padding: 24 }}
          data-ocid="advances.loading_state"
        >
          Loading advances...
        </div>
      ) : (
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
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={thStyle}>Labour</th>
                {!selectedContractId && <th style={thStyle}>Contract</th>}
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Note</th>
                <th style={thStyle}>Date</th>
                {mode === "edit" && <th style={thStyle}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayedAdvances.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      ...tdStyle,
                      color: TEXT_SECONDARY,
                      textAlign: "center",
                    }}
                    data-ocid="advances.empty_state"
                  >
                    No advances recorded.
                  </td>
                </tr>
              )}
              {displayedAdvances.map((adv, i) => (
                <tr
                  key={String(adv.id)}
                  data-ocid={`advances.item.${i + 1}`}
                  style={{
                    background:
                      i % 2 === 0
                        ? "rgba(255,255,255,0.9)"
                        : "rgba(245,247,255,0.8)",
                  }}
                >
                  <td style={tdStyle}>{getLabourName(adv.labourId)}</td>
                  {!selectedContractId && (
                    <td style={{ ...tdStyle, color: TEXT_SECONDARY }}>
                      {getContractName(adv.contractId)}
                    </td>
                  )}
                  {editingId === adv.id ? (
                    <>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          style={{
                            background: "#fff",
                            border: "1.5px solid rgba(99,102,241,0.2)",
                            color: TEXT_PRIMARY,
                            borderRadius: 6,
                            padding: "4px 8px",
                            width: 100,
                            outline: "none",
                          }}
                          value={editForm.amount}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              amount: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td style={tdStyle}>
                        <input
                          style={{
                            background: "#fff",
                            border: "1.5px solid rgba(99,102,241,0.2)",
                            color: TEXT_PRIMARY,
                            borderRadius: 6,
                            padding: "4px 8px",
                            width: 140,
                            outline: "none",
                          }}
                          value={editForm.note}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, note: e.target.value }))
                          }
                        />
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: TEXT_SECONDARY,
                          fontSize: 11,
                        }}
                      >
                        {adv.timestamp ? formatDateTime(adv.timestamp) : "—"}
                      </td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          data-ocid={`advances.save.button.${i + 1}`}
                          onClick={() => handleEditSave(adv)}
                          className="text-xs px-2.5 py-1.5 rounded-lg mr-1 font-semibold"
                          style={{
                            background: GRAD,
                            color: "#fff",
                            border: "none",
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                          style={{
                            background: "#f3f4f6",
                            color: TEXT_SECONDARY,
                            border: "1px solid #e5e7eb",
                          }}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td
                        style={{
                          ...tdStyle,
                          color: "#6366f1",
                          fontWeight: 700,
                        }}
                      >
                        ₹{Number(adv.amount).toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, color: TEXT_SECONDARY }}>
                        {adv.note}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: TEXT_SECONDARY,
                          fontSize: 11,
                        }}
                      >
                        {adv.timestamp ? formatDateTime(adv.timestamp) : "—"}
                      </td>
                      {mode === "edit" && (
                        <td style={tdStyle}>
                          <button
                            type="button"
                            data-ocid={`advances.edit.button.${i + 1}`}
                            onClick={() => {
                              setEditingId(adv.id);
                              setEditForm({
                                amount: String(Number(adv.amount)),
                                note: adv.note,
                              });
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                            style={{
                              background: "rgba(99,102,241,0.1)",
                              color: "#6366f1",
                              border: "1px solid rgba(99,102,241,0.2)",
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </>
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
