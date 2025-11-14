# PydanticAI Agent

The agent server is the bridge between the user, the Scratch data and the LLMs by assembling the context and providing a set of tools for the LLM to use and interact with the Scratch backend.

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

Set your `LOGFIRE_TOKEN` and `LOGFIRE_ENVIRONMENT` values

If you are doing a lot of iteration on the Agent, it is recommended you use the shared key as it has a higher token credit limit.

For the `LOGFIRE_TOKEN`, get your own token from https://logfire.sh

Set the `LOGFIRE_ENVIRONMENT` to include your name so your log events are isolated from other devs

4. Run the agent server:

```bash
python main.py
```

5. Check **Black** is working as your formatter

   Scratch uses Black for our Python code formatter and it is install with the pip command above. It is configured in `.vscode/settings.json`

   Ensure it is working properly in your editor since these things are easily broken.

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
