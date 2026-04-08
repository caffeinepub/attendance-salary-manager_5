import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Types "../types";

module {
  public func save(
    attendances : Map.Map<Nat, Types.Attendance>,
    contracts : Map.Map<Nat, Types.ContractV1>,
    labours : Map.Map<Nat, Types.LabourStorage>,
    counter : Nat,
    contractId : Nat,
    labourId : Nat,
    columnType : Types.ColumnType,
    value : Text
  ) : Nat {
    if (not contracts.containsKey(contractId)) { Runtime.trap("Contract not found") };
    if (not labours.containsKey(labourId)) { Runtime.trap("Labour not found") };
    let id = counter;
    let attendance : Types.Attendance = { id; contractId; labourId; columnType; value };
    attendances.add(id, attendance);
    id;
  };

  public func getByContract(
    attendances : Map.Map<Nat, Types.Attendance>,
    contractId : Nat
  ) : [Types.Attendance] {
    attendances.values().toArray()
      .filter(func(a : Types.Attendance) : Bool { a.contractId == contractId });
  };

  public func calculateNetSalaries(
    attendances : Map.Map<Nat, Types.Attendance>,
    advances : Map.Map<Nat, Types.AdvanceV1>,
    contracts : Map.Map<Nat, Types.ContractV1>,
    labours : Map.Map<Nat, Types.LabourStorage>,
    contractId : Nat
  ) : [Types.SalaryBreakdown] {
    let contract = switch (contracts.get(contractId)) {
      case (null) { Runtime.trap("Contract not found") };
      case (?c) { c };
    };

    let contractAttendances = attendances.values().toArray()
      .filter(func(a : Types.Attendance) : Bool { a.contractId == contractId });
    let contractAdvances = advances.values().toArray()
      .filter(func(a : Types.AdvanceV1) : Bool { a.contractId == contractId });

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

    let salaryMap = Map.empty<Nat, Types.SalaryBreakdown>();

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
};
