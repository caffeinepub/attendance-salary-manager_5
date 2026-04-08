import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Types "../types";

module {
  public func createGroup(
    groups : Map.Map<Nat, Types.Group>,
    counter : Nat,
    name : Text
  ) : Nat {
    for (g in groups.values()) {
      if (g.name == name) { Runtime.trap("Group name already exists") };
    };
    let id = counter;
    groups.add(id, { id; name });
    id;
  };

  public func deleteGroup(groups : Map.Map<Nat, Types.Group>, id : Nat) {
    groups.remove(id);
  };

  public func getAllGroups(groups : Map.Map<Nat, Types.Group>) : [Types.Group] {
    groups.values().toArray();
  };
};
