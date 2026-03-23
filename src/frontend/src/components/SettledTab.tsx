import { useEffect, useState } from "react";
import type { AppMode } from "../App";
import type { Contract } from "../backend.d";
import { useActor } from "../hooks/useActor";

interface Props {
  mode: AppMode;
}

export function SettledTab({ mode }: Props) {
  const { actor } = useActor();

  const [settled, setSettled] = useState<Contract[]>([]);
  const [unsettled, setUnsettled] = useState<Contract[]>([]);

  const load = async () => {
    if (!actor) return;
    const all = (await actor.getAllContracts()) ?? [];
    setSettled(all.filter((c) => c.isSettled));
    setUnsettled(all.filter((c) => !c.isSettled));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load captures actor from closure
  useEffect(() => {
    if (actor) load();
  }, [actor]);

  const handleSettle = async (id: bigint) => {
    await actor?.settleContract(id);
    await load();
  };

  const handleUnsettle = async (id: bigint) => {
    await actor?.unsettleContract(id);
    await load();
  };

  const handleDelete = async (id: bigint) => {
    if (!confirm("Permanently delete this settled contract and all its data?"))
      return;
    await actor?.deleteContract(id);
    await load();
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
      <h2 className="text-lg font-bold mb-4" style={{ color: "#F1F5F9" }}>
        Settled Contracts
      </h2>

      {mode === "edit" && unsettled.length > 0 && (
        <div className="mb-6">
          <div
            className="text-sm font-medium mb-2"
            style={{ color: "#94A3B8" }}
          >
            Mark a contract as settled:
          </div>
          <div className="flex flex-wrap gap-2">
            {unsettled.map((c) => (
              <button
                type="button"
                key={String(c.id)}
                data-ocid={`settled.mark.button.${unsettled.indexOf(c) + 1}`}
                onClick={() => handleSettle(c.id)}
                className="text-xs px-3 py-2 rounded-lg"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#F1F5F9",
                }}
              >
                ✓ Settle "{c.name}"
              </button>
            ))}
          </div>
        </div>
      )}

      {settled.length === 0 ? (
        <div
          data-ocid="settled.empty_state"
          style={{ color: "#94A3B8" }}
          className="text-sm"
        >
          No settled contracts.
        </div>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Contract Name</th>
              <th style={thStyle}>Contract Amount</th>
              {mode === "edit" && <th style={thStyle}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {settled.map((c, i) => (
              <tr
                key={String(c.id)}
                data-ocid={`settled.item.${i + 1}`}
                style={{ background: i % 2 === 0 ? "#111827" : "#0D1626" }}
              >
                <td style={tdStyle}>{i + 1}</td>
                <td
                  style={{
                    ...tdStyle,
                    color: "#94A3B8",
                    textDecoration: "line-through",
                  }}
                >
                  {c.name}
                </td>
                <td style={{ ...tdStyle, color: "#FF7F11" }}>
                  ₹{Number(c.contractAmount).toLocaleString()}
                </td>
                {mode === "edit" && (
                  <td style={tdStyle}>
                    <button
                      type="button"
                      data-ocid={`settled.unsettle.button.${i + 1}`}
                      onClick={() => handleUnsettle(c.id)}
                      className="text-xs px-2 py-1 rounded mr-2"
                      style={{
                        background: "transparent",
                        color: "#FF7F11",
                        border: "1px solid rgba(255,127,17,0.6)",
                      }}
                    >
                      Unsettle
                    </button>
                    <button
                      type="button"
                      data-ocid={`settled.delete.button.${i + 1}`}
                      onClick={() => handleDelete(c.id)}
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
