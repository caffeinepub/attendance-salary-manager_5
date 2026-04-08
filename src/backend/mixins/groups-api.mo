import Map "mo:core/Map";
import Types "../types";
import GroupLib "../lib/GroupLib";

mixin (
  groups : Map.Map<Nat, Types.Group>,
  groupCounter : Nat
) {
  public shared ({ caller }) func createGroup(name : Text) : async Nat {
    let id = GroupLib.createGroup(groups, groupCounter, name);
    groupCounter += 1;
    id;
  };

  public shared ({ caller }) func deleteGroup(id : Nat) : async () {
    GroupLib.deleteGroup(groups, id);
  };

  public query ({ caller }) func getAllGroups() : async [Types.Group] {
    GroupLib.getAllGroups(groups);
  };
};
