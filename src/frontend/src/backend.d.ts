import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Labour {
    id: bigint;
    name: string;
    phone?: string;
}
export type ColumnType = {
    __kind__: "bed";
    bed: null;
} | {
    __kind__: "mesh";
    mesh: bigint;
} | {
    __kind__: "paper";
    paper: null;
};
export interface Contract {
    id: bigint;
    isSettled: boolean;
    name: string;
    machineExp: bigint;
    meshColumns: Array<string>;
    bedAmount: bigint;
    paperAmount: bigint;
    meshAmount: bigint;
    contractAmount: bigint;
    multiplierValue: number;
}
export interface SalaryBreakdown {
    meshSalary: bigint;
    totalAttendanceSalary: bigint;
    labourId: bigint;
    netSalary: bigint;
    totalAdvances: bigint;
    labourName: string;
    bedSalary: bigint;
    paperSalary: bigint;
}
export interface Attendance {
    id: bigint;
    columnType: ColumnType;
    value: string;
    labourId: bigint;
    contractId: bigint;
}
export interface Advance {
    id: bigint;
    note: string;
    labourId: bigint;
    amount: bigint;
    contractId: bigint;
}
export interface backendInterface {
    calculateNetSalaries(contractId: bigint): Promise<Array<SalaryBreakdown>>;
    createAdvance(contractId: bigint, labourId: bigint, amount: bigint, note: string): Promise<bigint>;
    createContract(name: string, multiplierValue: number, contractAmount: bigint, machineExp: bigint, bedAmount: bigint | null, paperAmount: bigint | null, meshColumns: Array<string>): Promise<bigint>;
    createLabour(name: string, phone: string | null): Promise<bigint>;
    deleteContract(id: bigint): Promise<void>;
    getAdvancesByContract(contractId: bigint): Promise<Array<Advance>>;
    getAdvancesByLabour(labourId: bigint): Promise<Array<Advance>>;
    getAllContracts(): Promise<Array<Contract>>;
    getAllLabours(): Promise<Array<Labour>>;
    getAttendanceByContract(contractId: bigint): Promise<Array<Attendance>>;
    getContract(id: bigint): Promise<Contract>;
    saveAttendance(contractId: bigint, labourId: bigint, columnType: ColumnType, value: string): Promise<bigint>;
    settleContract(id: bigint): Promise<void>;
    unsettleContract(id: bigint): Promise<void>;
    updateContract(id: bigint, name: string, multiplierValue: number, contractAmount: bigint, machineExp: bigint, bedAmount: bigint | null, paperAmount: bigint | null, meshColumns: Array<string>): Promise<void>;
    updateLabour(id: bigint, name: string, phone: string | null): Promise<void>;
}
