import { Workbook } from "../lib/api/types/snapshot.js";

class SnapshotManager {
  private snapshot: Workbook | null;

  constructor() {
    this.snapshot = null;
  }

  public setActiveSnapshot(newSnapshot: Workbook) {
    this.snapshot = newSnapshot;
  }

  public clearActiveSnapshot() {
    this.snapshot = null;
  }

  public getActiveSnapshot(): Workbook | null {
    return this.snapshot;
  }
}

// In-memory singleton for managing the current snapshot state in MCP
export const snapshotManager = new SnapshotManager();
