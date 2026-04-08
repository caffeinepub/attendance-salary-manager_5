import Map "mo:core/Map";
import Types "../types";

mixin (
  workingTodayMap : Map.Map<Nat, Types.WorkingTodayEntry>
) {
  public shared func recordWorkingToday(contractId : Nat, count : Nat, ts : Text) : async () {
    workingTodayMap.add(contractId, { ts; count });
  };

  public query func getWorkingTodayMap() : async [(Nat, Types.WorkingTodayEntry)] {
    workingTodayMap.entries().toArray();
  };
};
