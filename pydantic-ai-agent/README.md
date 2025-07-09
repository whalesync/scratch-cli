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
