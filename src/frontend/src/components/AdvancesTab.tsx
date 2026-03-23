import { useEffect, useState } from "react";
import type { AppMode } from "../App";
import type { Advance, Contract, Labour } from "../backend.d";
import { useActor } from "../hooks/useActor";

interface Props {
  mode: AppMode;
}

export function AdvancesTab({ mode }: Props) {
  const { actor } = useActor();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<bigint | null>(
    null,
  );
  const [allAdvances, setAllAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    labourId: "",
    amount: "",
    note: "",
    contractId: "",
  });
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", note: "" });

  useEffect(() => {
    if (!actor) return;
    setLoading(true);
    Promise.all([actor.getAllContracts(), actor.getAllLabours()]).then(
      ([cs, ls]) => {
        const activeContracts = cs.filter((c) => !c.isSettled);
        setContracts(activeContracts);
        setLabours(ls);
        Promise.all(
          activeContracts.map((c) => actor.getAdvancesByContract(c.id)),
        ).then((advArrays) => {
          setAllAdvances(advArrays.flat());
          setLoading(false);
        });
      },
    );
  }, [actor]);

  const loadForContract = async (contractId: bigint) => {
    const adv = await actor?.getAdvancesByContract(contractId);
    setAllAdvances((prev) => [
      ...prev.filter((a) => a.contractId !== contractId),
      ...(adv ?? []),
    ]);
  };

  const handleSelectContract = (id: bigint | null) => {
    setSelectedContractId(id);
  };

  const displayedAdvances = selectedContractId
    ? allAdvances.filter((a) => a.contractId === selectedContractId)
    : allAdvances;

  const handleAdd = async () => {
    const cId =
      selectedContractId ??
      (addForm.contractId ? BigInt(addForm.contractId) : null);
    if (!cId || !addForm.labourId || !addForm.amount) return;
    await actor?.createAdvance(
      cId,
      BigInt(addForm.labourId),
      BigInt(Math.round(Number.parseFloat(addForm.amount))),
      addForm.note,
    );
    setAddForm({ labourId: "", amount: "", note: "", contractId: "" });
    setShowAdd(false);
    await loadForContract(cId);
  };

  const handleDelete = async (adv: Advance) => {
    // Optimistic UI update
    setAllAdvances((prev) => prev.filter((a) => a.id !== adv.id));
    // Persist to backend
    try {
      await actor?.deleteAdvance(adv.id);
    } catch (err) {
      console.error("Failed to delete advance", err);
      // Restore on failure
      setAllAdvances((prev) => [...prev, adv]);
    }
  };

  const handleEditSave = async (adv: Advance) => {
    const newAmount = BigInt(Math.round(Number.parseFloat(editForm.amount)));
    const newNote = editForm.note;
    // Optimistic UI update
    setAllAdvances((prev) =>
      prev.map((a) =>
        a.id === adv.id ? { ...a, amount: newAmount, note: newNote } : a,
      ),
    );
    setEditingId(null);
    // Persist to backend
    try {
      await actor?.updateAdvance(adv.id, newAmount, newNote);
    } catch (err) {
      console.error("Failed to update advance", err);
      // Restore original on failure
      setAllAdvances((prev) => prev.map((a) => (a.id === adv.id ? adv : a)));
    }
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
  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 600,
    fontSize: 12,
    color: "#94A3B8",
    background: "#111827",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  };
  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    fontSize: 13,
    color: "#F1F5F9",
  };

  const getLabourName = (id: bigint) =>
    labours.find((l) => l.id === id)?.name || String(id);

  const getContractName = (id: bigint) =>
    contracts.find((c) => c.id === id)?.name || String(id);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-bold" style={{ color: "#F1F5F9" }}>
          Advances
        </h2>
        <select
          data-ocid="advances.contract.select"
          value={selectedContractId ? String(selectedContractId) : ""}
          onChange={(e) =>
            handleSelectContract(e.target.value ? BigInt(e.target.value) : null)
          }
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#F1F5F9",
            borderRadius: 6,
            padding: "6px 10px",
            minWidth: 180,
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
            className="text-sm px-3 py-2 rounded"
            style={{ background: "#FF7F11", color: "#fff" }}
          >
            + Add Advance
          </button>
        )}
      </div>

      {showAdd && mode === "edit" && (
        <div
          className="rounded-xl p-4 mb-4 max-w-sm"
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
              className="py-2 rounded font-semibold"
              style={{ background: "#FF7F11", color: "#fff" }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div
          style={{ color: "#94A3B8", textAlign: "center", padding: 24 }}
          data-ocid="advances.loading_state"
        >
          Loading advances...
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={thStyle}>Labour</th>
                {!selectedContractId && <th style={thStyle}>Contract</th>}
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Note</th>
                {mode === "edit" && <th style={thStyle}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayedAdvances.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      ...tdStyle,
                      color: "#94A3B8",
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
                  style={{ background: i % 2 === 0 ? "#111827" : "#0D1626" }}
                >
                  <td style={tdStyle}>{getLabourName(adv.labourId)}</td>
                  {!selectedContractId && (
                    <td style={{ ...tdStyle, color: "#94A3B8" }}>
                      {getContractName(adv.contractId)}
                    </td>
                  )}
                  {editingId === adv.id ? (
                    <>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          style={{
                            background: "#1E293B",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#F1F5F9",
                            borderRadius: 4,
                            padding: "3px 6px",
                            width: 100,
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
                            background: "#1E293B",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#F1F5F9",
                            borderRadius: 4,
                            padding: "3px 6px",
                            width: 140,
                          }}
                          value={editForm.note}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, note: e.target.value }))
                          }
                        />
                      </td>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          data-ocid={`advances.save.button.${i + 1}`}
                          onClick={() => handleEditSave(adv)}
                          className="text-xs px-2 py-1 rounded mr-1"
                          style={{ background: "#FF7F11", color: "#fff" }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-xs px-2 py-1 rounded"
                          style={{
                            background: "#111827",
                            color: "#94A3B8",
                            border: "1px solid #E5E5E5",
                          }}
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...tdStyle, color: "#FF7F11" }}>
                        ₹{Number(adv.amount).toLocaleString()}
                      </td>
                      <td style={{ ...tdStyle, color: "#94A3B8" }}>
                        {adv.note}
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
                            className="text-xs px-2 py-1 rounded mr-1"
                            style={{
                              background: "rgba(255,127,17,0.15)",
                              color: "#FF7F11",
                              border: "1px solid #FF7F11",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            data-ocid={`advances.delete.button.${i + 1}`}
                            onClick={() => handleDelete(adv)}
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              background: "rgba(220,38,38,0.15)",
                              color: "#DC2626",
                            }}
                          >
                            Delete
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
