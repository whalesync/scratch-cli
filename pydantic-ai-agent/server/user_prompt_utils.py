from typing import Dict, Any, List, Optional
from agents.data_agent.models import SnapshotForAi
from agents.data_agent.data_agent_utils import format_records_for_display


def build_snapshot_context(
    snapshot: SnapshotForAi,
    preloaded_records: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    filtered_counts: Optional[Dict[str, int]] = None
) -> str:
    """
    Build snapshot context string for inclusion in prompts.
    
    Args:
        snapshot: The snapshot data
        preloaded_records: Dictionary mapping table names to their records
        filtered_counts: Dictionary mapping table names to their filtered record counts
        
    Returns:
        Formatted snapshot context string
    """
    if not snapshot:
        return ""
    
    snapshot_context = f"\n\n-- CURRENT SNAPSHOT DATA START --\n"
    snapshot_context += f"Snapshot: {snapshot.name or snapshot.id}\n"
    snapshot_context += f"Tables: {len(snapshot.tables)}\n\n"
    
    for table in snapshot.tables:
        snapshot_context += f"TABLE: {table.name} (ID: {table.id.wsId})\n"
        snapshot_context += f"Columns: {[col.name for col in table.columns]}\n"
        
        # Add records if available
        if preloaded_records and table.name in preloaded_records:
            records = preloaded_records[table.name]
            snapshot_context += f"Records ({len(records)}):\n\n"
            
            # Add filtered records information if available
            if filtered_counts and table.name in filtered_counts:
                filtered_count = filtered_counts[table.name]
                if filtered_count > 0:
                    snapshot_context += f"Note: {filtered_count} records are currently filtered out and not shown in this list.\n\n"
            
            # Format records using the shared function
            records_summary = format_records_for_display(records, limit=50, truncate_record_content=False)
            snapshot_context += f"RECORDS:\n{records_summary}\n"
        else:
            snapshot_context += "Records: Not loaded\n"
        snapshot_context += "\n"
    
    snapshot_context += f"\n-- CURRENT SNAPSHOT DATA END --\n"
    
    return snapshot_context
