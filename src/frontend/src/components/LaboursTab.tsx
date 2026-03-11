import { useEffect, useState } from "react";
import type { AppMode } from "../App";
import type { Labour } from "../backend.d";
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

  const load = () => actor?.getAllLabours().then(setLabours);
  // biome-ignore lint/correctness/useExhaustiveDependencies: load is stable
  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    await actor?.createLabour(
      addForm.name.trim(),
      addForm.phone.trim() || null,
    );
    setAddForm({ name: "", phone: "" });
    setShowAdd(false);
    await load();
  };

  const handleUpdate = async (id: bigint) => {
    await actor?.updateLabour(
      id,
      editForm.name.trim(),
      editForm.phone.trim() || null,
    );
    setEditingId(null);
    await load();
  };

  const inputStyle = {
    background: "#1e1e1e",
    border: "1px solid #444",
    color: "#f5f5f5",
    borderRadius: 6,
    padding: "6px 10px",
    width: "100%",
  };
  const labelStyle = {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 2,
    display: "block" as const,
  };
  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 600,
    fontSize: 12,
    color: "#aaa",
    background: "#252525",
    borderBottom: "1px solid #3a3a3a",
  };
  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid #2a2a2a",
    fontSize: 13,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Labours</h2>
        {mode === "edit" && (
          <button
            type="button"
            data-ocid="labours.add.button"
            onClick={() => setShowAdd((v) => !v)}
            className="text-sm px-4 py-2 rounded-lg font-semibold"
            style={{ background: "#f97316", color: "#fff" }}
          >
            + Add Labour
          </button>
        )}
      </div>

      {showAdd && mode === "edit" && (
        <div
          className="rounded-xl p-4 mb-4 max-w-sm"
          style={{ background: "#2a2a2a", border: "1px solid #3a3a3a" }}
        >
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "#f97316" }}
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
              className="py-2 rounded font-semibold"
              style={{ background: "#f97316", color: "#fff" }}
            >
              Save Labour
            </button>
          </div>
        </div>
      )}

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
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
                colSpan={4}
                style={{ ...tdStyle, color: "#666", textAlign: "center" }}
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
              style={{ background: i % 2 === 0 ? "#242424" : "#222" }}
            >
              <td style={tdStyle}>{i + 1}</td>
              {editingId === l.id ? (
                <>
                  <td style={tdStyle}>
                    <input
                      style={{
                        background: "#1e1e1e",
                        border: "1px solid #444",
                        color: "#f5f5f5",
                        borderRadius: 4,
                        padding: "3px 6px",
                        width: 160,
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
                        background: "#1e1e1e",
                        border: "1px solid #444",
                        color: "#f5f5f5",
                        borderRadius: 4,
                        padding: "3px 6px",
                        width: 130,
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
                      style={{ background: "#f97316", color: "#fff" }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: "#333", color: "#aaa" }}
                    >
                      Cancel
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td style={tdStyle}>{l.name}</td>
                  <td style={{ ...tdStyle, color: "#888" }}>
                    {l.phone || "-"}
                  </td>
                  {mode === "edit" && (
                    <td style={tdStyle}>
                      <button
                        type="button"
                        data-ocid={`labours.edit.button.${i + 1}`}
                        onClick={() => {
                          setEditingId(l.id);
                          setEditForm({ name: l.name, phone: l.phone || "" });
                        }}
                        className="text-xs px-3 py-1 rounded"
                        style={{
                          background: "#333",
                          color: "#f97316",
                          border: "1px solid #f97316",
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
  );
}
