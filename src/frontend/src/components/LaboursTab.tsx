import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AppMode } from "../App";
import type { Group, Labour } from "../backend";
import { useActor } from "../hooks/useActor";

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
  const [togglingId, setTogglingId] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);

  // Group management
  const [showGroups, setShowGroups] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<bigint | null>(null);
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<
    bigint | null
  >(null);

  const loadAll = async () => {
    if (!actor) return;
    setLoading(true);
    try {
      const [ls, gs] = await Promise.all([
        actor.getAllLabours(),
        actor.getAllGroups(),
      ]);
      setLabours(ls);
      setGroups([...gs].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (_) {
      // ignore
    } finally {
      setLoading(false);
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
    const groupId = addForm.groupId !== "" ? BigInt(addForm.groupId) : null;

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
      toast.success(`Labour "${name}" added`);
    } catch (_) {
      setLabours((prev) => prev.filter((l) => l.id !== tempId));
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: bigint) => {
    if (!actor) return;
    const phone = editForm.phone.trim() || null;
    const groupId = editForm.groupId !== "" ? BigInt(editForm.groupId) : null;
    try {
      await actor.updateLabour(id, editForm.name.trim(), phone, groupId);
      setEditingId(null);
      toast.success("Labour updated");
      await loadAll();
    } catch (_) {
      // ignore
    }
  };

  const handleToggleActive = async (
    id: bigint,
    currentActive: boolean | undefined,
  ) => {
    if (!actor) return;
    const nextActive = !(currentActive !== false);
    setLabours((prev) =>
      prev.map((l) => (l.id === id ? { ...l, isActive: nextActive } : l)),
    );
    setTogglingId(id);
    try {
      await actor.setLabourActive(id, nextActive);
      toast.success(nextActive ? "Labour set active" : "Labour set inactive");
    } catch (_) {
      setLabours((prev) =>
        prev.map((l) => (l.id === id ? { ...l, isActive: currentActive } : l)),
      );
      toast.error("Failed to update labour status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim() || !actor) return;
    setAddingGroup(true);
    try {
      const gName = newGroupName.trim();
      await actor.createGroup(gName);
      setNewGroupName("");
      toast.success(`Group "${gName}" created`);
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
    const gName = groups.find((g) => g.id === id)?.name ?? "Group";
    setDeletingGroupId(id);
    setConfirmDeleteGroupId(null);
    try {
      await actor.deleteGroup(id);
      toast.success(`"${gName}" deleted`);
      await loadAll();
    } catch (_) {
      // ignore
    } finally {
      setDeletingGroupId(null);
    }
  };

  const getGroupName = (groupId?: bigint) => {
    if (groupId === undefined || groupId === null) return null;
    return groups.find((g) => g.id === groupId)?.name ?? null;
  };

  const confirmGroup =
    confirmDeleteGroupId !== null
      ? groups.find((g) => g.id === confirmDeleteGroupId)
      : null;

  const inputStyle = {
    background: "#FFFFFF",
    border: "1.5px solid rgba(99,102,241,0.2)",
    color: TEXT_PRIMARY,
    borderRadius: 8,
    padding: "7px 11px",
    width: "100%",
    fontSize: 13,
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
    whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "9px 12px",
    borderBottom: "1px solid rgba(99,102,241,0.07)",
    fontSize: 13,
    color: TEXT_PRIMARY,
    verticalAlign: "middle",
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "200px",
        }}
      >
        <Loader2
          size={32}
          style={{ color: "#6366f1" }}
          className="animate-spin"
        />
      </div>
    );
  }

  return (
    <div style={{ background: PAGE_BG, minHeight: "100%" }}>
      {/* Delete Group Confirmation Dialog */}
      {confirmDeleteGroupId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(30,27,75,0.35)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.95)",
              border: "1px solid rgba(220,38,38,0.2)",
              borderRadius: 20,
              padding: "24px 20px",
              maxWidth: 320,
              width: "90%",
              boxShadow: "0 24px 64px rgba(30,27,75,0.18)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "rgba(220,38,38,0.1)",
                  border: "1px solid rgba(220,38,38,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                }}
              >
                <Trash2 size={20} color="#dc2626" />
              </div>
              <h3
                style={{
                  color: TEXT_PRIMARY,
                  fontWeight: 700,
                  fontSize: 16,
                  marginBottom: 6,
                }}
              >
                Delete Group?
              </h3>
              <p
                style={{ color: TEXT_SECONDARY, fontSize: 13, lineHeight: 1.5 }}
              >
                Are you sure you want to delete{" "}
                <span style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>
                  "{confirmGroup?.name}"
                </span>
                ? Labours in this group will be unassigned.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteGroupId(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 10,
                  background: "#f3f4f6",
                  color: TEXT_SECONDARY,
                  border: "1px solid #e5e7eb",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteGroup(confirmDeleteGroupId)}
                disabled={deletingGroupId === confirmDeleteGroupId}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 10,
                  background:
                    deletingGroupId === confirmDeleteGroupId
                      ? "#fca5a5"
                      : "#dc2626",
                  color: "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor:
                    deletingGroupId === confirmDeleteGroupId
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {deletingGroupId === confirmDeleteGroupId
                  ? "Deleting…"
                  : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: TEXT_PRIMARY }}>
          Labours
        </h2>
        {mode === "edit" && (
          <div className="flex gap-2">
            <button
              type="button"
              data-ocid="labours.groups.toggle"
              onClick={() => setShowGroups((v) => !v)}
              className="text-sm px-3 py-2 rounded-xl font-semibold flex items-center gap-1 transition-all active:scale-95"
              style={{
                background: "rgba(99,102,241,0.1)",
                color: "#6366f1",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              Groups
              {showGroups ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              type="button"
              data-ocid="labours.add.button"
              onClick={() => setShowAdd((v) => !v)}
              className="text-sm px-4 py-2 rounded-xl font-semibold transition-all active:scale-95"
              style={{
                background: GRAD,
                color: "#fff",
                border: "none",
                boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
              }}
            >
              + Add Labour
            </button>
          </div>
        )}
      </div>

      {/* Group Management Section */}
      {showGroups && mode === "edit" && (
        <div
          className="rounded-2xl p-4 mb-4"
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
            Manage Groups
          </h3>
          <div className="flex gap-2 mb-3">
            <input
              data-ocid="labours.group.name.input"
              placeholder="New group name…"
              style={{ ...inputStyle, flex: 1, width: "auto" }}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
            />
            <button
              type="button"
              data-ocid="labours.group.add.button"
              onClick={handleAddGroup}
              disabled={addingGroup || !newGroupName.trim()}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold"
              style={{
                background:
                  addingGroup || !newGroupName.trim() ? "#e5e7eb" : GRAD,
                color:
                  addingGroup || !newGroupName.trim() ? TEXT_SECONDARY : "#fff",
                border: "none",
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

          {groups.length === 0 ? (
            <p
              className="text-xs text-center py-2"
              style={{ color: TEXT_SECONDARY }}
              data-ocid="labours.groups.empty_state"
            >
              No groups yet. Create one above.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {groups.map((g) => (
                <div
                  key={String(g.id)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{
                    background: "rgba(99,102,241,0.05)",
                    border: "1px solid rgba(99,102,241,0.1)",
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: TEXT_PRIMARY }}
                  >
                    {g.name}
                  </span>
                  <button
                    type="button"
                    data-ocid="labours.group.delete.button"
                    onClick={() => setConfirmDeleteGroupId(g.id)}
                    disabled={deletingGroupId === g.id}
                    className="p-1.5 rounded-lg"
                    style={{
                      background: "rgba(220,38,38,0.1)",
                      color:
                        deletingGroupId === g.id ? TEXT_SECONDARY : "#dc2626",
                      border: "1px solid rgba(220,38,38,0.18)",
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
              className="py-2.5 rounded-xl font-semibold text-sm"
              style={{
                background: adding ? "#e5e7eb" : GRAD,
                color: adding ? TEXT_SECONDARY : "#fff",
                border: "none",
                cursor: adding ? "not-allowed" : "pointer",
                boxShadow: adding ? "none" : "0 4px 12px rgba(99,102,241,0.3)",
              }}
            >
              {adding ? "Saving…" : "Save Labour"}
            </button>
          </div>
        </div>
      )}

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
        <table
          style={{ borderCollapse: "collapse", width: "100%", minWidth: 300 }}
        >
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Group</th>
              <th style={thStyle}>Status</th>
              {mode === "edit" && <th style={thStyle}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {labours.length === 0 && (
              <tr>
                <td
                  colSpan={mode === "edit" ? 6 : 5}
                  style={{
                    ...tdStyle,
                    color: TEXT_SECONDARY,
                    textAlign: "center",
                  }}
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
                  background:
                    i % 2 === 0
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(245,247,255,0.8)",
                  opacity: l.isActive === false ? 0.55 : l.id < 0n ? 0.6 : 1,
                }}
              >
                <td style={tdStyle}>{i + 1}</td>
                {editingId === l.id ? (
                  <>
                    <td style={tdStyle}>
                      <input
                        style={{
                          ...inputStyle,
                          width: 140,
                          padding: "4px 8px",
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
                          ...inputStyle,
                          width: 110,
                          padding: "4px 8px",
                        }}
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, phone: e.target.value }))
                        }
                      />
                    </td>
                    <td style={tdStyle}>
                      <select
                        style={{
                          ...inputStyle,
                          width: 120,
                          padding: "4px 8px",
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
                    <td style={tdStyle} />
                    <td style={tdStyle}>
                      <button
                        type="button"
                        data-ocid={`labours.save.button.${i + 1}`}
                        onClick={() => handleUpdate(l.id)}
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
                    <td style={tdStyle}>
                      {l.name}
                      {l.id < 0n && (
                        <span
                          style={{
                            color: TEXT_SECONDARY,
                            fontSize: 11,
                            marginLeft: 6,
                          }}
                        >
                          saving…
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: TEXT_SECONDARY }}>
                      {l.phone || "-"}
                    </td>
                    <td style={tdStyle}>
                      {getGroupName(l.groupId) ? (
                        <span
                          style={{
                            background: "rgba(99,102,241,0.1)",
                            color: "#6366f1",
                            border: "1px solid rgba(99,102,241,0.2)",
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
                        <span style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                          —
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {l.isActive === false ? (
                        <span
                          style={{
                            background: "rgba(107,114,128,0.1)",
                            color: TEXT_SECONDARY,
                            border: "1px solid rgba(107,114,128,0.2)",
                            borderRadius: 12,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Inactive
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "rgba(22,163,74,0.1)",
                            color: "#16a34a",
                            border: "1px solid rgba(22,163,74,0.2)",
                            borderRadius: 12,
                            padding: "2px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Active
                        </span>
                      )}
                    </td>
                    {mode === "edit" && (
                      <td style={tdStyle}>
                        {l.id >= 0n && (
                          <div className="flex gap-1 flex-wrap">
                            <button
                              type="button"
                              data-ocid={`labours.edit.button.${i + 1}`}
                              onClick={() => {
                                setEditingId(l.id);
                                setEditForm({
                                  name: l.name,
                                  phone: l.phone || "",
                                  groupId:
                                    l.groupId !== undefined
                                      ? String(l.groupId)
                                      : "",
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
                            <button
                              type="button"
                              data-ocid={`labours.toggle.button.${i + 1}`}
                              onClick={() =>
                                handleToggleActive(l.id, l.isActive)
                              }
                              disabled={togglingId === l.id}
                              className="text-xs px-2 py-1.5 rounded-lg font-semibold"
                              style={{
                                background:
                                  l.isActive === false
                                    ? "rgba(22,163,74,0.1)"
                                    : "rgba(107,114,128,0.1)",
                                color:
                                  l.isActive === false
                                    ? "#16a34a"
                                    : TEXT_SECONDARY,
                                border:
                                  l.isActive === false
                                    ? "1px solid rgba(22,163,74,0.2)"
                                    : "1px solid rgba(107,114,128,0.2)",
                                cursor:
                                  togglingId === l.id
                                    ? "not-allowed"
                                    : "pointer",
                                opacity: togglingId === l.id ? 0.6 : 1,
                                whiteSpace: "nowrap",
                              }}
                              title={
                                l.isActive === false
                                  ? "Set Active"
                                  : "Set Inactive"
                              }
                            >
                              {l.isActive === false
                                ? "Set Active"
                                : "Set Inactive"}
                            </button>
                          </div>
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
