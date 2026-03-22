import { useEffect, useState } from "react";
import type { AppMode } from "../App";
import type { Labour } from "../backend";
import { useActor } from "../hooks/useActor";

interface Props {
  mode: AppMode;
}

export function LaboursTab({ mode }: Props) {
  const { actor } = useActor();

  const [labours, setLabours] = useState<Labour[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", phone: "" });
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "" });
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!actor) return;
    try {
      const ls = await actor.getAllLabours();
      setLabours(ls);
    } catch (_) {
      // ignore
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load captures actor from closure
  useEffect(() => {
    if (actor) load();
  }, [actor]);

  const handleAdd = async () => {
    if (!addForm.name.trim() || !actor) return;
    const name = addForm.name.trim();
    const phone = addForm.phone.trim() || null;

    // Optimistic update: show the new labour immediately
    const tempId = BigInt(-Date.now());
    const optimistic: Labour = {
      id: tempId,
      name,
      phone: phone ?? undefined,
    };
    setLabours((prev) => [...prev, optimistic]);
    setAddForm({ name: "", phone: "" });
    setShowAdd(false);
    setAdding(true);

    try {
      await actor.createLabour(name, phone, null);
      // Refresh to get real ID
      const ls = await actor.getAllLabours();
      setLabours(ls);
    } catch (_) {
      // Remove optimistic entry on failure
      setLabours((prev) => prev.filter((l) => l.id !== tempId));
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: bigint) => {
    if (!actor) return;
    const phone = editForm.phone.trim() || null;
    try {
      await actor.updateLabour(id, editForm.name.trim(), phone, null);
      setEditingId(null);
      await load();
    } catch (_) {
      // ignore
    }
  };

  const inputStyle = {
    background: "#FFFFFF",
    border: "1px solid #E5E5E5",
    color: "#F1F5F9",
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "#F1F5F9" }}>
          Labours
        </h2>
        {mode === "edit" && (
          <button
            type="button"
            data-ocid="labours.add.button"
            onClick={() => setShowAdd((v) => !v)}
            className="text-sm px-4 py-2 rounded-lg font-semibold"
            style={{ background: "#FF7F11", color: "#fff" }}
          >
            + Add Labour
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
            New Labour
          </h3>
          <div className="flex flex-col gap-2">
            <div>
              <span style={labelStyle}>Name *</span>
              <input
                data-ocid="labours.add.name.input"
                style={inputStyle}
                value={addForm.name}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div>
              <span style={labelStyle}>Phone (optional)</span>
              <input
                data-ocid="labours.add.phone.input"
                style={inputStyle}
                value={addForm.phone}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <button
              type="button"
              data-ocid="labours.add.submit.button"
              onClick={handleAdd}
              disabled={adding}
              className="py-2 rounded font-semibold"
              style={{
                background: adding ? "#334155" : "#FF7F11",
                color: adding ? "#64748B" : "#fff",
                cursor: adding ? "not-allowed" : "pointer",
              }}
            >
              {adding ? "Saving…" : "Save Labour"}
            </button>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{ borderCollapse: "collapse", width: "100%", minWidth: 300 }}
        >
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Phone</th>
              {mode === "edit" && <th style={thStyle}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {labours.length === 0 && (
              <tr>
                <td
                  colSpan={mode === "edit" ? 4 : 3}
                  style={{ ...tdStyle, color: "#94A3B8", textAlign: "center" }}
                  data-ocid="labours.empty_state"
                >
                  No labours added yet.
                </td>
              </tr>
            )}
            {labours.map((l, i) => (
              <tr
                key={String(l.id)}
                data-ocid={`labours.item.${i + 1}`}
                style={{
                  background: i % 2 === 0 ? "#FFFFFF" : "#0D1626",
                  opacity: l.id < 0n ? 0.6 : 1,
                }}
              >
                <td style={tdStyle}>{i + 1}</td>
                {editingId === l.id ? (
                  <>
                    <td style={tdStyle}>
                      <input
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #E5E5E5",
                          color: "#F1F5F9",
                          borderRadius: 4,
                          padding: "3px 6px",
                          width: 140,
                        }}
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, name: e.target.value }))
                        }
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #E5E5E5",
                          color: "#F1F5F9",
                          borderRadius: 4,
                          padding: "3px 6px",
                          width: 110,
                        }}
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, phone: e.target.value }))
                        }
                      />
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        data-ocid={`labours.save.button.${i + 1}`}
                        onClick={() => handleUpdate(l.id)}
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
                    <td style={tdStyle}>
                      {l.name}
                      {l.id < 0n && (
                        <span
                          style={{
                            color: "#94A3B8",
                            fontSize: 11,
                            marginLeft: 6,
                          }}
                        >
                          saving…
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: "#94A3B8" }}>
                      {l.phone || "-"}
                    </td>
                    {mode === "edit" && (
                      <td style={tdStyle}>
                        {l.id >= 0n && (
                          <button
                            type="button"
                            data-ocid={`labours.edit.button.${i + 1}`}
                            onClick={() => {
                              setEditingId(l.id);
                              setEditForm({
                                name: l.name,
                                phone: l.phone || "",
                              });
                            }}
                            className="text-xs px-3 py-1 rounded"
                            style={{
                              background: "#FFFFFF",
                              color: "#FF7F11",
                              border: "1px solid #FF7F11",
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
