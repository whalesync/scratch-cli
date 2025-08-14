#!/usr/bin/env python3
"""
FastAPI Endpoints for Health Check
"""

from fastapi import APIRouter
from logging import getLogger
from datetime import datetime

logger = getLogger(__name__)

# Create router
router = APIRouter(tags=["admin"])


@router.get("/")
async def root():
    return {"server": "Scratchpad AI Agent", "version": "1.0.0"}


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "alive",
        "timestamp": datetime.now().isoformat(),
        "service": "scratchpad-ai-agent",
    }
