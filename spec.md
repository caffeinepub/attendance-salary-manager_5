# Attendance & Salary Manager

## Current State
Full-stack attendance and salary management app. The backend has been updated to include `createdAt` in `createContract`, `settledAt` in `settleContract`, and `timestamp` in `createAdvance`. However, the `backend.ts` wrapper and some `App.tsx` call sites were never updated to match, causing runtime failures for all three operations.

## Requested Changes (Diff)

### Add
- Nothing new added.

### Modify
- `backend.ts` interface `backendInterface`: Update `createAdvance` to include `timestamp: string` param, `createContract` to include `createdAt: string` param, `settleContract` to include `settledAt: string` param.
- `backend.ts` class `Backend`: Update `createAdvance`, `createContract`, and `settleContract` method implementations to pass the new arguments to the actor.
- `App.tsx` `doRestore`: Add `new Date().toISOString()` as 8th argument to `createContract`.
- `App.tsx` `processImportCsv`: Add `new Date().toISOString()` as 8th argument to `createContract`.
- `App.tsx` login page background: Change from light purple-indigo-blue gradient to deep dark navy/purple gradient.

### Remove
- Nothing removed.

## Implementation Plan
1. Fix `backend.ts` interface signatures for `createAdvance`, `createContract`, `settleContract`
2. Fix `backend.ts` method implementations to pass new args to actor
3. Fix `App.tsx` `doRestore` and `processImportCsv` calls
4. Update login background color
5. Validate and deploy
