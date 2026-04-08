import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Types "../types";

module {
  public func toAdvance(
    a : Types.AdvanceV1,
    advanceTimestamps : Map.Map<Nat, Text>
  ) : Types.Advance {
    {
      id = a.id;
      contractId = a.contractId;
      labourId = a.labourId;
      amount = a.amount;
      note = a.note;
      timestamp = switch (advanceTimestamps.get(a.id)) {
        case (null) { "" };
        case (?v) { v };
      };
    };
  };

  public func create(
    advances : Map.Map<Nat, Types.AdvanceV1>,
    advanceTimestamps : Map.Map<Nat, Text>,
    contracts : Map.Map<Nat, Types.ContractV1>,
    labours : Map.Map<Nat, Types.LabourStorage>,
    counter : Nat,
    contractId : Nat,
    labourId : Nat,
    amount : Int,
    note : Text,
    timestamp : Text
  ) : Nat {
    if (not contracts.containsKey(contractId)) { Runtime.trap("Contract not found") };
    if (not labours.containsKey(labourId)) { Runtime.trap("Labour not found") };
    let id = counter;
    let advance : Types.AdvanceV1 = { id; contractId; labourId; amount; note };
    advances.add(id, advance);
    advanceTimestamps.add(id, timestamp);
    id;
  };

  public func update(
    advances : Map.Map<Nat, Types.AdvanceV1>,
    id : Nat,
    amount : Int,
    note : Text
  ) {
    switch (advances.get(id)) {
      case (null) { Runtime.trap("Advance not found") };
      case (?adv) {
        advances.add(id, { adv with amount; note });
      };
    };
  };

  public func deleteAdvance(
    advances : Map.Map<Nat, Types.AdvanceV1>,
    advanceTimestamps : Map.Map<Nat, Text>,
    id : Nat
  ) {
    advances.remove(id);
    advanceTimestamps.remove(id);
  };

  public func getByLabour(
    advances : Map.Map<Nat, Types.AdvanceV1>,
    advanceTimestamps : Map.Map<Nat, Text>,
    labourId : Nat
  ) : [Types.Advance] {
    advances.values().toArray()
      .filter(func(a : Types.AdvanceV1) : Bool { a.labourId == labourId })
      .map(func(a : Types.AdvanceV1) : Types.Advance { toAdvance(a, advanceTimestamps) });
  };

  public func getByContract(
    advances : Map.Map<Nat, Types.AdvanceV1>,
    advanceTimestamps : Map.Map<Nat, Text>,
    contractId : Nat
  ) : [Types.Advance] {
    advances.values().toArray()
      .filter(func(a : Types.AdvanceV1) : Bool { a.contractId == contractId })
      .map(func(a : Types.AdvanceV1) : Types.Advance { toAdvance(a, advanceTimestamps) });
  };

  public func getAll(
    advances : Map.Map<Nat, Types.AdvanceV1>,
    advanceTimestamps : Map.Map<Nat, Text>
  ) : [Types.Advance] {
    advances.values().toArray()
      .map(func(a : Types.AdvanceV1) : Types.Advance { toAdvance(a, advanceTimestamps) });
  };
};
