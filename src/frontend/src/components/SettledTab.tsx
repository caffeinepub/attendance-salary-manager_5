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
    const all = (await actor?.getAllContracts()) ?? [];
    setSettled(all.filter((c) => c.isSettled));
    setUnsettled(all.filter((c) => !c.isSettled));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: load is intentionally stable
  useEffect(() => {
    load();
  }, []);

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
      <h2 className="text-lg font-bold mb-4">Settled Contracts</h2>

      {mode === "edit" && unsettled.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-medium mb-2" style={{ color: "#aaa" }}>
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
                  background: "#2a2a2a",
                  border: "1px solid #3a3a3a",
                  color: "#f5f5f5",
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
          style={{ color: "#666" }}
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
                style={{ background: i % 2 === 0 ? "#242424" : "#222" }}
              >
                <td style={tdStyle}>{i + 1}</td>
                <td
                  style={{
                    ...tdStyle,
                    color: "#888",
                    textDecoration: "line-through",
                  }}
                >
                  {c.name}
                </td>
                <td style={{ ...tdStyle, color: "#f97316" }}>
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
                        background: "#333",
                        color: "#f97316",
                        border: "1px solid #f97316",
                      }}
                    >
                      Unsettle
                    </button>
                    <button
                      type="button"
                      data-ocid={`settled.delete.button.${i + 1}`}
                      onClick={() => handleDelete(c.id)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: "#3b1010", color: "#f87171" }}
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
