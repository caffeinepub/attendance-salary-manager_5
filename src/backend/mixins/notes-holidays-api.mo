import Map "mo:core/Map";
import Types "../types";
import NotesHolidaysLib "../lib/NotesHolidaysLib";

mixin (
  attendanceNotes : Map.Map<Nat, Types.AttendanceNote>,
  holidays : Map.Map<Nat, Types.Holiday>,
  contracts : Map.Map<Nat, Types.ContractV1>,
  labours : Map.Map<Nat, Types.LabourStorage>,
  noteCounter : Nat,
  holidayCounter : Nat
) {
  public shared ({ caller }) func saveAttendanceNote(contractId : Nat, labourId : Nat, note : Text) : async Nat {
    let (id, newCounter) = NotesHolidaysLib.saveNote(attendanceNotes, contracts, labours, noteCounter, contractId, labourId, note);
    noteCounter := newCounter;
    id;
  };

  public query ({ caller }) func getNotesByContract(contractId : Nat) : async [Types.AttendanceNote] {
    NotesHolidaysLib.getNotesByContract(attendanceNotes, contractId);
  };

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
};
