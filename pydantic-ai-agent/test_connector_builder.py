#!/usr/bin/env python3
"""
Test script for the Connector Builder Agent
"""

import asyncio
import os
from connector_builder.connector_builder_service import ConnectorBuilderService


async def test_connector_builder():
    """Test the connector builder agent"""

    # Set up environment variables for testing
    if not os.getenv("SCRATCHPAD_API_TOKEN"):
        print("⚠️ SCRATCHPAD_API_TOKEN not set. Please set it for testing.")
        return

    if not os.getenv("OPENROUTER_API_KEY"):
        print("⚠️ OPENROUTER_API_KEY not set. Please set it for testing.")
        return

    # Create the service
    service = ConnectorBuilderService()

    # Test parameters
    custom_connector_id = (
        "test-connector-id"  # You'll need to replace this with a real ID
    )
    message = (
        "Generate a listTables function for a REST API that lists available tables"
    )

    print(f"🧪 Testing connector builder agent...")
    print(f"📝 Message: {message}")
    print(f"🔗 Connector ID: {custom_connector_id}")

    try:
        # Process the request
        response = await service.process_connector_builder_request(
            message=message,
            custom_connector_id=custom_connector_id,
            api_token=None,  # Will use environment variable
            style_guides=None,
            model="openai/gpt-4o-mini",
            capabilities=None,
        )

        print(f"✅ Agent response received!")
        print(f"📄 Response message: {response.response_message}")
        print(f"📋 Response summary: {response.response_summary}")
        print(f"📝 Request summary: {response.request_summary}")

        if response.generated_function:
            print(f"🔧 Generated function: {response.generated_function}")
        if response.function_type:
            print(f"🏷️ Function type: {response.function_type}")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_connector_builder())
