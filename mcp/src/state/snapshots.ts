import { Snapshot } from "../lib/api/types/snapshot.js";

class SnapshotManager {
  private snapshot: Snapshot | null;

  constructor() {
    this.snapshot = null;
  }

  public setActiveSnapshot(newSnapshot: Snapshot) {
    this.snapshot = newSnapshot;
  }

  public clearActiveSnapshot() {
    this.snapshot = null;
  }

  public getActiveSnapshot(): Snapshot | null {
    return this.snapshot;
  }
}

// In-memory singleton for managing the current snapshot state in MCP
export const snapshotManager = new SnapshotManager();
