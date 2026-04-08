import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Types "../types";

module {
  public func create(
    labours : Map.Map<Nat, Types.LabourStorage>,
    labourGroups : Map.Map<Nat, Nat>,
    labourActiveMap : Map.Map<Nat, Bool>,
    counter : Nat,
    name : Text,
    phone : ?Text,
    groupId : ?Nat
  ) : Nat {
    let id = counter;
    let labour : Types.LabourStorage = { id; name; phone };
    labours.add(id, labour);
    labourActiveMap.add(id, true);
    switch (groupId) {
      case (null) {};
      case (?gid) { labourGroups.add(id, gid) };
    };
    id;
  };

  public func update(
    labours : Map.Map<Nat, Types.LabourStorage>,
    labourGroups : Map.Map<Nat, Nat>,
    id : Nat,
    name : Text,
    phone : ?Text,
    groupId : ?Nat
  ) {
    switch (labours.get(id)) {
      case (null) { Runtime.trap("Labour not found") };
      case (?_) {
        let labour : Types.LabourStorage = { id; name; phone };
        labours.add(id, labour);
        switch (groupId) {
          case (null) { labourGroups.remove(id) };
          case (?gid) { labourGroups.add(id, gid) };
        };
      };
    };
  };

  public func setActive(
    labours : Map.Map<Nat, Types.LabourStorage>,
    labourActiveMap : Map.Map<Nat, Bool>,
    id : Nat,
    active : Bool
  ) {
    switch (labours.get(id)) {
      case (null) { Runtime.trap("Labour not found") };
      case (?_) { labourActiveMap.add(id, active) };
    };
  };

  public func deleteLabour(
    labours : Map.Map<Nat, Types.LabourStorage>,
    labourGroups : Map.Map<Nat, Nat>,
    labourActiveMap : Map.Map<Nat, Bool>,
    id : Nat
  ) {
    labours.remove(id);
    labourGroups.remove(id);
    labourActiveMap.remove(id);
  };

  public func getAll(
    labours : Map.Map<Nat, Types.LabourStorage>,
    labourGroups : Map.Map<Nat, Nat>,
    labourActiveMap : Map.Map<Nat, Bool>
  ) : [Types.Labour] {
    labours.values().toArray().map(func(s : Types.LabourStorage) : Types.Labour {
      {
        id = s.id;
        name = s.name;
        phone = s.phone;
        groupId = labourGroups.get(s.id);
        isActive = switch (labourActiveMap.get(s.id)) {
          case (null) { true };
          case (?v) { v };
        };
      }
    });
  };
};
