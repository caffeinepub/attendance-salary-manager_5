import Map "mo:core/Map";
import Types "../types";
import AttendanceLib "../lib/AttendanceLib";

mixin (
  attendances : Map.Map<Nat, Types.Attendance>,
  contracts : Map.Map<Nat, Types.ContractV1>,
  labours : Map.Map<Nat, Types.LabourStorage>,
  advances : Map.Map<Nat, Types.AdvanceV1>,
  attendanceCounter : Nat
) {
  public shared ({ caller }) func saveAttendance(
    contractId : Nat,
    labourId : Nat,
    columnType : Types.ColumnType,
    value : Text
  ) : async Nat {
    let id = AttendanceLib.save(attendances, contracts, labours, attendanceCounter, contractId, labourId, columnType, value);
    attendanceCounter += 1;
    id;
  };

  public query ({ caller }) func getAttendanceByContract(contractId : Nat) : async [Types.Attendance] {
    AttendanceLib.getByContract(attendances, contractId);
  };

  public query ({ caller }) func calculateNetSalaries(contractId : Nat) : async [Types.SalaryBreakdown] {
    AttendanceLib.calculateNetSalaries(attendances, advances, contracts, labours, contractId);
  };
};
