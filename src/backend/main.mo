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

  // Calculate Net Salaries — uses proportional formula matching the Attendance tab display:
  // Each labour's salary = (labour_attendance / total_column_attendance) * contract_column_amount
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

    // Helper: parse attendance value string to float
    let parseVal = func(v : Text) : Float {
      switch (v) {
        case ("absent") { 0.0 };
        case ("Absent") { 0.0 };
        case ("present") { 1.0 };
        case ("Present") { 1.0 };
        case ("0.33") { 0.33 };
        case ("0.4") { 0.4 };
        case ("0.5") { 0.5 };
        case ("0.66") { 0.66 };
        case ("0.7") { 0.7 };
        case ("0.8") { 0.8 };
        case ("0.9") { 0.9 };
        case (_) { 0.0 };
      };
    };

    // Step 1: Compute column totals across all labours
    var totalBed : Float = 0.0;
    var totalPaper : Float = 0.0;
    var totalMesh : Float = 0.0;

    for (a in contractAttendances.values()) {
      let v = parseVal(a.value);
      switch (a.columnType) {
        case (#bed) { totalBed += v };
        case (#paper) { totalPaper += v };
        case (#mesh(_)) { totalMesh += v };
      };
    };

    // Step 2: Compute per-labour attendance sums per column type
    let labourBed = Map.empty<Nat, Float>();
    let labourPaper = Map.empty<Nat, Float>();
    let labourMesh = Map.empty<Nat, Float>();

    for (a in contractAttendances.values()) {
      let v = parseVal(a.value);
      switch (a.columnType) {
        case (#bed) {
          let cur = switch (labourBed.get(a.labourId)) { case (null) { 0.0 }; case (?x) { x } };
          labourBed.add(a.labourId, cur + v);
        };
        case (#paper) {
          let cur = switch (labourPaper.get(a.labourId)) { case (null) { 0.0 }; case (?x) { x } };
          labourPaper.add(a.labourId, cur + v);
        };
        case (#mesh(_)) {
          let cur = switch (labourMesh.get(a.labourId)) { case (null) { 0.0 }; case (?x) { x } };
          labourMesh.add(a.labourId, cur + v);
        };
      };
    };

    // Step 3: Build salary breakdown for each labour using proportional formula
    let salaryMap = Map.empty<Nat, SalaryBreakdown>();

    // Collect unique labour IDs from attendance records
    for (a in contractAttendances.values()) {
      if (not salaryMap.containsKey(a.labourId)) {
        let labour = switch (labours.get(a.labourId)) {
          case (null) { Runtime.trap("Labour not found") };
          case (?l) { l };
        };
        let lb = switch (labourBed.get(a.labourId)) { case (null) { 0.0 }; case (?x) { x } };
        let lp = switch (labourPaper.get(a.labourId)) { case (null) { 0.0 }; case (?x) { x } };
        let lm = switch (labourMesh.get(a.labourId)) { case (null) { 0.0 }; case (?x) { x } };

        let bedS = if (totalBed > 0.0) { (lb / totalBed) * contract.bedAmount.toFloat() } else { 0.0 };
        let papS = if (totalPaper > 0.0) { (lp / totalPaper) * contract.paperAmount.toFloat() } else { 0.0 };
        let meshS = if (totalMesh > 0.0) { (lm / totalMesh) * contract.meshAmount.toFloat() } else { 0.0 };
        let totalSal = bedS + papS + meshS;

        salaryMap.add(a.labourId, {
          labourId = a.labourId;
          labourName = labour.name;
          bedSalary = bedS.toInt();
          paperSalary = papS.toInt();
          meshSalary = meshS.toInt();
          totalAttendanceSalary = totalSal.toInt();
          totalAdvances = 0;
          netSalary = 0;
        });
      };
    };

    // Step 4: Add advances per labour
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
      salaryMap.add(advance.labourId, { current with totalAdvances = current.totalAdvances + advance.amount });
    };

    // Step 5: Compute netSalary = totalAttendanceSalary - totalAdvances
    for (labourId in salaryMap.keys()) {
      let breakdown = switch (salaryMap.get(labourId)) {
        case (null) { Runtime.trap("Breakdown not found") };
        case (?b) { b };
      };
      salaryMap.add(labourId, { breakdown with netSalary = breakdown.totalAttendanceSalary - breakdown.totalAdvances });
    };

    salaryMap.values().toArray();
  };
};
