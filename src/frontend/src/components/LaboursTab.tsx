import { useEffect, useState } from "react";
import type { AppMode } from "../App";
import type { Group, Labour } from "../backend.d";
import { useActor } from "../hooks/useActor";

interface Props {
  mode: AppMode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyActor = any;

export function LaboursTab({ mode }: Props) {
  const { actor } = useActor();
  const a = actor as AnyActor;

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

  // Group management
  const [newGroupName, setNewGroupName] = useState("");
  const [groupError, setGroupError] = useState("");

  const load = () => {
    if (!a) return;
    a.getAllLabours().then(setLabours);
    a.getAllGroups
      ? a.getAllGroups().then(setGroups)
      : Promise.resolve([]).then(setGroups);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load captures actor from closure
  useEffect(() => {
    if (a) load();
  }, [actor]);

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      setGroupError("Group name already exists");
      return;
    }
    setGroupError("");
    if (a?.createGroup) await a.createGroup(name);
    setNewGroupName("");
    if (a?.getAllGroups) a.getAllGroups().then(setGroups);
  };

  const handleDeleteGroup = async (id: bigint) => {
    if (a?.deleteGroup) await a.deleteGroup(id);
    if (a?.getAllGroups) a.getAllGroups().then(setGroups);
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    const groupId = addForm.groupId ? BigInt(addForm.groupId) : null;
    if (a?.createGroup !== undefined) {
      // New backend with groupId support
      await a.createLabour(
        addForm.name.trim(),
        addForm.phone.trim() || null,
        groupId,
      );
    } else {
      await a.createLabour(addForm.name.trim(), addForm.phone.trim() || null);
    }
    setAddForm({ name: "", phone: "", groupId: "" });
    setShowAdd(false);
    load();
  };

  const handleUpdate = async (id: bigint) => {
    const groupId = editForm.groupId ? BigInt(editForm.groupId) : null;
    if (a?.createGroup !== undefined) {
      // New backend with groupId support
      await a.updateLabour(
        id,
        editForm.name.trim(),
        editForm.phone.trim() || null,
        groupId,
      );
    } else {
      await a.updateLabour(
        id,
        editForm.name.trim(),
        editForm.phone.trim() || null,
      );
    }
    setEditingId(null);
    load();
  };

  const getGroupName = (groupId?: bigint) => {
    if (!groupId) return "—";
    return groups.find((g) => g.id === groupId)?.name ?? "—";
  };

  const inputStyle = {
    background: "#FFFFFF",
    border: "1px solid #E5E5E5",
    color: "#1F1F1F",
    borderRadius: 6,
    padding: "6px 10px",
    width: "100%",
  };
  const selectStyle = {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "#1F1F1F" }}>
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

      {/* Groups Management (Edit mode only) */}
      {mode === "edit" && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: "#FFFFFF", border: "1px solid #E5E5E5" }}
        >
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "#FF7F11" }}
          >
            Groups
          </h3>
          <div className="flex gap-2 mb-3">
            <input
              data-ocid="labours.group.input"
              style={{ ...inputStyle, flex: 1 }}
              placeholder="New group name..."
              value={newGroupName}
              onChange={(e) => {
                setNewGroupName(e.target.value);
                setGroupError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
            />
            <button
              type="button"
              data-ocid="labours.group.add.button"
              onClick={handleAddGroup}
              className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
              style={{ background: "#FF7F11", color: "#fff" }}
            >
              Add Group
            </button>
          </div>
          {groupError && (
            <p
              style={{ color: "#DC2626", fontSize: 12, marginBottom: 8 }}
              data-ocid="labours.group.error_state"
            >
              {groupError}
            </p>
          )}
          {groups.length === 0 ? (
            <p
              style={{ color: "#9E9E9E", fontSize: 12 }}
              data-ocid="labours.groups.empty_state"
            >
              No groups yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {groups.map((g, i) => (
                <span
                  key={String(g.id)}
                  data-ocid={`labours.group.item.${i + 1}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#FFF3E0",
                    border: "1px solid #FFD9A0",
                    borderRadius: 999,
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#FF7F11",
                  }}
                >
                  {g.name}
                  <button
                    type="button"
                    data-ocid={`labours.group.delete_button.${i + 1}`}
                    onClick={() => handleDeleteGroup(g.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#FF7F11",
                      padding: 0,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                    aria-label={`Delete group ${g.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && mode === "edit" && (
        <div
          className="rounded-xl p-4 mb-4 max-w-sm"
          style={{ background: "#FFFFFF", border: "1px solid #E5E5E5" }}
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
                style={selectStyle}
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
              className="py-2 rounded font-semibold"
              style={{ background: "#FF7F11", color: "#fff" }}
            >
              Save Labour
            </button>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table
          style={{ borderCollapse: "collapse", width: "100%", minWidth: 400 }}
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
                  style={{ ...tdStyle, color: "#9E9E9E", textAlign: "center" }}
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
                style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}
              >
                <td style={tdStyle}>{i + 1}</td>
                {editingId === l.id ? (
                  <>
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
                          color: "#1F1F1F",
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
                      <select
                        data-ocid={`labours.edit.group.select.${i + 1}`}
                        style={{
                          background: "#FFFFFF",
                          border: "1px solid #E5E5E5",
                          color: "#1F1F1F",
                          borderRadius: 4,
                          padding: "3px 6px",
                          width: 120,
                        }}
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
                    <td style={tdStyle}>{l.name}</td>
                    <td style={{ ...tdStyle, color: "#9E9E9E" }}>
                      {l.phone || "-"}
                    </td>
                    <td style={{ ...tdStyle, color: "#9E9E9E" }}>
                      {getGroupName(l.groupId)}
                    </td>
                    {mode === "edit" && (
                      <td style={tdStyle}>
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
