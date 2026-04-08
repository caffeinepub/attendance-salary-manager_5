import Map "mo:core/Map";
import Types "../types";
import ContractLib "../lib/ContractLib";

mixin (
  contracts : Map.Map<Nat, Types.ContractV1>,
  contractCreatedAt : Map.Map<Nat, Text>,
  contractSettledAt : Map.Map<Nat, Text>,
  contractCounter : Nat
) {
  public shared ({ caller }) func createContract(
    name : Text,
    multiplierValue : Float,
    contractAmount : Int,
    machineExp : Int,
    bedAmount : ?Int,
    paperAmount : ?Int,
    meshColumns : [Text],
    createdAt : Text
  ) : async Nat {
    let id = ContractLib.create(
      contracts, contractCreatedAt, contractCounter,
      name, multiplierValue, contractAmount, machineExp,
      bedAmount, paperAmount, meshColumns, createdAt
    );
    contractCounter += 1;
    id;
  };

  public shared ({ caller }) func updateContract(
    id : Nat,
    name : Text,
    multiplierValue : Float,
    contractAmount : Int,
    machineExp : Int,
    bedAmount : ?Int,
    paperAmount : ?Int,
    meshColumns : [Text]
  ) : async () {
    ContractLib.update(contracts, id, name, multiplierValue, contractAmount, machineExp, bedAmount, paperAmount, meshColumns);
  };

  public shared ({ caller }) func settleContract(id : Nat, settledAt : Text) : async () {
    ContractLib.settle(contracts, contractSettledAt, id, settledAt);
  };

  public shared ({ caller }) func unsettleContract(id : Nat) : async () {
    ContractLib.unsettle(contracts, contractSettledAt, id);
  };

  public shared ({ caller }) func deleteContract(id : Nat) : async () {
    ContractLib.deleteContract(contracts, contractCreatedAt, contractSettledAt, id);
  };

  public query ({ caller }) func getAllContracts() : async [Types.Contract] {
    ContractLib.getAll(contracts, contractCreatedAt, contractSettledAt);
  };

  public query ({ caller }) func getContract(id : Nat) : async Types.Contract {
    ContractLib.getOne(contracts, contractCreatedAt, contractSettledAt, id);
  };

  public query ({ caller }) func getActivityLog() : async [Types.ActivityLogEntry] {
    ContractLib.getActivityLog(contracts, contractCreatedAt, contractSettledAt);
  };
};
