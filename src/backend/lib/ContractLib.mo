import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Types "../types";

module {
  public func toContract(
    c : Types.ContractV1,
    contractCreatedAt : Map.Map<Nat, Text>,
    contractSettledAt : Map.Map<Nat, Text>
  ) : Types.Contract {
    {
      id = c.id;
      name = c.name;
      multiplierValue = c.multiplierValue;
      contractAmount = c.contractAmount;
      machineExp = c.machineExp;
      bedAmount = c.bedAmount;
      paperAmount = c.paperAmount;
      meshAmount = c.meshAmount;
      meshColumns = c.meshColumns;
      isSettled = c.isSettled;
      createdAt = switch (contractCreatedAt.get(c.id)) {
        case (null) { "" };
        case (?v) { v };
      };
      settledAt = contractSettledAt.get(c.id);
    };
  };

  public func create(
    contracts : Map.Map<Nat, Types.ContractV1>,
    contractCreatedAt : Map.Map<Nat, Text>,
    counter : Nat,
    name : Text,
    multiplierValue : Float,
    contractAmount : Int,
    machineExp : Int,
    bedAmount : ?Int,
    paperAmount : ?Int,
    meshColumns : [Text],
    createdAt : Text
  ) : Nat {
    let id = counter;
    let finalBedAmount = switch (bedAmount) {
      case (null) { (11000.0 * multiplierValue).toInt() };
      case (?amount) { amount };
    };
    let finalPaperAmount = switch (paperAmount) {
      case (null) { (7000.0 * multiplierValue).toInt() };
      case (?amount) { amount };
    };
    let meshAmount = contractAmount - finalBedAmount - finalPaperAmount - machineExp;
    let contract : Types.ContractV1 = {
      id;
      name;
      multiplierValue;
      contractAmount;
      machineExp;
      bedAmount = finalBedAmount;
      paperAmount = finalPaperAmount;
      meshAmount;
      meshColumns;
      isSettled = false;
    };
    contracts.add(id, contract);
    contractCreatedAt.add(id, createdAt);
    id;
  };

  public func update(
    contracts : Map.Map<Nat, Types.ContractV1>,
    id : Nat,
    name : Text,
    multiplierValue : Float,
    contractAmount : Int,
    machineExp : Int,
    bedAmount : ?Int,
    paperAmount : ?Int,
    meshColumns : [Text]
  ) {
    switch (contracts.get(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?existing) {
        let finalBedAmount = switch (bedAmount) {
          case (null) { (11000.0 * multiplierValue).toInt() };
          case (?amount) { amount };
        };
        let finalPaperAmount = switch (paperAmount) {
          case (null) { (7000.0 * multiplierValue).toInt() };
          case (?amount) { amount };
        };
        let meshAmount = contractAmount - finalBedAmount - finalPaperAmount - machineExp;
        let contract : Types.ContractV1 = {
          id;
          name;
          multiplierValue;
          contractAmount;
          machineExp;
          bedAmount = finalBedAmount;
          paperAmount = finalPaperAmount;
          meshAmount;
          meshColumns;
          isSettled = existing.isSettled;
        };
        contracts.add(id, contract);
      };
    };
  };

  public func settle(
    contracts : Map.Map<Nat, Types.ContractV1>,
    contractSettledAt : Map.Map<Nat, Text>,
    id : Nat,
    settledAt : Text
  ) {
    switch (contracts.get(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contract) {
        contracts.add(id, { contract with isSettled = true });
        contractSettledAt.add(id, settledAt);
      };
    };
  };

  public func unsettle(
    contracts : Map.Map<Nat, Types.ContractV1>,
    contractSettledAt : Map.Map<Nat, Text>,
    id : Nat
  ) {
    switch (contracts.get(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contract) {
        contracts.add(id, { contract with isSettled = false });
        contractSettledAt.remove(id);
      };
    };
  };

  public func deleteContract(
    contracts : Map.Map<Nat, Types.ContractV1>,
    contractCreatedAt : Map.Map<Nat, Text>,
    contractSettledAt : Map.Map<Nat, Text>,
    id : Nat
  ) {
    contracts.remove(id);
    contractCreatedAt.remove(id);
    contractSettledAt.remove(id);
  };

  public func getAll(
    contracts : Map.Map<Nat, Types.ContractV1>,
    contractCreatedAt : Map.Map<Nat, Text>,
    contractSettledAt : Map.Map<Nat, Text>
  ) : [Types.Contract] {
    contracts.values().toArray().map(func(c : Types.ContractV1) : Types.Contract {
      toContract(c, contractCreatedAt, contractSettledAt)
    });
  };

  public func getOne(
    contracts : Map.Map<Nat, Types.ContractV1>,
    contractCreatedAt : Map.Map<Nat, Text>,
    contractSettledAt : Map.Map<Nat, Text>,
    id : Nat
  ) : Types.Contract {
    switch (contracts.get(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?c) { toContract(c, contractCreatedAt, contractSettledAt) };
    };
  };

  public func getActivityLog(
    contracts : Map.Map<Nat, Types.ContractV1>,
    contractCreatedAt : Map.Map<Nat, Text>,
    contractSettledAt : Map.Map<Nat, Text>
  ) : [Types.ActivityLogEntry] {
    contracts.values().toArray()
      .filter(func(c : Types.ContractV1) : Bool { c.isSettled })
      .map(func(c : Types.ContractV1) : Types.ActivityLogEntry {
        {
          contractId = c.id;
          contractName = c.name;
          createdAt = switch (contractCreatedAt.get(c.id)) {
            case (null) { "" };
            case (?v) { v };
          };
          settledAt = contractSettledAt.get(c.id);
        }
      });
  };
};
