from logging import getLogger

from ast import Dict
import asyncio

myLogger = getLogger(__name__)


class AgentRunState:
    status: str
    run_id: str
    session_id: str

    def __init__(self, status: str, run_id: str, session_id: str):
        self.status = status
        self.run_id = run_id
        self.session_id = session_id


class AgentRunStateManager:
    """Threadsafe manager for agent run states to allow for external cancellation of runs"""

    def __init__(self):
        self._run_status_map: Dict[str, AgentRunState] = {}
        self._lock = asyncio.Lock()

    async def start_run(self, session_id: str, run_id: str) -> None:
        """Create a new run state"""
        async with self._lock:
            self._run_status_map[run_id] = AgentRunState(
                status="running",
                run_id=run_id,
                session_id=session_id,
            )

    async def cancel_run(self, run_id: str) -> None:
        """Cancel a run"""
        async with self._lock:
            run_state = self._run_status_map.get(run_id)
            if run_state:
                run_state.status = "cancelled"

    async def delete_run(self, run_id: str) -> None:
        """Delete a run state"""
        async with self._lock:
            if run_id in self._run_status_map:
                del self._run_status_map[run_id]
            else:
                myLogger.warning(f"❌ Run {run_id} not found in run state map")

    async def complete_run(self, run_id: str) -> None:
        """Complete a run"""
        async with self._lock:
            run_state = self._run_status_map.get(run_id)
            if run_state:
                run_state.status = "completed"

    async def is_cancelled(self, run_id: str) -> bool:
        """Check if a run is cancelled"""
        async with self._lock:
            run_state = self._run_status_map.get(run_id)
            if run_state:
                return run_state.status == "cancelled"
            return False

    async def exists(self, session_id: str, run_id: str) -> bool:
        """Check if a run exists"""
        async with self._lock:
            run_state = self._run_status_map.get(run_id)
            if run_state:
                return run_state.session_id == session_id
            return False
