import Map "mo:core/Map";
import Order "mo:core/Order";
import Nat "mo:core/Nat";

module {
  public type Group = {
    id : Nat;
    name : Text;
  };

  public type LabourStorage = {
    id : Nat;
    name : Text;
    phone : ?Text;
  };

  public type Labour = {
    id : Nat;
    name : Text;
    phone : ?Text;
    groupId : ?Nat;
    isActive : Bool;
  };

  // Old Contract type (without new fields) - used for migration compatibility
  public type ContractV1 = {
    id : Nat;
    name : Text;
    multiplierValue : Float;
    contractAmount : Int;
    machineExp : Int;
    bedAmount : Int;
    paperAmount : Int;
    meshAmount : Int;
    meshColumns : [Text];
    isSettled : Bool;
  };

  public type Contract = {
    id : Nat;
    name : Text;
    multiplierValue : Float;
    contractAmount : Int;
    machineExp : Int;
    bedAmount : Int;
    paperAmount : Int;
    meshAmount : Int;
    meshColumns : [Text];
    isSettled : Bool;
    createdAt : Text;
    settledAt : ?Text;
  };

  public type ColumnType = {
    #bed;
    #paper;
    #mesh : Nat;
  };

  public type Attendance = {
    id : Nat;
    contractId : Nat;
    labourId : Nat;
    columnType : ColumnType;
    value : Text;
  };

  // Old Advance type (without timestamp) - used for migration compatibility
  public type AdvanceV1 = {
    id : Nat;
    contractId : Nat;
    labourId : Nat;
    amount : Int;
    note : Text;
  };

  public type Advance = {
    id : Nat;
    contractId : Nat;
    labourId : Nat;
    amount : Int;
    note : Text;
    timestamp : Text;
  };

  public type SalaryBreakdown = {
    labourId : Nat;
    labourName : Text;
    bedSalary : Int;
    paperSalary : Int;
    meshSalary : Int;
    totalAttendanceSalary : Int;
    totalAdvances : Int;
    netSalary : Int;
  };

  public type AttendanceNote = {
    id : Nat;
    contractId : Nat;
    labourId : Nat;
    note : Text;
  };

  public type Holiday = {
    id : Nat;
    contractId : Nat;
    columnKey : Text;
  };

  public type ActivityLogEntry = {
    contractId : Nat;
    contractName : Text;
    createdAt : Text;
    settledAt : ?Text;
  };

  public type WorkingTodayEntry = { ts : Text; count : Nat };

  public module ColumnType {
    public func compare(a : ColumnType, b : ColumnType) : Order.Order {
      switch (a, b) {
        case (#bed, #bed) { #equal };
        case (#bed, _) { #less };
        case (#paper, #bed) { #greater };
        case (#paper, #paper) { #equal };
        case (#paper, #mesh(_)) { #less };
        case (#mesh(_), #bed) { #greater };
        case (#mesh(_), #paper) { #greater };
        case (#mesh(n1), #mesh(n2)) {
          Nat.compare(n1, n2);
        };
      };
    };
  };
};
