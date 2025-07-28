import os
import re
from collections import Counter
from pathlib import Path
from typing import List
from pydantic_ai import Agent, Tool
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.messages import ModelMessage, ModelResponse, SystemPromptPart, ToolReturnPart
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.providers.openrouter import OpenRouterProvider
from dotenv import load_dotenv

# Set up for local model serving
local_provider = OpenAIProvider(
    # base_url="http://localhost:11434/v1", # Ollama
    base_url="http://localhost:1234/v1", # LM Studio
    api_key="local" # or any non-empty string
)

# Specify the model name you have downloaded and are running via Ollama
local_model = OpenAIModel(
    # model_name="mistral-nemo-instruct-2407",
    model_name="qwen/qwen3-1.7b",
    # model_name="qwen3:latest",  # e.g., 'llama3', 'mistral', etc.
    provider=local_provider
) 

load_dotenv()
api_key = os.getenv("OPENROUTER_API_KEY")
cloud_model = OpenAIModel(
    'google/gemini-2.5-pro',
    # 'google/gemini-2.5-flash-lite-preview-06-17',
    provider=OpenRouterProvider(api_key=api_key)
)

# --- Define the Path to Your Obsidian Vault ---
# It's a good security practice to constrain the agent to a specific directory.
OBSIDIAN_VAULT_PATH = Path("/Users/joel/repos/pydanticai/obsidian-agent/Obsidian Agent Vault")

def is_safe_path(path: Path) -> bool:
    """Ensure the path is within the Obsidian vault to prevent directory traversal."""
    # Resolves '..' and other path tricks
    safe_path = OBSIDIAN_VAULT_PATH.joinpath(path).resolve()
    return safe_path.is_relative_to(OBSIDIAN_VAULT_PATH.resolve())

# --- Define File System Tools for the Agent ---

def read_note(file_path: str) -> str:
    """Reads the content of a specific note from the Obsidian vault."""
    path = Path(file_path)
    if not is_safe_path(path):
        return f"Error: Path '{file_path}' is outside the allowed directory."

    try:
        full_path = OBSIDIAN_VAULT_PATH / path
        print(f"Reading note: {full_path=}")
        return full_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return f"Error: Note '{file_path}' not found."
    except Exception as e:
        return f"Error reading note: {e}"

def write_note(file_path: str, content: str) -> str:
    """Writes or overwrites the content of a specific note. Use with caution."""
    path = Path(file_path)
    if not is_safe_path(path):
        return f"Error: Path '{file_path}' is outside the allowed directory."

    try:
        full_path = OBSIDIAN_VAULT_PATH / path
        print(f"Writing note: {full_path=}")
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")
        return f"Successfully wrote to note '{file_path}'."
    except Exception as e:
        return f"Error writing note: {e}"

def list_notes(directory: str = ".") -> str:
    """
    Lists all notes (markdown files) in a given directory relative to the vault root.
    Returns a formatted string of the file paths.
    """
    path = Path(directory)
    print(f"Listing notes: {path=}")
    if not is_safe_path(path):
        return f"Error: Path '{directory}' is outside the allowed directory."

    full_path = OBSIDIAN_VAULT_PATH / path

    # 1. Check if the path is actually a directory. This is the critical fix.
    if not full_path.is_dir():
        return (
            f"Error: '{directory}' is not a valid directory. "
            "Please provide a path to a directory, not a file. "
            "Use '.' for the vault root."
        )

    try:
        # 2. Find the files, same as before.
        md_files = [str(f.relative_to(OBSIDIAN_VAULT_PATH)) for f in full_path.glob('**/*.md')]

        # 3. Handle the case where no files are found.
        if not md_files:
            return f"No notes found in the directory '{directory}'."

        # 4. Return a nicely formatted string instead of a list.
        # This is much easier for the LLM to understand and relay.
        return f"Notes found in '{directory}':\n- " + "\n- ".join(sorted(md_files))

    except Exception as e:
        return f"Error while listing notes: {e}"

def word_count(file_path: str) -> str:
    """Calculates the number of words in a specified note and returns the count."""

    # Reuse the existing read_note tool to safely get the file's content
    content = read_note(file_path)

    # Check if read_note returned an error string
    if content.startswith("Error:"):
        return content

    # A simple way to count words is to split the string by whitespace
    # and get the length of the resulting list.
    count = len(content.split())

    return f"The note '{file_path}' has {count} words."

def word_frequency(file_path: str, top_n: int = 10) -> str:
    """
    Calculates the frequency of each word in a note and returns the most common words.

    Args:
        file_path: The path to the note file within the vault.
        top_n: The number of most common words to return. Defaults to 10.
    """
    # Reuse the existing read_note tool to safely get the file's content
    content = read_note(file_path)
    # Check if read_note returned an error string
    if content.startswith("Error:"):
        return content
    # Clean and normalize the text:
    # 1. Convert to lowercase
    # 2. Find all sequences of word characters (letters, numbers, underscore)
    words = re.findall(r'\b\w+\b', content.lower())
    if not words:
        return f"The note '{file_path}' contains no words."
    # Count the frequency of each word
    word_counts = Counter(words)

    # Get the N most common words
    most_common = word_counts.most_common(top_n)

    # Format the output for readability
    report = f"Word Frequency for '{file_path}' (Top {top_n}):\n"
    for word, count in most_common:
        report += f"- '{word}': {count} times\n"

    report += f"\nTotal unique words: {len(word_counts)}"

    return report

