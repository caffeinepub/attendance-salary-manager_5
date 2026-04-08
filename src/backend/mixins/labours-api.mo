import Map "mo:core/Map";
import Types "../types";
import LabourLib "../lib/LabourLib";

mixin (
  labours : Map.Map<Nat, Types.LabourStorage>,
  labourGroups : Map.Map<Nat, Nat>,
  labourActiveMap : Map.Map<Nat, Bool>,
  labourCounter : Nat
) {
  public shared ({ caller }) func createLabour(name : Text, phone : ?Text, groupId : ?Nat) : async Nat {
    let id = LabourLib.create(labours, labourGroups, labourActiveMap, labourCounter, name, phone, groupId);
    labourCounter += 1;
    id;
  };

  public shared ({ caller }) func updateLabour(id : Nat, name : Text, phone : ?Text, groupId : ?Nat) : async () {
    LabourLib.update(labours, labourGroups, id, name, phone, groupId);
  };

  public shared ({ caller }) func setLabourActive(id : Nat, active : Bool) : async () {
    LabourLib.setActive(labours, labourActiveMap, id, active);
  };

  public shared ({ caller }) func deleteLabour(id : Nat) : async () {
    LabourLib.deleteLabour(labours, labourGroups, labourActiveMap, id);
  };

  public query ({ caller }) func getAllLabours() : async [Types.Labour] {
    LabourLib.getAll(labours, labourGroups, labourActiveMap);
  };
};
