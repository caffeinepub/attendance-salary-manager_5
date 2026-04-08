import Map "mo:core/Map";
import Types "../types";
import AdvanceLib "../lib/AdvanceLib";

mixin (
  advances : Map.Map<Nat, Types.AdvanceV1>,
  advanceTimestamps : Map.Map<Nat, Text>,
  contracts : Map.Map<Nat, Types.ContractV1>,
  labours : Map.Map<Nat, Types.LabourStorage>,
  advanceCounter : Nat
) {
  public shared ({ caller }) func createAdvance(
    contractId : Nat,
    labourId : Nat,
    amount : Int,
    note : Text,
    timestamp : Text
  ) : async Nat {
    let id = AdvanceLib.create(advances, advanceTimestamps, contracts, labours, advanceCounter, contractId, labourId, amount, note, timestamp);
    advanceCounter += 1;
    id;
  };

  public shared ({ caller }) func updateAdvance(id : Nat, amount : Int, note : Text) : async () {
    AdvanceLib.update(advances, id, amount, note);
  };

  public shared ({ caller }) func deleteAdvance(id : Nat) : async () {
    AdvanceLib.deleteAdvance(advances, advanceTimestamps, id);
  };

  public query ({ caller }) func getAdvancesByLabour(labourId : Nat) : async [Types.Advance] {
    AdvanceLib.getByLabour(advances, advanceTimestamps, labourId);
  };

  public query ({ caller }) func getAdvancesByContract(contractId : Nat) : async [Types.Advance] {
    AdvanceLib.getByContract(advances, advanceTimestamps, contractId);
  };

  public query ({ caller }) func getAllAdvances() : async [Types.Advance] {
    AdvanceLib.getAll(advances, advanceTimestamps);
  };
};