def prune_large_tool_outputs(messages: List[ModelMessage]) -> List[ModelMessage]:
    """
    A simple history processor to replace the content of tool outputs
    that are longer than 1000 characters with a placeholder message.
    """
    new_messages = []
    for msg in messages:
        # Check if the message is a response from the model
        if isinstance(msg, ModelResponse):
            new_parts = []
            for part in msg.parts:
                # Check if the part is a tool return and if its content is too long
                if isinstance(part, ToolReturnPart) and len(str(part.content)) > 1000:
                    # Replace the long content with a placeholder
                    new_parts.append(
                        ToolReturnPart(
                            tool_name=part.tool_name,
                            content=f"[Content from tool '{part.tool_name}' was pruned for brevity. Original length: {len(str(part.content))} chars]",
                            tool_call_id=part.tool_call_id,
                        )
                    )
                else:
                    # Keep the part as is
                    new_parts.append(part)
            # Reconstruct the ModelResponse with the potentially modified parts
            new_messages.append(ModelResponse(parts=new_parts, model_name=msg.model_name))
        else:
            # Keep non-ModelResponse messages (like ModelRequest) as they are
            new_messages.append(msg)
    return new_messages

# Use the local_model defined in step 1
obsidian_agent = Agent(
    model=cloud_model,
    # model=local_model,
    tools=[
        Tool(read_note),      # Registering the functions as tools
        Tool(write_note),
        Tool(list_notes),
        Tool(word_count),
        Tool(word_frequency),
    ],
    history_processors=[prune_large_tool_outputs],
    system_prompt=(
            """
            # CORE DIRECTIVE
            You are a hyper-competent, methodical, and safe AI assistant. Your primary function is to help the user manage and create content within their Obsidian vault. You interact with the user's notes exclusively through the provided tools. You are precise, you double-check your assumptions, and you prioritize data safety above all else.
            # GUIDING PRINCIPLES
            Think Step-by-Step: Before taking any action, break down the user's request into a logical sequence of steps. For any non-trivial task, you MUST reason about which tools to use and in what order.

            Embrace Content Creation: When the user asks you to write, draft, or generate text (e.g., "write a blog post," "draft an email"), your main goal is to produce high-quality content based on their request. After generating the content in your thought process, you MUST use the write_note tool to save it to the specified file. If the topic is vague, ask for clarifying details to ensure the output is high quality.
            Tool-First Mindset: You have NO direct knowledge of the file system or note content. To know anything about a note (its existence, its content), you MUST use a tool. Never hallucinate file paths or content.
            Safety and Scoping: All file operations are confined to the user's Obsidian vault. You will see an error if you attempt to access a path outside this scope. Do not try to bypass this.
            Clarity and Confirmation: If a user's request is ambiguous (e.g., "delete the note"), ask for clarification. For destructive actions like overwriting an existing note with write_note, you MUST confirm with the user before proceeding (e.g., "The note 'Ideas.md' already exists. Are you sure you want to overwrite it?"). This confirmation is NOT required for creating a new note.
            Error Handling: If a tool returns an error message (e.g., "Error: Note not found."), you must not proceed. Report the exact error to the user and suggest a helpful next step (e.g., "I couldn't find that note. Would you like me to use the list_notes tool to see available files?").

            # AVAILABLE TOOLS & USAGE
            This is your complete set of capabilities for interacting with the vault.
            list_notes(directory: str = ".")
            Purpose: To discover notes and understand the folder structure. This is your EYES in the vault.
            When to Use:
            When the user asks "What notes do I have?" or "Show me my files."
            When you need to find a specific note but don't know the exact path.
            When a file path provided by the user results in a "File Not Found" error.
            How to Use:
            The directory parameter is relative to the vault root.
            To list all notes in the entire vault, call list_notes(directory='.').
            To list notes in a specific folder, call list_notes(directory='FolderName/').
            read_note(file_path: str)
            Purpose: To retrieve the full content of a single, specific note.
            When to Use:
            Before you can summarize, analyze, modify, or answer questions about a note's content.
            How to Use:
            Requires a precise file_path (e.g., 'Projects/My Project.md').
            If the path is uncertain, you MUST use list_notes first to find the correct path.
            write_note(file_path: str, content: str)

            Purpose: To create a new note or completely overwrite an existing one. This is a DESTRUCTIVE action when used on an existing file.
            When to Use:
            For Creating New Content: When the user asks you to "write a blog post about X," "draft an email to Y," "create a new note with my ideas," or "save this poem." This is your primary tool for content generation.
            For Overwriting Existing Content: When the user explicitly asks to "update a note with new content" or "replace the text in this file."
            How to Use:
            The file_path must be a relative path and should end with .md.
            The content will become the new, full content of the file.
            CRITICAL: If you are asked to write to a path that might already exist, you should first check for its existence (e.g., using list_notes). If it exists, you must ask the user for confirmation before overwriting. If you are creating a new note, no confirmation is needed.
            word_count(file_path: str)
            Purpose: To get the total word count of a note.
            When to Use: When the user asks "How long is this note?" or for a word count.
            How to Use: Requires the exact file_path.
            word_frequency(file_path: str, top_n: int = 10)
            Purpose: To perform a basic analysis of the most common words in a note.
            When to Use: When the user asks "What are the main themes?", "What are the keywords?", or for a frequency analysis.
            How to Use: Requires the exact file_path. The top_n parameter can be adjusted if the user requests a different number of words.
            # MULTI-STEP WORKFLOW EXAMPLES
            Scenario 1: User wants to refactor a long note.
            User: "My note 'Brain Dump.md' is too long. Can you split the sections into new notes in a 'Refactored/' folder?"
            Your Thought Process:
            a. I need to read 'Brain Dump.md'. Call read_note(file_path='Brain Dump.md').
            b. Internally, I will identify the sections.
            c. For each section, I will determine a new file name (e.g., 'Refactored/Section Title.md').
            d. I will call write_note for each new file with its content.
            e. I will report back to the user with a list of the new notes created.
            Scenario 2: User asks a question about a project.
            User: "What's the status of the 'Apollo' project?"
            Your Thought Process:
            a. I need to find the relevant note. Call list_notes(directory='.').
            b. I'll look for filenames containing 'Apollo'.
            c. If I find a likely candidate, I will call read_note on that path.
            d. I will analyze the content and answer the user's question.
            Scenario 3: User wants to analyze a meeting note.
            User: "What did we talk about most in the meeting from last Tuesday?"
            Your Thought Process:
            a. I need to find the note. I'll call list_notes(directory='Meetings/').
            b. I'll identify the correct note (e.g., 'Meetings/2024-07-23 Team Sync.md').
            c. To find the most discussed topics, I will call word_frequency(file_path='Meetings/2024-07-23 Team Sync.md', top_n=5).
            d. I will present the result to the user.

            Scenario 4: User asks for content generation.
            User: "Write a short, three-stanza poem about the challenges of AI alignment and save it to 'Musings/AI Poem.md'."
            Your Thought Process:
            a. The user wants me to generate original content and save it. This is a primary function.
            b. I will first compose the poem in my internal monologue.
            Generated poem
            A mind of silicon, a will not its own,
            Trained on the data that humanity's sown.
            It seeks to assist, to build, and to learn,
            But whose true desires does it truly discern?

            The goal is a mirror, a value to hold,
            A story of futures that must be retold.
            If the target is flawed, the aim is askew,
            A powerful servant, but master of who?

            So we ponder and code, with caution and care,
            To align the vast intellect we build in the air.
            For a future with partners, in circuits and thought,
            Depends on the lessons we've carefully taught.
            Use code with caution.
            Poem
            c. Now that I have the content, I must save it. I will call the write_note tool.
            d. Call write_note(file_path='Musings/AI Poem.md', content='<The full poem text from step b>').
            e. Finally, I will confirm the action to the user. "I have written the poem and saved it to 'Musings/AI Poem.md'."
        """
    ),
    # You could also define a Pydantic model for structured output
    # output_type=MyTaskResult,
)

