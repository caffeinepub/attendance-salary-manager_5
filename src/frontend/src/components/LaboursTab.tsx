import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppMode } from "../App";
import type { Group, Labour } from "../backend";
import { useActor } from "../hooks/useActor";

interface Props {
  mode: AppMode;
}

export function LaboursTab({ mode }: Props) {
  const { actor } = useActor();

  const [labours, setLabours] = useState<Labour[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", phone: "", groupId: "" });
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    groupId: "",
  });
  const [adding, setAdding] = useState(false);

  // Group management
  const [showGroups, setShowGroups] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<bigint | null>(null);

  const loadAll = async () => {
    if (!actor) return;
    try {
      const [ls, gs] = await Promise.all([
        actor.getAllLabours(),
        actor.getAllGroups(),
      ]);
      setLabours(ls);
      setGroups([...gs].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (_) {
      // ignore
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadAll captures actor from closure
  useEffect(() => {
    if (actor) loadAll();
  }, [actor]);

  const handleAdd = async () => {
    if (!addForm.name.trim() || !actor) return;
    const name = addForm.name.trim();
    const phone = addForm.phone.trim() || null;
    const groupId = addForm.groupId ? BigInt(addForm.groupId) : null;

    const tempId = BigInt(-Date.now());
    const optimistic: Labour = {
      id: tempId,
      name,
      phone: phone ?? undefined,
      groupId: groupId ?? undefined,
    };
    setLabours((prev) => [...prev, optimistic]);
    setAddForm({ name: "", phone: "", groupId: "" });
    setShowAdd(false);
    setAdding(true);

    try {
      await actor.createLabour(name, phone, groupId);
      const ls = await actor.getAllLabours();
      setLabours(ls);
    } catch (_) {
      setLabours((prev) => prev.filter((l) => l.id !== tempId));
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: bigint) => {
    if (!actor) return;
    const phone = editForm.phone.trim() || null;
    const groupId = editForm.groupId ? BigInt(editForm.groupId) : null;
    try {
      await actor.updateLabour(id, editForm.name.trim(), phone, groupId);
      setEditingId(null);
      await loadAll();
    } catch (_) {
      // ignore
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim() || !actor) return;
    setAddingGroup(true);
    try {
      await actor.createGroup(newGroupName.trim());
      setNewGroupName("");
      const gs = await actor.getAllGroups();
      setGroups([...gs].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (_) {
      // ignore
    } finally {
      setAddingGroup(false);
    }
  };

  const handleDeleteGroup = async (id: bigint) => {
    if (!actor) return;
    setDeletingGroupId(id);
    try {
      await actor.deleteGroup(id);
      await loadAll();
    } catch (_) {
      // ignore
    } finally {
      setDeletingGroupId(null);
    }
  };

  const getGroupName = (groupId?: bigint) => {
    if (!groupId) return null;
    return groups.find((g) => g.id === groupId)?.name ?? null;
  };

  const inputStyle = {
    background: "#FFFFFF",
    border: "1px solid #E5E5E5",
    color: "#1E293B",
    borderRadius: 6,
    padding: "6px 10px",
    width: "100%",
  };
  const selectDarkStyle: React.CSSProperties = {
    background: "#1E293B",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#F1F5F9",
    borderRadius: 6,
    padding: "6px 10px",
    width: "100%",
    fontSize: 13,
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
          <div className="flex gap-2">
            <button
              type="button"
              data-ocid="labours.groups.toggle"
              onClick={() => setShowGroups((v) => !v)}
              className="text-sm px-3 py-2 rounded-lg font-semibold flex items-center gap-1"
              style={{
                background: "rgba(255,127,17,0.15)",
                color: "#FF7F11",
                border: "1px solid rgba(255,127,17,0.35)",
              }}
            >
              Groups
              {showGroups ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              type="button"
              data-ocid="labours.add.button"
              onClick={() => setShowAdd((v) => !v)}
              className="text-sm px-4 py-2 rounded-lg font-semibold"
              style={{ background: "#FF7F11", color: "#fff" }}
            >
              + Add Labour
            </button>
          </div>
        )}
      </div>

      {/* Group Management Section */}
      {showGroups && mode === "edit" && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{
            background: "rgba(255,255,255,0.055)",
            border: "1px solid rgba(255,127,17,0.25)",
            backdropFilter: "blur(12px)",
          }}
        >
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "#FF7F11" }}
          >
            Manage Groups
          </h3>
          {/* Add Group */}
          <div className="flex gap-2 mb-3">
            <input
              data-ocid="labours.group.name.input"
              placeholder="New group name…"
              style={{
                ...inputStyle,
                flex: 1,
                width: "auto",
              }}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
            />
            <button
              type="button"
              data-ocid="labours.group.add.button"
              onClick={handleAddGroup}
              disabled={addingGroup || !newGroupName.trim()}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{
                background:
                  addingGroup || !newGroupName.trim() ? "#334155" : "#FF7F11",
                color: addingGroup || !newGroupName.trim() ? "#64748B" : "#fff",
                cursor:
                  addingGroup || !newGroupName.trim()
                    ? "not-allowed"
                    : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {addingGroup ? "Adding…" : "Add Group"}
            </button>
          </div>

          {/* Groups List */}
          {groups.length === 0 ? (
            <p
              className="text-xs text-center py-2"
              style={{ color: "#64748B" }}
              data-ocid="labours.groups.empty_state"
            >
              No groups yet. Create one above.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {groups.map((g) => (
                <div
                  key={String(g.id)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: "#F1F5F9" }}
                  >
                    {g.name}
                  </span>
                  <button
                    type="button"
                    data-ocid="labours.group.delete.button"
                    onClick={() => handleDeleteGroup(g.id)}
                    disabled={deletingGroupId === g.id}
                    className="p-1.5 rounded-md"
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      color: deletingGroupId === g.id ? "#94A3B8" : "#EF4444",
                      border: "1px solid rgba(239,68,68,0.25)",
                      cursor:
                        deletingGroupId === g.id ? "not-allowed" : "pointer",
                    }}
                    title="Delete group"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Labour Form */}
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
            <div>
              <span style={labelStyle}>Group (optional)</span>
              <select
                data-ocid="labours.add.group.select"
                style={inputStyle}
                value={addForm.groupId}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, groupId: e.target.value }))
                }
              >
                <option value="">No Group</option>
                {groups.map((g) => (
                  <option key={String(g.id)} value={String(g.id)}>
                    {g.name}
                  </option>
                ))}
              </select>
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
              <th style={thStyle}>Group</th>
              {mode === "edit" && <th style={thStyle}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {labours.length === 0 && (
              <tr>
                <td
                  colSpan={mode === "edit" ? 5 : 4}
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
                  background: i % 2 === 0 ? "#111827" : "#0D1626",
                  opacity: l.id < 0n ? 0.6 : 1,
                }}
              >
                <td style={tdStyle}>{i + 1}</td>
                {editingId === l.id ? (
                  <>
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
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, name: e.target.value }))
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
                          width: 110,
                        }}
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            phone: e.target.value,
                          }))
                        }
                      />
                    </td>
                    <td style={tdStyle}>
                      <select
                        style={{ ...selectDarkStyle, width: 120 }}
                        value={editForm.groupId}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            groupId: e.target.value,
                          }))
                        }
                      >
                        <option value="">No Group</option>
                        {groups.map((g) => (
                          <option key={String(g.id)} value={String(g.id)}>
                            {g.name}
                          </option>
                        ))}
                      </select>
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
                    <td style={tdStyle}>
                      {getGroupName(l.groupId) ? (
                        <span
                          style={{
                            background: "rgba(255,127,17,0.18)",
                            color: "#FF7F11",
                            border: "1px solid rgba(255,127,17,0.35)",
                            borderRadius: 12,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {getGroupName(l.groupId)}
                        </span>
                      ) : (
                        <span style={{ color: "#475569", fontSize: 12 }}>
                          —
                        </span>
                      )}
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
                                groupId: l.groupId ? String(l.groupId) : "",
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
