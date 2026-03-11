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
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    labourId: "",
    amount: "",
    note: "",
  });
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", note: "" });

  useEffect(() => {
    if (!actor) return;
    actor
      .getAllContracts()
      .then((cs) => setContracts(cs.filter((c) => !c.isSettled)));
    actor.getAllLabours().then(setLabours);
  }, [actor]);

  const load = async (contractId: bigint) => {
    const adv = await actor?.getAdvancesByContract(contractId);
    setAdvances(adv ?? []);
  };

  const handleSelectContract = (id: bigint | null) => {
    setSelectedContractId(id);
    if (id) load(id);
    else setAdvances([]);
  };

  const handleAdd = async () => {
    if (!selectedContractId || !addForm.labourId || !addForm.amount) return;
    await actor?.createAdvance(
      selectedContractId,
      BigInt(addForm.labourId),
      BigInt(Math.round(Number.parseFloat(addForm.amount))),
      addForm.note,
    );
    setAddForm({ labourId: "", amount: "", note: "" });
    setShowAdd(false);
    await load(selectedContractId);
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
  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 600,
    fontSize: 12,
    color: "#9E9E9E",
    background: "#F2F2F2",
    borderBottom: "1px solid #E5E5E5",
  };
  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid #E5E5E5",
    fontSize: 13,
    color: "#1F1F1F",
  };

  const getLabourName = (id: bigint) =>
    labours.find((l) => l.id === id)?.name || String(id);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg font-bold" style={{ color: "#1F1F1F" }}>
          Advances
        </h2>
        <select
          data-ocid="advances.contract.select"
          value={selectedContractId ? String(selectedContractId) : ""}
          onChange={(e) =>
            handleSelectContract(e.target.value ? BigInt(e.target.value) : null)
          }
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E5E5",
            color: "#1F1F1F",
            borderRadius: 6,
            padding: "6px 10px",
            minWidth: 200,
          }}
        >
          <option value="">-- Select Contract --</option>
          {contracts.map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
        {mode === "edit" && selectedContractId && (
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
          style={{ background: "#FFFFFF", border: "1px solid #E5E5E5" }}
        >
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "#FF7F11" }}
          >
            New Advance
          </h3>
          <div className="flex flex-col gap-2">
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

      {selectedContractId && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={thStyle}>Labour</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Note</th>
                {mode === "edit" && <th style={thStyle}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {advances.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      ...tdStyle,
                      color: "#9E9E9E",
                      textAlign: "center",
                    }}
                    data-ocid="advances.empty_state"
                  >
                    No advances recorded.
                  </td>
                </tr>
              )}
              {advances.map((adv, i) => (
                <tr
                  key={String(adv.id)}
                  data-ocid={`advances.item.${i + 1}`}
                  style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}
                >
                  <td style={tdStyle}>{getLabourName(adv.labourId)}</td>
                  {editingId === adv.id ? (
                    <>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          style={{
                            background: "#FFFFFF",
                            border: "1px solid #E5E5E5",
                            color: "#1F1F1F",
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
                            background: "#FFFFFF",
                            border: "1px solid #E5E5E5",
                            color: "#1F1F1F",
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
                          onClick={() => {
                            setAdvances((prev) =>
                              prev.map((a) =>
                                a.id === adv.id
                                  ? {
                                      ...a,
                                      amount: BigInt(
                                        Math.round(
                                          Number.parseFloat(editForm.amount),
                                        ),
                                      ),
                                      note: editForm.note,
                                    }
                                  : a,
                              ),
                            );
                            setEditingId(null);
                          }}
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
                            background: "#F2F2F2",
                            color: "#9E9E9E",
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
                      <td style={{ ...tdStyle, color: "#9E9E9E" }}>
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
                              background: "#FFFFFF",
                              color: "#FF7F11",
                              border: "1px solid #FF7F11",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            data-ocid={`advances.delete.button.${i + 1}`}
                            onClick={() =>
                              setAdvances((prev) =>
                                prev.filter((a) => a.id !== adv.id),
                              )
                            }
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: "#FEE2E2", color: "#DC2626" }}
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
