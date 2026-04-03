import Map "mo:core/Map";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";



actor {
  // Data Types
  type Group = {
    id : Nat;
    name : Text;
  };

  type LabourStorage = {
    id : Nat;
    name : Text;
    phone : ?Text;
  };

  type Labour = {
    id : Nat;
    name : Text;
    phone : ?Text;
    groupId : ?Nat;
    isActive : Bool;
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

  type AttendanceNote = {
    id : Nat;
    contractId : Nat;
    labourId : Nat;
    note : Text;
  };

  type Holiday = {
    id : Nat;
    contractId : Nat;
    columnKey : Text;
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

  // Admin Credentials
  var adminToken : ?Text = null;
  var adminPassword : ?Text = null;

  // ID Counters
  var groupCounter = 0;
  var labourCounter = 0;
  var contractCounter = 0;
  var attendanceCounter = 0;
  var advanceCounter = 0;
  var noteCounter = 0;
  var holidayCounter = 0;

  // Persistent Maps
  let labours = Map.empty<Nat, LabourStorage>();
  let labourGroups = Map.empty<Nat, Nat>();
  let labourActiveMap = Map.empty<Nat, Bool>();
  let groups = Map.empty<Nat, Group>();
  let contracts = Map.empty<Nat, Contract>();
  let attendances = Map.empty<Nat, Attendance>();
  let advances = Map.empty<Nat, Advance>();
  let attendanceNotes = Map.empty<Nat, AttendanceNote>();
  let holidays = Map.empty<Nat, Holiday>();
  // Working Today: contractId -> { ts: Text; count: Nat }
  type WorkingTodayEntry = { ts : Text; count : Nat };
  let workingTodayMap = Map.empty<Nat, WorkingTodayEntry>();

  // Group CRUD
  public shared ({ caller }) func createGroup(name : Text) : async Nat {
    for (g in groups.values()) {
      if (g.name == name) { Runtime.trap("Group name already exists") };
    };
    let id = groupCounter;
    groupCounter += 1;
    groups.add(id, { id; name });
    id;
  };

  public shared ({ caller }) func deleteGroup(id : Nat) : async () {
    groups.remove(id);
  };

  public query ({ caller }) func getAllGroups() : async [Group] {
    groups.values().toArray();
  };

  // Labour CRUD
  public shared ({ caller }) func createLabour(name : Text, phone : ?Text, groupId : ?Nat) : async Nat {
    let id = labourCounter;
    labourCounter += 1;
    let labour : LabourStorage = { id; name; phone };
    labours.add(id, labour);
    labourActiveMap.add(id, true);
    switch (groupId) {
      case (null) {};
      case (?gid) { labourGroups.add(id, gid) };
    };
    id;
  };

  public shared ({ caller }) func updateLabour(id : Nat, name : Text, phone : ?Text, groupId : ?Nat) : async () {
    switch (labours.get(id)) {
      case (null) { Runtime.trap("Labour not found") };
      case (?_) {
        let labour : LabourStorage = { id; name; phone };
        labours.add(id, labour);
        switch (groupId) {
          case (null) { labourGroups.remove(id) };
          case (?gid) { labourGroups.add(id, gid) };
        };
      };
    };
  };

  public shared ({ caller }) func setLabourActive(id : Nat, active : Bool) : async () {
    switch (labours.get(id)) {
      case (null) { Runtime.trap("Labour not found") };
      case (?_) { labourActiveMap.add(id, active) };
    };
  };

  public shared ({ caller }) func deleteLabour(id : Nat) : async () {
    labours.remove(id);
    labourGroups.remove(id);
    labourActiveMap.remove(id);
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

  public shared ({ caller }) func deleteAdvance(id : Nat) : async () {
    advances.remove(id);
  };

  public shared ({ caller }) func updateAdvance(id : Nat, amount : Int, note : Text) : async () {
    switch (advances.get(id)) {
      case (null) { Runtime.trap("Advance not found") };
      case (?adv) {
        advances.add(id, { adv with amount; note });
      };
    };
  };

  // Attendance Notes
  public shared ({ caller }) func saveAttendanceNote(contractId : Nat, labourId : Nat, note : Text) : async Nat {
    if (not contracts.containsKey(contractId)) { Runtime.trap("Contract not found") };
    if (not labours.containsKey(labourId)) { Runtime.trap("Labour not found") };

    // Check if note already exists for (contractId, labourId)
    let existing = attendanceNotes.values().find(
      func(n) { n.contractId == contractId and n.labourId == labourId }
    );

    let id = switch (existing) {
      case (null) {
        let newId = noteCounter;
        noteCounter += 1;
        newId;
      };
      case (?n) { n.id };
    };

    let attendanceNote : AttendanceNote = {
      id;
      contractId;
      labourId;
      note;
    };

    attendanceNotes.add(id, attendanceNote);
    id;
  };

  public query ({ caller }) func getNotesByContract(contractId : Nat) : async [AttendanceNote] {
    attendanceNotes.values().toArray().filter(
      func(a) { a.contractId == contractId }
    );
  };

  // Holidays
  public shared ({ caller }) func markHoliday(contractId : Nat, columnKey : Text) : async Nat {
    if (not contracts.containsKey(contractId)) { Runtime.trap("Contract not found") };

    // Check if holiday already exists
    let existing = holidays.values().find(
      func(h) { h.contractId == contractId and h.columnKey == columnKey }
    );

    switch (existing) {
      case (?h) { h.id };
      case (null) {
        let id = holidayCounter;
        holidayCounter += 1;

        let holiday : Holiday = {
          id;
          contractId;
          columnKey;
        };
        holidays.add(id, holiday);
        id;
      };
    };
  };

  public shared ({ caller }) func removeHoliday(contractId : Nat, columnKey : Text) : async () {
    if (not contracts.containsKey(contractId)) { Runtime.trap("Contract not found") };

    // Find holiday and remove by key for contractId + columnKey
    let toRemove = holidays.keys().toArray().filter(
      func(k) {
        switch (holidays.get(k)) {
          case (null) { false };
          case (?h) { h.contractId == contractId and h.columnKey == columnKey };
        };
      }
    );
    for (id in toRemove.values()) { holidays.remove(id) };
  };

  public query ({ caller }) func getHolidaysByContract(contractId : Nat) : async [Holiday] {
    holidays.values().toArray().filter(
      func(a) { a.contractId == contractId }
    );
  };

  // Queries
  public query ({ caller }) func getAllLabours() : async [Labour] {
    labours.values().toArray().map(func(s : LabourStorage) : Labour {
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

  public query ({ caller }) func getAllAdvances() : async [Advance] {
    advances.values().toArray();
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

    let salaryMap = Map.empty<Nat, SalaryBreakdown>();

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

    for (labourId in salaryMap.keys()) {
      let breakdown = switch (salaryMap.get(labourId)) {
        case (null) { Runtime.trap("Breakdown not found") };
        case (?b) { b };
      };
      salaryMap.add(labourId, { breakdown with netSalary = breakdown.totalAttendanceSalary - breakdown.totalAdvances });
    };

    salaryMap.values().toArray();
  };

  // Admin credential management
  public query func hasAdminCredentials() : async Bool {
    switch (adminToken, adminPassword) {
      case (?_, ?_) { true };
      case _ { false };
    };
  };

  public shared func setAdminCredentials(token : Text, password : Text) : async Bool {
    switch (adminToken) {
      case (?_) { false }; // already set
      case null {
        adminToken := ?token;
        adminPassword := ?password;
        true;
      };
    };
  };

  public shared func verifyAdminCredentials(token : Text, password : Text) : async Bool {
    switch (adminToken, adminPassword) {
      case (?t, ?p) { t == token and p == password };
      case _ { false };
    };
  };

  public shared func changeAdminCredentials(oldToken : Text, oldPassword : Text, newToken : Text, newPassword : Text) : async Bool {
    switch (adminToken, adminPassword) {
      case (?t, ?p) {
        if (t == oldToken and p == oldPassword) {
          adminToken := ?newToken;
          adminPassword := ?newPassword;
          true;
        } else { false };
      };
      case _ { false };
    };
  };

  // Working Today tracking
  public shared func recordWorkingToday(contractId : Nat, count : Nat, ts : Text) : async () {
    workingTodayMap.add(contractId, { ts; count });
  };

  public query func getWorkingTodayMap() : async [(Nat, WorkingTodayEntry)] {
    workingTodayMap.entries().toArray();
  };
};
