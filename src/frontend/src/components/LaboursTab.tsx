import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
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
  const [expandedId, setExpandedId] = useState<bigint | null>(null);
  const [editingId, setEditingId] = useState<bigint | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    groupId: "",
  });
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<bigint | null>(null);
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
      isActive: true,
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
      toast.error("Failed to add labour");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: bigint) => {
    if (!actor) return;
    setSavingId(id);
    const phone = editForm.phone.trim() || null;
    const groupId = editForm.groupId !== "" ? BigInt(editForm.groupId) : null;
    try {
      await actor.updateLabour(id, editForm.name.trim(), phone, groupId);
      setEditingId(null);
      toast.success("Labour updated");
      await loadAll();
    } catch (_) {
      toast.error("Failed to update labour");
    } finally {
      setSavingId(null);
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
        prev.map((l) =>
          l.id === id ? { ...l, isActive: currentActive ?? true } : l,
        ),
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

  const openEdit = (l: Labour) => {
    setEditingId(l.id);
    setEditForm({
      name: l.name,
      phone: l.phone || "",
      groupId: l.groupId !== undefined ? String(l.groupId) : "",
    });
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
              background: "rgba(255,255,255,0.97)",
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
                  &quot;{confirmGroup?.name}&quot;
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

      {/* Edit Labour Modal */}
      {editingId !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            background: "rgba(30,27,75,0.4)",
            backdropFilter: "blur(6px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditingId(null);
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.97)",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 36px",
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 -8px 40px rgba(30,27,75,0.15)",
            }}
          >
            {/* Handle bar */}
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: "rgba(99,102,241,0.2)",
                margin: "0 auto 20px",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  color: TEXT_PRIMARY,
                  fontWeight: 700,
                  fontSize: 17,
                  margin: 0,
                }}
              >
                Edit Labour
              </h3>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                aria-label="Close"
                style={{
                  background: "rgba(99,102,241,0.08)",
                  border: "1px solid rgba(99,102,241,0.15)",
                  borderRadius: 8,
                  padding: "4px 6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} color="#6366f1" />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span style={labelStyle}>Name *</span>
                <input
                  data-ocid="labours.edit.name.input"
                  style={inputStyle}
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <span style={labelStyle}>Phone (optional)</span>
                <input
                  data-ocid="labours.edit.phone.input"
                  style={inputStyle}
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
              <div>
                <span style={labelStyle}>Group (optional)</span>
                <select
                  data-ocid="labours.edit.group.select"
                  style={inputStyle}
                  value={editForm.groupId}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, groupId: e.target.value }))
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
                data-ocid="labours.save.button"
                onClick={() => handleUpdate(editingId)}
                disabled={savingId === editingId}
                style={{
                  padding: "12px",
                  borderRadius: 12,
                  background: savingId === editingId ? "#e5e7eb" : GRAD,
                  color: savingId === editingId ? TEXT_SECONDARY : "#fff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: savingId === editingId ? "not-allowed" : "pointer",
                  boxShadow:
                    savingId === editingId
                      ? "none"
                      : "0 4px 14px rgba(99,102,241,0.35)",
                  marginTop: 4,
                }}
              >
                {savingId === editingId ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
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

      {/* Labour Name List */}
      {labours.length === 0 ? (
        <div
          data-ocid="labours.empty_state"
          style={{
            background: "rgba(255,255,255,0.8)",
            border: "1px dashed rgba(99,102,241,0.2)",
            borderRadius: 12,
            padding: "32px 20px",
            textAlign: "center",
            color: TEXT_SECONDARY,
            fontSize: 14,
          }}
        >
          No labours added yet.
        </div>
      ) : (
        <div
          className="flex flex-col gap-1.5"
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            borderRadius: 16,
            boxShadow: CARD_SHADOW,
            backdropFilter: "blur(10px)",
            overflow: "hidden",
          }}
        >
          {labours.map((l, i) => {
            const isExpanded = expandedId === l.id;
            const isInactive = l.isActive === false;
            const groupName = getGroupName(l.groupId);

            return (
              <div key={String(l.id)} data-ocid={`labours.item.${i + 1}`}>
                {/* Labour row — tap to expand */}
                <button
                  type="button"
                  onClick={() =>
                    l.id >= 0n && setExpandedId(isExpanded ? null : l.id)
                  }
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && l.id >= 0n) {
                      setExpandedId(isExpanded ? null : l.id);
                    }
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "13px 16px",
                    background: "transparent",
                    border: "none",
                    borderBottom:
                      i < labours.length - 1 || isExpanded
                        ? "1px solid rgba(99,102,241,0.07)"
                        : "none",
                    cursor: l.id >= 0n ? "pointer" : "default",
                    textAlign: "left",
                    transition: "background 0.15s",
                    opacity: isInactive ? 0.6 : l.id < 0n ? 0.5 : 1,
                  }}
                >
                  {/* Left: name + badges */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    {/* Avatar circle */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: isInactive
                          ? "rgba(107,114,128,0.12)"
                          : "rgba(99,102,241,0.1)",
                        border: `1.5px solid ${isInactive ? "rgba(107,114,128,0.2)" : "rgba(99,102,241,0.2)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        fontSize: 14,
                        fontWeight: 700,
                        color: isInactive ? TEXT_SECONDARY : "#6366f1",
                      }}
                    >
                      {l.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: TEXT_PRIMARY,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {l.name}
                        {l.id < 0n && (
                          <span
                            style={{
                              color: TEXT_SECONDARY,
                              fontSize: 11,
                              marginLeft: 6,
                              fontWeight: 400,
                            }}
                          >
                            saving…
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 2,
                          flexWrap: "wrap",
                        }}
                      >
                        {/* Active/Inactive badge */}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 7px",
                            borderRadius: 10,
                            background: isInactive
                              ? "rgba(107,114,128,0.1)"
                              : "rgba(22,163,74,0.1)",
                            color: isInactive ? TEXT_SECONDARY : "#16a34a",
                            border: `1px solid ${isInactive ? "rgba(107,114,128,0.2)" : "rgba(22,163,74,0.2)"}`,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {isInactive ? "Inactive" : "Active"}
                        </span>
                        {/* Group badge */}
                        {groupName && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "1px 7px",
                              borderRadius: 10,
                              background: "rgba(99,102,241,0.08)",
                              color: "#6366f1",
                              border: "1px solid rgba(99,102,241,0.18)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {groupName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Right: chevron */}
                  <div style={{ flexShrink: 0, marginLeft: 8 }}>
                    {isExpanded ? (
                      <ChevronDown size={16} color="#6366f1" />
                    ) : (
                      <ChevronRight size={16} color={TEXT_SECONDARY} />
                    )}
                  </div>
                </button>

                {/* Expanded detail card */}
                {isExpanded && (
                  <div
                    data-ocid={`labours.detail.${i + 1}`}
                    style={{
                      padding: "14px 16px 16px",
                      background: "rgba(245,246,255,0.7)",
                      borderBottom:
                        i < labours.length - 1
                          ? "1px solid rgba(99,102,241,0.07)"
                          : "none",
                    }}
                  >
                    {/* Detail rows */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "10px 16px",
                        marginBottom: 14,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: TEXT_SECONDARY,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            marginBottom: 2,
                          }}
                        >
                          Phone
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: l.phone ? TEXT_PRIMARY : TEXT_SECONDARY,
                          }}
                        >
                          {l.phone || "—"}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: TEXT_SECONDARY,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            marginBottom: 2,
                          }}
                        >
                          Group
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: groupName ? "#6366f1" : TEXT_SECONDARY,
                          }}
                        >
                          {groupName || "No Group"}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: TEXT_SECONDARY,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            marginBottom: 2,
                          }}
                        >
                          Status
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: isInactive ? TEXT_SECONDARY : "#16a34a",
                          }}
                        >
                          {isInactive ? "Inactive" : "Active"}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons (edit mode only) */}
                    {mode === "edit" && l.id >= 0n && (
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          data-ocid={`labours.edit.button.${i + 1}`}
                          onClick={() => openEdit(l)}
                          style={{
                            flex: "1 1 auto",
                            padding: "9px 14px",
                            borderRadius: 10,
                            background: "rgba(99,102,241,0.1)",
                            color: "#6366f1",
                            border: "1px solid rgba(99,102,241,0.22)",
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          data-ocid={`labours.toggle.button.${i + 1}`}
                          onClick={() => handleToggleActive(l.id, l.isActive)}
                          disabled={togglingId === l.id}
                          style={{
                            flex: "1 1 auto",
                            padding: "9px 14px",
                            borderRadius: 10,
                            background: isInactive
                              ? "rgba(22,163,74,0.1)"
                              : "rgba(107,114,128,0.1)",
                            color: isInactive ? "#16a34a" : TEXT_SECONDARY,
                            border: isInactive
                              ? "1px solid rgba(22,163,74,0.22)"
                              : "1px solid rgba(107,114,128,0.2)",
                            fontWeight: 600,
                            fontSize: 13,
                            cursor:
                              togglingId === l.id ? "not-allowed" : "pointer",
                            opacity: togglingId === l.id ? 0.6 : 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                          }}
                        >
                          {togglingId === l.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isInactive ? (
                            "✅ Set Active"
                          ) : (
                            "⏸ Set Inactive"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
