# PydanticAI Agent

A simple PydanticAI agent that demonstrates basic agent functionality.

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
# Edit .env and add your OpenAI API key
```

4. Run the agent:

```bash
python main.py
```

## Usage

The agent will start and wait for input. You can interact with it by typing messages, and it will respond using structured outputs defined by Pydantic models.

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
