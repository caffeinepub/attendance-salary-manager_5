import Map "mo:core/Map";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";

actor {
  // Data Types
  type Labour = {
    id : Nat;
    name : Text;
    phone : ?Text;
  };

  type Contract = {
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

  type Attendance = {
    id : Nat;
    contractId : Nat;
    labourId : Nat;
    columnType : ColumnType;
    value : Text;
  };

  type Advance = {
    id : Nat;
    contractId : Nat;
    labourId : Nat;
    amount : Int;
    note : Text;
  };

  type SalaryBreakdown = {
    labourId : Nat;
    labourName : Text;
    bedSalary : Int;
    paperSalary : Int;
    meshSalary : Int;
    totalAttendanceSalary : Int;
    totalAdvances : Int;
    netSalary : Int;
  };

  type ColumnType = {
    #bed;
    #paper;
    #mesh : Nat;
  };

  module ColumnType {
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

  // ID Counters
  var labourCounter = 0;
  var contractCounter = 0;
  var attendanceCounter = 0;
  var advanceCounter = 0;

  // Persistent Maps
  let labours = Map.empty<Nat, Labour>();
  let contracts = Map.empty<Nat, Contract>();
  let attendances = Map.empty<Nat, Attendance>();
  let advances = Map.empty<Nat, Advance>();

  // Labour CRUD
  public shared ({ caller }) func createLabour(name : Text, phone : ?Text) : async Nat {
    let id = labourCounter;
    labourCounter += 1;
    let labour : Labour = { id; name; phone };
    labours.add(id, labour);
    id;
  };

  public shared ({ caller }) func updateLabour(id : Nat, name : Text, phone : ?Text) : async () {
    switch (labours.get(id)) {
      case (null) { Runtime.trap("Labour not found") };
      case (?_) {
        let labour : Labour = { id; name; phone };
        labours.add(id, labour);
      };
    };
  };

  // Contract CRUD
  public shared ({ caller }) func createContract(
    name : Text,
    multiplierValue : Float,
    contractAmount : Int,
    machineExp : Int,
    bedAmount : ?Int,
    paperAmount : ?Int,
    meshColumns : [Text]
  ) : async Nat {
    let id = contractCounter;
    contractCounter += 1;

    let finalBedAmount = switch (bedAmount) {
      case (null) { (11000.0 * multiplierValue).toInt() };
      case (?amount) { amount };
    };

    let finalPaperAmount = switch (paperAmount) {
      case (null) { (7000.0 * multiplierValue).toInt() };
      case (?amount) { amount };
    };

    let meshAmount = contractAmount - finalBedAmount - finalPaperAmount - machineExp;

    let contract : Contract = {
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
    switch (contracts.get(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?_) {
        let finalBedAmount = switch (bedAmount) {
          case (null) { (11000.0 * multiplierValue).toInt() };
          case (?amount) { amount };
        };

        let finalPaperAmount = switch (paperAmount) {
          case (null) { (7000.0 * multiplierValue).toInt() };
          case (?amount) { amount };
        };

        let meshAmount = contractAmount - finalBedAmount - finalPaperAmount - machineExp;

        let contract : Contract = {
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
      };
    };
  };

  // Contract Settlement
  public shared ({ caller }) func settleContract(id : Nat) : async () {
    switch (contracts.get(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contract) {
        let updatedContract = { contract with isSettled = true };
        contracts.add(id, updatedContract);
      };
    };
  };

  public shared ({ caller }) func unsettleContract(id : Nat) : async () {
    switch (contracts.get(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contract) {
        let updatedContract = { contract with isSettled = false };
        contracts.add(id, updatedContract);
      };
    };
  };

  public shared ({ caller }) func deleteContract(id : Nat) : async () {
    contracts.remove(id);
  };

  // Attendance
  public shared ({ caller }) func saveAttendance(
    contractId : Nat,
    labourId : Nat,
    columnType : ColumnType,
    value : Text
  ) : async Nat {
    if (not contracts.containsKey(contractId)) { Runtime.trap("Contract not found") };
    if (not labours.containsKey(labourId)) { Runtime.trap("Labour not found") };

    let id = attendanceCounter;
    attendanceCounter += 1;

    let attendance : Attendance = {
      id;
      contractId;
      labourId;
      columnType;
      value;
    };
    attendances.add(id, attendance);
    id;
  };

  // Advances
  public shared ({ caller }) func createAdvance(contractId : Nat, labourId : Nat, amount : Int, note : Text) : async Nat {
    if (not contracts.containsKey(contractId)) { Runtime.trap("Contract not found") };
    if (not labours.containsKey(labourId)) { Runtime.trap("Labour not found") };

    let id = advanceCounter;
    advanceCounter += 1;

    let advance : Advance = {
      id;
      contractId;
      labourId;
      amount;
      note;
    };
    advances.add(id, advance);
    id;
  };

  // Queries
  public query ({ caller }) func getAllLabours() : async [Labour] {
    labours.values().toArray();
  };

  public query ({ caller }) func getAllContracts() : async [Contract] {
    contracts.values().toArray();
  };

  public query ({ caller }) func getContract(id : Nat) : async Contract {
    switch (contracts.get(id)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?contract) { contract };
    };
  };

  public query ({ caller }) func getAttendanceByContract(contractId : Nat) : async [Attendance] {
    attendances.values().toArray().filter(
      func(a) { a.contractId == contractId }
    );
  };

  public query ({ caller }) func getAdvancesByLabour(labourId : Nat) : async [Advance] {
    advances.values().toArray().filter(
      func(a) { a.labourId == labourId }
    );
  };

  public query ({ caller }) func getAdvancesByContract(contractId : Nat) : async [Advance] {
    advances.values().toArray().filter(
      func(a) { a.contractId == contractId }
    );
  };

  // Calculate Net Salaries
  public query ({ caller }) func calculateNetSalaries(contractId : Nat) : async [SalaryBreakdown] {
    let contract = switch (contracts.get(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?c) { c };
    };

    let contractAttendances = attendances.values().toArray().filter(
      func(a) { a.contractId == contractId }
    );
    let contractAdvances = advances.values().toArray().filter(
      func(a) { a.contractId == contractId }
    );

    let salaryMap = Map.empty<Nat, SalaryBreakdown>();

    for (attendance in contractAttendances.values()) {
      let current = switch (salaryMap.get(attendance.labourId)) {
        case (null) {
          let labour = switch (labours.get(attendance.labourId)) {
            case (null) { Runtime.trap("Labour not found") };
            case (?l) { l };
          };
          {
            labourId = attendance.labourId;
            labourName = labour.name;
            bedSalary = 0;
            paperSalary = 0;
            meshSalary = 0;
            totalAttendanceSalary = 0;
            totalAdvances = 0;
            netSalary = 0;
          };
        };
        case (?existing) { existing };
      };

      var value = switch (attendance.value) {
        case ("absent") { 0.0 };
        case ("present") { 1.0 };
        case ("0.33") { 0.33 };
        case ("0.4") { 0.4 };
        case ("0.5") { 0.5 };
        case ("0.66") { 0.66 };
        case ("0.7") { 0.7 };
        case ("0.8") { 0.8 };
        case ("0.9") { 0.9 };
        case (_) { 0.0 };
      };

      var tempBreakdown = current;

      switch (attendance.columnType) {
        case (#bed) {
          tempBreakdown := {
            tempBreakdown with
            bedSalary = (contract.bedAmount.toFloat() * value).toInt();
          };
        };
        case (#paper) {
          tempBreakdown := {
            tempBreakdown with
            paperSalary = (contract.paperAmount.toFloat() * value).toInt();
          };
        };
        case (#mesh(_)) {
          tempBreakdown := {
            tempBreakdown with
            meshSalary = (contract.meshAmount.toFloat() * value).toInt();
          };
        };
      };

      tempBreakdown := {
        tempBreakdown with
        totalAttendanceSalary = tempBreakdown.totalAttendanceSalary + tempBreakdown.bedSalary + tempBreakdown.paperSalary + tempBreakdown.meshSalary;
      };

      salaryMap.add(attendance.labourId, tempBreakdown);
    };

    for (advance in contractAdvances.values()) {
      let current = switch (salaryMap.get(advance.labourId)) {
        case (null) {
          let labour = switch (labours.get(advance.labourId)) {
            case (null) { Runtime.trap("Labour not found") };
            case (?l) { l };
          };
          {
            labourId = advance.labourId;
            labourName = labour.name;
            bedSalary = 0;
            paperSalary = 0;
            meshSalary = 0;
            totalAttendanceSalary = 0;
            totalAdvances = 0;
            netSalary = 0;
          };
        };
        case (?existing) { existing };
      };

      let tempBreakdown = {
        current with
        totalAdvances = current.totalAdvances + advance.amount;
      };

      salaryMap.add(advance.labourId, tempBreakdown);
    };

    for (labourId in salaryMap.keys()) {
      let breakdown = switch (salaryMap.get(labourId)) {
        case (null) { Runtime.trap("Breakdown not found") };
        case (?b) { b };
      };
      let updatedBreakdown = {
        breakdown with
        netSalary = breakdown.totalAttendanceSalary - breakdown.totalAdvances;
      };
      salaryMap.add(labourId, updatedBreakdown);
    };

    salaryMap.values().toArray();
  };
};
