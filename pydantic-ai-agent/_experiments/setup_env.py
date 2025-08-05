#!/usr/bin/env python3
"""
Setup script to create .env file with API keys
"""

import os


def create_env_file():
    """Create .env file with API keys"""

    # Check if .env already exists
    if os.path.exists(".env"):
        print("⚠️ .env file already exists!")
        response = input("Do you want to overwrite it? (y/N): ")
        if response.lower() != "y":
            print("Setup cancelled.")
            return

    # Get API keys from user
    print("🔑 Setting up API keys for the chat server...")
    print()

    openrouter_key = input(
        "Enter your OpenRouter API key (or press Enter to use default): "
    ).strip()
    if not openrouter_key:
        openrouter_key = (
            "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"
        )
        print("Using default OpenRouter key")

    model_name = input(
        "Enter model name (or press Enter to use default 'openai/gpt-4o-mini'): "
    ).strip()
    if not model_name:
        model_name = "openai/gpt-4o-mini"
        print("Using default model: openai/gpt-4o-mini")

    logfire_token = input(
        "Enter your Logfire token (optional, press Enter to skip): "
    ).strip()

    # Create .env content
    env_content = f"""# API Keys
OPENAI_API_KEY=your_openai_api_key_here
OPENROUTER_API_KEY={openrouter_key}

# Model Configuration
MODEL_NAME={model_name}

# Logfire (optional - for logging and observability)
# Get your token from https://logfire.sh
LOGFIRE_TOKEN={logfire_token}

# Other settings
DEBUG=true
"""

    # Write .env file
    try:
        with open(".env", "w") as f:
            f.write(env_content)
        print("✅ .env file created successfully!")
        print()
        print("📋 Environment variables set:")
        print(f"   OPENROUTER_API_KEY: {'*' * 10}{openrouter_key[-4:]}")
        print(
            f"   LOGFIRE_TOKEN: {'*' * 10}{logfire_token[-4:] if logfire_token else 'Not set'}"
        )
        print()
        print("🚀 You can now start the chat server with:")
        print("   cd chat-server")
        print("   python main.py")

    except Exception as e:
        print(f"❌ Error creating .env file: {e}")


if __name__ == "__main__":
    create_env_file()
