import Map "mo:core/Map";
import Types "types";
import ContractLib "lib/ContractLib";
import LabourLib "lib/LabourLib";
import AdvanceLib "lib/AdvanceLib";
import AttendanceLib "lib/AttendanceLib";
import GroupLib "lib/GroupLib";
import NotesHolidaysLib "lib/NotesHolidaysLib";

actor {
  // Admin credentials
  var adminToken : ?Text = null;
  var adminPassword : ?Text = null;

  // ID counters
  var groupCounter = 0;
  var labourCounter = 0;
  var contractCounter = 0;
  var attendanceCounter = 0;
  var advanceCounter = 0;
  var noteCounter = 0;
  var holidayCounter = 0;

  // State
  let labours = Map.empty<Nat, Types.LabourStorage>();
  let labourGroups = Map.empty<Nat, Nat>();
  let labourActiveMap = Map.empty<Nat, Bool>();
  let groups = Map.empty<Nat, Types.Group>();
  let contracts = Map.empty<Nat, Types.ContractV1>();
  let attendances = Map.empty<Nat, Types.Attendance>();
  let advances = Map.empty<Nat, Types.AdvanceV1>();
  let attendanceNotes = Map.empty<Nat, Types.AttendanceNote>();
  let holidays = Map.empty<Nat, Types.Holiday>();
  let workingTodayMap = Map.empty<Nat, Types.WorkingTodayEntry>();

  // Extra fields stored separately for migration-safe new fields
  let contractCreatedAt = Map.empty<Nat, Text>();
  let contractSettledAt = Map.empty<Nat, Text>();
  let advanceTimestamps = Map.empty<Nat, Text>();

  // --- Group CRUD ---
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

  // --- Labour CRUD ---
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

  // --- Contract CRUD ---
  public shared ({ caller }) func createContract(
    name : Text,
    multiplierValue : Float,
    contractAmount : Int,
    machineExp : Int,
    bedAmount : ?Int,
    paperAmount : ?Int,
    meshColumns : [Text],
    createdAt : Text
  ) : async Nat {
    let id = ContractLib.create(
      contracts, contractCreatedAt, contractCounter,
      name, multiplierValue, contractAmount, machineExp,
      bedAmount, paperAmount, meshColumns, createdAt
    );
    contractCounter += 1;
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
    ContractLib.update(contracts, id, name, multiplierValue, contractAmount, machineExp, bedAmount, paperAmount, meshColumns);
  };

  public shared ({ caller }) func settleContract(id : Nat, settledAt : Text) : async () {
    ContractLib.settle(contracts, contractSettledAt, id, settledAt);
  };

  public shared ({ caller }) func unsettleContract(id : Nat) : async () {
    ContractLib.unsettle(contracts, contractSettledAt, id);
  };

  public shared ({ caller }) func deleteContract(id : Nat) : async () {
    ContractLib.deleteContract(contracts, contractCreatedAt, contractSettledAt, id);
  };

  public query ({ caller }) func getAllContracts() : async [Types.Contract] {
    ContractLib.getAll(contracts, contractCreatedAt, contractSettledAt);
  };

  public query ({ caller }) func getContract(id : Nat) : async Types.Contract {
    ContractLib.getOne(contracts, contractCreatedAt, contractSettledAt, id);
  };

  public query ({ caller }) func getActivityLog() : async [Types.ActivityLogEntry] {
    ContractLib.getActivityLog(contracts, contractCreatedAt, contractSettledAt);
  };

  // --- Attendance ---
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

  // --- Advances ---
  public shared ({ caller }) func createAdvance(contractId : Nat, labourId : Nat, amount : Int, note : Text, timestamp : Text) : async Nat {
    let id = AdvanceLib.create(advances, advanceTimestamps, contracts, labours, advanceCounter, contractId, labourId, amount, note, timestamp);
    advanceCounter += 1;
    id;
  };

  public shared ({ caller }) func updateAdvance(id : Nat, amount : Int, note : Text) : async () {
    AdvanceLib.update(advances, id, amount, note);
  };

  public shared ({ caller }) func deleteAdvance(id : Nat) : async () {
    AdvanceLib.deleteAdvance(advances, advanceTimestamps, id);
  };

  public query ({ caller }) func getAdvancesByLabour(labourId : Nat) : async [Types.Advance] {
    AdvanceLib.getByLabour(advances, advanceTimestamps, labourId);
  };

  public query ({ caller }) func getAdvancesByContract(contractId : Nat) : async [Types.Advance] {
    AdvanceLib.getByContract(advances, advanceTimestamps, contractId);
  };

  public query ({ caller }) func getAllAdvances() : async [Types.Advance] {
    AdvanceLib.getAll(advances, advanceTimestamps);
  };

  // --- Attendance Notes ---
  public shared ({ caller }) func saveAttendanceNote(contractId : Nat, labourId : Nat, note : Text) : async Nat {
    let (id, newCounter) = NotesHolidaysLib.saveNote(attendanceNotes, contracts, labours, noteCounter, contractId, labourId, note);
    noteCounter := newCounter;
    id;
  };

  public query ({ caller }) func getNotesByContract(contractId : Nat) : async [Types.AttendanceNote] {
    NotesHolidaysLib.getNotesByContract(attendanceNotes, contractId);
  };

  // --- Holidays ---
  public shared ({ caller }) func markHoliday(contractId : Nat, columnKey : Text) : async Nat {
    let (id, newCounter) = NotesHolidaysLib.markHoliday(holidays, contracts, holidayCounter, contractId, columnKey);
    holidayCounter := newCounter;
    id;
  };

  public shared ({ caller }) func removeHoliday(contractId : Nat, columnKey : Text) : async () {
    NotesHolidaysLib.removeHoliday(holidays, contracts, contractId, columnKey);
  };

  public query ({ caller }) func getHolidaysByContract(contractId : Nat) : async [Types.Holiday] {
    NotesHolidaysLib.getHolidaysByContract(holidays, contractId);
  };

  // --- Admin credential management ---
  public query func hasAdminCredentials() : async Bool {
    switch (adminToken, adminPassword) {
      case (?_, ?_) { true };
      case _ { false };
    };
  };

  public shared func setAdminCredentials(token : Text, password : Text) : async Bool {
    switch (adminToken) {
      case (?_) { false };
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

  // --- Working Today tracking ---
  public shared func recordWorkingToday(contractId : Nat, count : Nat, ts : Text) : async () {
    workingTodayMap.add(contractId, { ts; count });
  };

  public query func getWorkingTodayMap() : async [(Nat, Types.WorkingTodayEntry)] {
    workingTodayMap.entries().toArray();
  };
};
