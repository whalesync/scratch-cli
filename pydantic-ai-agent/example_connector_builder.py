#!/usr/bin/env python3
"""
Example usage of the Connector Builder Agent
"""

import asyncio
import os
from connector_builder.connector_builder_service import ConnectorBuilderService


async def example_usage():
    """Example of how to use the connector builder agent"""

    # Check environment variables
    if not os.getenv("SCRATCHPAD_API_TOKEN"):
        print("⚠️ Please set SCRATCHPAD_API_TOKEN environment variable")
        return

    if not os.getenv("OPENROUTER_API_KEY"):
        print("⚠️ Please set OPENROUTER_API_KEY environment variable")
        return

    # Create the service
    service = ConnectorBuilderService()

    # Example 1: Generate and save a listTables function for a REST API
    print("🔧 Example 1: Generating and saving a listTables function for a REST API")
    print(
        "📝 Note: Test results will be saved to the 'tables' field of the custom connector"
    )

    response1 = await service.process_connector_builder_request(
        message="Generate a listTables function for a REST API that has endpoints like /api/tables or /api/databases. The API uses Bearer token authentication. Test the function and save the results.",
        custom_connector_id="example-connector-1",
        api_token=None,
        style_guides=None,
        model="openai/gpt-4o-mini",
        capabilities=None,
    )

    print(f"📄 Response: {response1.response_message}")
    if response1.generated_function:
        print(f"🔧 Generated function: {response1.generated_function}")
    if response1.function_type:
        print(f"🏷️ Function type: {response1.function_type}")

    print("\n" + "=" * 50 + "\n")

    # Example 2: Generate and save a listTables function for Airtable
    print("🔧 Example 2: Generating and saving a listTables function for Airtable")
    print(
        "📝 Note: Test results will be saved to the 'tables' field of the custom connector"
    )

    response2 = await service.process_connector_builder_request(
        message="Generate a listTables function for Airtable API. Airtable uses bases and tables, where bases contain multiple tables. The API key should be used in the Authorization header. Test the function and save the results.",
        custom_connector_id="example-connector-2",
        api_token=None,
        style_guides=None,
        model="openai/gpt-4o-mini",
        capabilities=None,
    )

    print(f"📄 Response: {response2.response_message}")
    if response2.generated_function:
        print(f"🔧 Generated function: {response2.generated_function}")
    if response2.function_type:
        print(f"🏷️ Function type: {response2.function_type}")

    print("\n" + "=" * 50 + "\n")

    # Example 3: Generate and save a listTables function for Notion
    print("🔧 Example 3: Generating and saving a listTables function for Notion")
    print(
        "📝 Note: Test results will be saved to the 'tables' field of the custom connector"
    )

    response3 = await service.process_connector_builder_request(
        message="Generate a listTables function for Notion API. Notion uses databases (which are like tables) and they are organized by pages. The API key should be used in the Authorization header. Test the function and save the results.",
        custom_connector_id="example-connector-3",
        api_token=None,
        style_guides=None,
        model="openai/gpt-4o-mini",
        capabilities=None,
    )

    print(f"📄 Response: {response3.response_message}")
    if response3.generated_function:
        print(f"🔧 Generated function: {response3.generated_function}")
    if response3.function_type:
        print(f"🏷️ Function type: {response3.function_type}")


if __name__ == "__main__":
    asyncio.run(example_usage())
