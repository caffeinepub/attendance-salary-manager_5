import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Types "../types";

module {
  public func saveNote(
    attendanceNotes : Map.Map<Nat, Types.AttendanceNote>,
    contracts : Map.Map<Nat, Types.ContractV1>,
    labours : Map.Map<Nat, Types.LabourStorage>,
    counter : Nat,
    contractId : Nat,
    labourId : Nat,
    note : Text
  ) : (Nat, Nat) {
    // Returns (id, newCounter)
    if (not contracts.containsKey(contractId)) { Runtime.trap("Contract not found") };
    if (not labours.containsKey(labourId)) { Runtime.trap("Labour not found") };

    let existing = attendanceNotes.values().find(
      func(n : Types.AttendanceNote) : Bool { n.contractId == contractId and n.labourId == labourId }
    );

    let (id, newCounter) = switch (existing) {
      case (null) { (counter, counter + 1) };
      case (?n) { (n.id, counter) };
    };

    let attendanceNote : Types.AttendanceNote = { id; contractId; labourId; note };
    attendanceNotes.add(id, attendanceNote);
    (id, newCounter);
  };

  public func getNotesByContract(
    attendanceNotes : Map.Map<Nat, Types.AttendanceNote>,
    contractId : Nat
  ) : [Types.AttendanceNote] {
    attendanceNotes.values().toArray()
      .filter(func(a : Types.AttendanceNote) : Bool { a.contractId == contractId });
  };

  public func markHoliday(
    holidays : Map.Map<Nat, Types.Holiday>,
    contracts : Map.Map<Nat, Types.ContractV1>,
    counter : Nat,
    contractId : Nat,
    columnKey : Text
  ) : (Nat, Nat) {
    // Returns (id, newCounter)
    if (not contracts.containsKey(contractId)) { Runtime.trap("Contract not found") };

    let existing = holidays.values().find(
      func(h : Types.Holiday) : Bool { h.contractId == contractId and h.columnKey == columnKey }
    );

    switch (existing) {
      case (?h) { (h.id, counter) };
      case (null) {
        let id = counter;
        let holiday : Types.Holiday = { id; contractId; columnKey };
        holidays.add(id, holiday);
        (id, counter + 1);
      };
    };
  };

  public func removeHoliday(
    holidays : Map.Map<Nat, Types.Holiday>,
    contracts : Map.Map<Nat, Types.ContractV1>,
    contractId : Nat,
    columnKey : Text
  ) {
    if (not contracts.containsKey(contractId)) { Runtime.trap("Contract not found") };

    let toRemove = holidays.keys().toArray().filter(
      func(k : Nat) : Bool {
        switch (holidays.get(k)) {
          case (null) { false };
          case (?h) { h.contractId == contractId and h.columnKey == columnKey };
        };
      }
    );
    for (id in toRemove.values()) { holidays.remove(id) };
  };

  public func getHolidaysByContract(
    holidays : Map.Map<Nat, Types.Holiday>,
    contractId : Nat
  ) : [Types.Holiday] {
    holidays.values().toArray()
      .filter(func(a : Types.Holiday) : Bool { a.contractId == contractId });
  };
};
