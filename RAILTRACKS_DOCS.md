# Railtracks: End-to-End Documentation

Railtracks is an **open-source agentic framework** designed for building and deploying autonomous AI agents. It focuses on real-world orchestration, integration, and scale by allowing developers to define agent behavior directly in **pure Python**.

---

## 1. Introduction & Core Principles

The driving principle of Railtracks is that **"Flows Are Just Python."** Unlike other frameworks that rely on complex configuration languages or external graph definitions, Railtracks uses standard Python control flow (loops, branches, and sequential logic) to define how agents interact.

### Key Benefits

- **Minimalist & Extensible:** Built for developers who want code-first control.
- **High Observability:** Step-by-step tracing and visualization to eliminate the "black box" nature of AI systems.
- **Rich Integration:** Ready-to-use layers for tools, RAG (Retrieval-Augmented Generation), Notion, GitHub, and more.
- **Provider Agnostic:** Supports OpenAI, Anthropic, Google Gemini, Azure, Ollama, and more via LiteLLM.

---

## 2. Getting Started

### Installation

You can install the core library and the optional CLI for visualization using pip:

```bash
# Install the core library
pip install railtracks

# Install the CLI for visualization (recommended)
pip install 'railtracks[cli]'
```

### Quickstart Example

Define an agent and a flow in just a few lines of code:

```python
import railtracks as rt
from dotenv import load_dotenv

load_dotenv()

# 1. Define your Agent
# An agent needs a model provider and a system message.
Agent = rt.agent_node(
    llm=rt.llm.OpenAILLM("gpt-4o"),
    system_message="You are a helpful AI assistant."
)

# 2. Define your Flow
# Use the @rt.function_node decorator for steps in your flow.
@rt.function_node
async def main(message: str):
    result = await rt.call(
        Agent,
        message,
    )
    return result

# 3. Invoke the Flow
flow = rt.Flow("Quickstart Example", entry_point=main)
result = flow.invoke("Hello, what can you do?")
print(result)
```

---

## 3. Core Concepts

### Nodes

Railtracks uses "nodes" as the building blocks of an agentic system:

- **`agent_node`**: Represents an LLM-powered agent. It encapsulates the model, system prompt, and optional tools.
- **`function_node`**: A decorator that transforms a standard Python function into a traceable step within a Railtracks flow.
- **`tool_node`**: *(Coming soon/Internal)* Used to wrap external functions or APIs that agents can call.

### Flows

A **Flow** is the orchestration layer. It defines the entry point and manages the execution context. Because it's Python-native, you can use `if` statements for routing, `for` loops for iteration, and `try/except` for error handling.

---

## 4. LLM Providers

Railtracks abstracts provider-specific APIs, allowing you to switch models with minimal code changes.

| Provider    | Model Class             | Environment Variable |
|-------------|-------------------------|----------------------|
| OpenAI      | `rt.llm.OpenAILLM`      | `OPENAI_API_KEY`     |
| Anthropic   | `rt.llm.AnthropicLLM`   | `ANTHROPIC_API_KEY`  |
| Google      | `rt.llm.GeminiLLM`      | `GEMINI_API_KEY`     |
| Cohere      | `rt.llm.CohereLLM`      | `COHERE_API_KEY`     |
| Ollama      | `rt.llm.OllamaLLM`      | Local Instance       |
| Azure       | `rt.llm.AzureAILLM`     | Azure Config         |
| HuggingFace | `rt.llm.HuggingFaceLLM` | `HF_TOKEN`           |

### Custom Providers

If a provider isn't supported out of the box, you can subclass `LLMProvider` and implement the required methods.

---

## 5. Agent Architectures

Railtracks supports various multi-agent patterns without adding new abstractions:

1. **Sequential Flows:** Agents working in a fixed order (Agent A → Agent B → Agent C).
2. **Router Pattern:** A central agent (the router) directs the input to one of several specialized agents based on the query intent.
3. **Orchestrator-Worker:** A lead agent breaks down a complex task into sub-tasks and delegates them to worker agents.
4. **Evaluator-Optimizer:** One agent generates an output, and another agent reviews and suggests improvements in a loop.

---

## 6. Observability & Debugging

One of Railtracks' strongest features is its local visualization tool. It allows you to inspect every step of an agent's run, including token usage and decision-making logic.

### Using the CLI

```bash
# Initialize the UI in your project directory
railtracks init

# Start the visualization server
railtracks viz
```

This opens a web interface (usually at `localhost`) where you can see a history of all `flow.invoke()` calls and their internal traces.

---

## 7. Advanced Features

### Tool Calling

Agents can be equipped with tools by passing them to the `agent_node`. Railtracks handles the conversion of Python functions to tool definitions for the LLM.

### RAG (Retrieval-Augmented Generation)

Railtracks provides layers for integrating vector databases and retrieval logic directly into your agent flows, enabling agents to answer questions based on private data.

### MCP (Model Context Protocol)

Railtracks supports MCP both as a client (to use MCP tools) and as a server (to expose Railtracks agents as tools for other systems).

---

## 8. Resources & Community

- **Official Website:** [railtracks.org](https://railtracks.org)
- **Documentation:** [railtownai.github.io/railtracks/](https://railtownai.github.io/railtracks/)
- **GitHub Repository:** [RailtownAI/railtracks](https://github.com/RailtownAI/railtracks)
- **PyPI:** [railtracks](https://pypi.org/project/railtracks/)
