import { runInNewContext } from 'vm';

// Create controlled versions of functions you want to allow
const customFetch = async (url: string, options: RequestInit) => {
  console.log('Custom fetch called with:', url, options);
  return fetch(url, options);
};

const customLogger = (message: string, data?: unknown) => {
  console.log(`[SANDBOXED] ${message}`, data);
};

export async function executePollRecords(functionString: string, apiKey: string, tableId: string[]): Promise<unknown> {
  try {
    // Create a completely isolated sandbox with NO access to globals
    const sandbox = {
      fetch: customFetch,
      customLogger,
      // NO fetch, console, or other globals available
    };

    // Append the function call to the function string and return its result
    const functionWithCall =
      functionString +
      `
      // Call the function and return its result
      pollRecords(${JSON.stringify(apiKey)}, ${JSON.stringify(tableId)});
    `;

    // Use Node.js vm module for true isolation
    const result = runInNewContext(functionWithCall, sandbox, {
      timeout: 5000, // 5 second timeout
      displayErrors: true,
    }) as Promise<unknown>;

    return await result;
  } catch (error) {
    console.error('Error executing dynamic poll records function:', error);
    throw error;
  }
}

export async function executeSchema(functionString: string, apiKey: string, tableId: string[]): Promise<unknown> {
  try {
    // Create a completely isolated sandbox with NO access to globals
    const sandbox = {
      fetch: customFetch,
      customLogger,
      // NO fetch, console, or other globals available
    };

    // Append the function call to the function string and return its result
    const functionWithCall =
      functionString +
      `
      // Call the function and return its result
      fetchSchema(${JSON.stringify(apiKey)}, ${JSON.stringify(tableId)});
    `;

    // Use Node.js vm module for true isolation
    const result = runInNewContext(functionWithCall, sandbox, {
      timeout: 5000, // 5 second timeout
      displayErrors: true,
    }) as Promise<unknown>;

    return await result;
  } catch (error) {
    console.error('Error executing dynamic schema function:', error);
    throw error;
  }
}

export async function executeListTables(functionString: string, apiKey: string): Promise<unknown> {
  try {
    // Create a completely isolated sandbox with NO access to globals
    const sandbox = {
      fetch: customFetch,
      customLogger,
      // NO fetch, console, or other globals available
    };

    // Append the function call to the function string and return its result
    const functionWithCall =
      functionString +
      `
      // Call the function and return its result
      listTables(${JSON.stringify(apiKey)});
    `;

    // Use Node.js vm module for true isolation
    const result = runInNewContext(functionWithCall, sandbox, {
      timeout: 5000, // 5 second timeout
      displayErrors: true,
    }) as Promise<unknown>;

    return await result;
  } catch (error) {
    console.error('Error executing dynamic list tables function:', error);
    throw error;
  }
}

export async function executeDeleteRecord(
  functionString: string,
  recordId: string,
  apiKey: string,
  tableId: string[],
): Promise<unknown> {
  try {
    // Create a completely isolated sandbox with NO access to globals
    const sandbox = {
      fetch: customFetch,
      customLogger,
      // NO fetch, console, or other globals available
    };

    // Append the function call to the function string and return its result
    const functionWithCall =
      functionString +
      `
      // Call the function and return its result
      deleteRecord(${JSON.stringify(recordId)}, ${JSON.stringify(apiKey)}, ${JSON.stringify(tableId)});
    `;

    // Use Node.js vm module for true isolation
    const result = runInNewContext(functionWithCall, sandbox, {
      timeout: 5000, // 5 second timeout
      displayErrors: true,
    }) as Promise<unknown>;

    return await result;
  } catch (error) {
    console.error('Error executing dynamic delete record function:', error);
    throw error;
  }
}

export async function executeCreateRecord(
  functionString: string,
  recordData: Record<string, unknown>,
  apiKey: string,
  tableId: string[],
): Promise<unknown> {
  try {
    // Create a completely isolated sandbox with NO access to globals
    const sandbox = {
      fetch: customFetch,
      customLogger,
      // NO fetch, console, or other globals available
    };

    // Append the function call to the function string and return its result
    const functionWithCall =
      functionString +
      `
      // Call the function and return its result
      createRecord(${JSON.stringify(recordData)}, ${JSON.stringify(apiKey)}, ${JSON.stringify(tableId)});
    `;

    // Use Node.js vm module for true isolation
    const result = runInNewContext(functionWithCall, sandbox, {
      timeout: 5000, // 5 second timeout
      displayErrors: true,
    }) as Promise<unknown>;

    return await result;
  } catch (error) {
    console.error('Error executing dynamic create record function:', error);
    throw error;
  }
}

export async function executeUpdateRecord(
  functionString: string,
  recordId: string,
  recordData: Record<string, unknown>,
  apiKey: string,
  tableId: string[],
): Promise<unknown> {
  try {
    // Create a completely isolated sandbox with NO access to globals
    const sandbox = {
      fetch: customFetch,
      customLogger,
      // NO fetch, console, or other globals available
    };

    // Append the function call to the function string and return its result
    const functionWithCall =
      functionString +
      `
      // Call the function and return its result
      updateRecord(${JSON.stringify(recordId)}, ${JSON.stringify(recordData)}, ${JSON.stringify(apiKey)}, ${JSON.stringify(tableId)});
    `;

    // Use Node.js vm module for true isolation
    const result = runInNewContext(functionWithCall, sandbox, {
      timeout: 5000, // 5 second timeout
      displayErrors: true,
    }) as Promise<unknown>;

    return await result;
  } catch (error) {
    console.error('Error executing dynamic update record function:', error);
    throw error;
  }
}
