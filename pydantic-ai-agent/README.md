# PydanticAI Agent

The agent server is the bridge between the user, the Scratch data and the LLMs by assembling the context and providing a set of tools for the LLM to use and interact with the Scratch backend.

## Setup

1. Install uv:

```bash
brew install uv
```

2. Install dependencies (This will also create a virtual environment in `./.venv`):

```bash
uv sync
```

3. Set up environment variables:

```bash
cp .env.example .env
```

4. Activate the virtual environment:

```bash
source .venv/bin/activate
```

Set your `LOGFIRE_TOKEN` and `LOGFIRE_ENVIRONMENT` values

If you are doing a lot of iteration on the Agent, it is recommended you use the shared key as it has a higher token credit limit.

For the `LOGFIRE_TOKEN`, get your own token from https://logfire.sh

Set the `LOGFIRE_ENVIRONMENT` to include your name so your log events are isolated from other devs

4. Run the agent server:

```bash
python main.py
```

5. Check **Black** is working as your formatter

   Scratch uses Black for our Python code formatter and it is installed automatically by uv. It is configured in `.vscode/settings.json`.

   Ensure it is working properly in your editor since these things are easily broken.

## Deactivating the virtual environment

```bash
deactivate
```

## Upgrading dependencies

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

### Test with uv

You can run the app with a different set of dependencies in a temporary environment using uv:

```bash
uv run --with 'pydantic-ai==1.38.0' main.py
```

### Make changes to the dependencies

```bash
uv add 'requests==2.31.0'
```

See [the guide to working on projects with uv](https://docs.astral.sh/uv/guides/projects/) for more info.

### Test the server to see if it worked

```bash
python main.py
```
