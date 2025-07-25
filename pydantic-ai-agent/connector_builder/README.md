# Connector Builder Agent

This module provides an AI agent for generating and testing custom connector functions for external APIs.

## Overview

The Connector Builder Agent helps users create JavaScript functions for custom connectors that can interact with external APIs. It can generate functions for:

- `listTables`: Lists available tables/databases from the API
- `fetchSchema`: Fetches the schema/structure of a specific table
- `pollRecords`: Retrieves records from a table
- `createRecord`: Creates a new record in a table
- `updateRecord`: Updates an existing record
- `deleteRecord`: Deletes a record from a table
- `getRecord`: Retrieves a specific record by ID

## Key Features

The agent **generates functions directly** using the LLM and **saves them to the custom connector**, replacing the need for the existing NestJS endpoints.

### What the Agent Does:

1. **Loads Custom Connector Data**: Retrieves the current custom connector from the Scratchpad server
2. **Generates Functions**: Uses the LLM to generate JavaScript functions based on user requests
3. **Tests Functions**: Executes generated functions to verify they work correctly
4. **Saves Functions**: Updates the custom connector with the new function code
5. **Provides Feedback**: Gives detailed responses about what was generated and tested

## Architecture

The module follows the same pattern as the data agent:

```
connector_builder/
├── __init__.py                    # Package exports
├── agent.py                       # Main agent creation
├── models.py                      # Pydantic models
├── connector_builder_prompts.py   # System prompts
├── connector_builder_tools.py     # Agent tools
├── connector_builder_utils.py     # Utility functions
├── connector_builder_service.py   # Service layer
├── connector_builder_controller.py # FastAPI controller
├── DTOs.py                        # Request/response DTOs
└── README.md                      # This file
```

## Usage

### API Endpoint

The agent is exposed via a FastAPI endpoint:

```
POST /connector-builder/process
```

Request body:

```json
{
  "message": "Generate a listTables function for my API",
  "custom_connector_id": "your-connector-id",
  "api_token": "optional-api-token",
  "style_guides": [],
  "capabilities": [],
  "model": "openai/gpt-4o-mini"
}
```

Response:

```json
{
  "response_message": "I've generated and tested a listTables function for you...",
  "response_summary": "Generated and saved listTables function",
  "request_summary": "User requested listTables function",
  "generated_function": "async function listTables(apiKey) { ... }",
  "function_type": "listTables"
}
```

### Programmatic Usage

```python
from connector_builder.connector_builder_service import ConnectorBuilderService

service = ConnectorBuilderService()
response = await service.process_connector_builder_request(
    message="Generate a listTables function for Airtable API",
    custom_connector_id="your-connector-id",
    api_token="your-api-token"
)
```

## Tools

The agent has access to the following tools:

- `execute_list_tables_tool`: Tests generated listTables functions by calling the Scratchpad server
- `save_custom_connector_tool`: Saves generated functions to the custom connector
- `save_custom_connector_with_test_result_tool`: Saves generated functions and test results to the custom connector

## Testing and Result Persistence

Each function type can be tested, and some test results can be persisted to the custom connector:

### Functions with Persistent Test Results:

- **listTables**: Test results can be saved to the `tables` field of the custom connector
- **fetchSchema**: Test results can be saved to the `schema` field (tests fetching schema for 1 table from listTables)
- **pollRecords**: Test results can be saved to the `pollRecordsResponse` field (polls records for 1 selected test table)
- **getRecord**: Test results can be saved to the `getRecordResponse` field

### Functions with Test Execution Only:

- **createRecord**: Can be tested but results are not persisted
- **updateRecord**: Can be tested but results are not persisted
- **deleteRecord**: Can be tested but results are not persisted

### Testing Workflow:

1. Generate the function based on user requirements
2. Test the function using available tools
3. If the test is successful:
   - Save the function code and test result (if applicable) using `save_custom_connector_with_test_result_tool`
   - For functions without persistent results, save only the function code
4. If the test fails, save only the function code using `save_custom_connector_tool`
5. Provide feedback about the generation and testing process

### Testing Dependencies:

- `fetchSchema` tests depend on having a valid table from `listTables`
- `pollRecords` tests depend on having a valid table from `listTables`
- `getRecord` tests depend on having valid records from `pollRecords`
- Other functions can be tested independently

## Function Generation

The agent generates functions using detailed prompts that include:

### listTables Function Requirements:

- **Function Structure**: `async function listTables(apiKey) { ... }`
- **Return Format**: Array of objects with `{ id: string[], displayName: string }`
- **Service Types**: Handles both opinionated schema (CRMs) and flexible schema (spreadsheet-like) services
- **Authentication**: Uses Bearer token authentication
- **Error Handling**: Includes proper error handling for non-2xx responses
- **Multi-account Support**: Handles services with multiple bases/accounts

### Example Generated Function:

```javascript
async function listTables(apiKey) {
  const response = await fetch("https://api.example.com/tables", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tables: ${response.statusText}`);
  }

  const data = await response.json();
  const tables = data.tables || data.bases || data;

  return tables.map((table) => ({
    id: [table.baseId || table.id, table.tableId || table.name],
    displayName: table.name || table.displayName || table.title,
  }));
}
```

## Environment Variables

Required environment variables:

- `OPENROUTER_API_KEY`: API key for OpenRouter (for LLM access)
- `SCRATCHPAD_API_TOKEN`: API token for Scratchpad server
- `SCRATCHPAD_API_URL`: URL of the Scratchpad server (defaults to http://localhost:3001)

## Testing

Run the test script:

```bash
cd pydantic-ai-agent
python test_connector_builder.py
```

Run the example script:

```bash
python example_connector_builder.py
```

Make sure to set the required environment variables before running the tests.

## Integration

The connector builder agent is integrated into the main FastAPI server and can be accessed via the `/connector-builder` prefix. It follows the same patterns as the existing chat server for consistency.

## Migration from NestJS Endpoints

This agent replaces the existing custom-connector-builder endpoints in the NestJS server:

- **Before**: Functions were generated via `/rest/custom-connector-builder/generate-list-tables`
- **After**: Functions are generated directly by the agent and saved to the custom connector

The agent provides a more intelligent and integrated approach to function generation, testing, and saving.