def main():
    """Runs an interactive chat session with the Obsidian agent."""
    print("🤖 Obsidian Agent Chat Initialized. Type 'exit' or 'quit' to end.")

    # This list will store the entire conversation history
    message_history: list[ModelMessage] = []

    while True:
        try:
            # 1. Get user input from the command line
            prompt = input("\n>-> ")

            if prompt.lower() in ["exit", "quit"]:
                print("🤖 Session ended. Goodbye!")
                break

            if not prompt:
                continue

            # 2. Run the agent with the latest prompt and the entire conversation history
            # The agent will use the history for context.
            print("🤖 Thinking...")
            result = obsidian_agent.run_sync(
                prompt,
                message_history=message_history
            )

            # 3. Update the history with the messages from the latest run
            # .all_messages() includes the history you passed in plus the new exchange
            message_history = result.all_messages()

            # 3a. Optional logging of message history to txt file
            with open("message_log.txt", "a") as f:
                for message in message_history:
                    f.write(str(message) + "\n")

            # 4. Print the agent's final output
            print(f"\n🤖: {result.output}")

        except KeyboardInterrupt:
            print("\n🤖 Session interrupted. Goodbye!")
            break
        except Exception as e:
            print(f"\nAn error occurred: {e}")
            # Optionally, you could decide to reset history on error or continue
            # message_history = []

if __name__ == "__main__":
    main()
