# AI Module

## Overview

The AI module is a wrapper service around Google's Gemini AI model that provides centralized AI text generation capabilities for the Whalesync application.

## Purpose

This module abstracts away provider-specific details for AI interactions, providing a unified interface for generating content using Google's Gemini models. The design is model and SDK-agnostic, allowing for future provider swaps without disrupting downstream services.

## Key Components

### AiService

The main service handles:

- Authentication with Google's GenAI API (supports both API key and default credentials)
- Content generation via a unified `generate()` method
- Support for multiple Gemini model versions (2.0 Flash, 2.5 Flash)

## Features

- **Flexible Content Generation**: Support for text-based prompts with configurable parameters
- **JSON Responses**: Built-in support for structured JSON output
- **Custom Response Schemas**: Define expected response structures
- **Thinking Budgets**: Configurable reasoning budgets for extended model thinking
- **Error Handling**: Comprehensive error handling for AI API interactions

## Primary Use Case

The module's is currently unused but is available to support LLM based processing inside of the server

## Integration

The AI module represents a strategic abstraction layer that decouples AI capability management from business logic. This enables the custom connector builder feature and supports other potential AI-driven functionality throughout the application in a maintainable, scalable manner.

## Configuration

The service configuration is loaded from the `ScratchpadConfigService` and includes:

- Google API credentials
- Model selection
- Generation parameters
