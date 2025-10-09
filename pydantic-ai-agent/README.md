# PydanticAI Agent

The agent server is the bridge between the user, the Scratchpaper data and the LLMs by assembling the context and providing a set of tools for the LLM to use and interact with the Scratchpaper backend.

## Setup

1. Create a virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Set your `OPENROUTER_API_KEY` and `LOGFIRE_TOKEN` values

The `OPENROUTER_API_KEY` will be used as a fallback for admin users that don't have credentials configured. You can create your own or use the `Scratchpaper Devs - shared API key` that is in 1Password.

If you are doing a lot of iteration on the Agent, it is recommended you use the shared key as it has a higher token credit limit.

For the `LOGFIRE_TOKEN` ask Ivan or Chris for this value

Set the `LOGFIRE_ENVIRONMENT` to include your name so your log events are isolated from other devs

4. Run the agent server:

```bash
python main.py
```

5. Setup **Black** as your formatter

   Scratchpaper uses Black for our Python code formatter and it is install with the pip command above

   Configure VS Code to use Black as the Python formatter:

   **Option A: Workspace Settings (Recommended)**
   Create `.vscode/settings.json` in your project root:

   ```json
   {
     "python.formatting.provider": "black",
     "python.formatting.blackArgs": ["--line-length=88"],
     "editor.formatOnSave": true,
     "editor.formatOnPaste": true
   }
   ```

   **Option B: User Settings**
   Open VS Code settings (Cmd/Ctrl + ,) and add:

   - Set "Python › Formatting: Provider" to "black"
   - Set "Editor: Format On Save" to true
   - Set "Editor: Format On Paste" to true

   **Manual formatting:**

   ```bash
   # Format all Python files
   black .

   # Format a specific file
   black filename.py

   # Check formatting without making changes
   black --check .
   ```

## Deactivating VENV

```bash
deactivate
```

## Upgrading dependencies in requirements.txt

When trying out upgrades it is a good idea to setup a new venv first and install the dependencies there so that you preserve a working version. This helps keep things clean and also simulates what will happen on a new deploy of the code.

### Exit current venv

```bash
deactivate
```

### Create & activate a new venv

```bash
python -m venv venv-pydantic-update
source venv-pydantic-update/bin/activate
```

### Make changes to requirements.txt

Do your changes then install the packages

```bash
pip install -r requirements.txt
```

### Test the server to see if it worked

```bash
python main.py
```

## Production Hosting

The Scratchpad Agent server is hosted on Render.

[Public URL - https://agent.scratchpaper.ai](https://agent.scratchpaper.ai)

[Manage Render Project](https://dashboard.render.com/web/srv-d347qore5dus73epu9r0)

- Owned by team@whalesync.com (Credentials in 1password)
