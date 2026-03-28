# assistant-ui: End-to-End Documentation

**assistant-ui** is an open-source TypeScript/React library designed to build production-grade AI chat experiences. It provides a set of highly customizable components and a robust state management layer (runtime) to handle streaming, auto-scrolling, accessibility, and complex conversation flows.

---

## 1. Introduction & Key Features

The primary goal of assistant-ui is to provide the "UX of ChatGPT" in your own application with minimal effort.

### Key Capabilities
*   **Production-Ready Components:** Drop-in components for threads, messages, and input fields.
*   **State Management (Runtimes):** Built-in support for streaming, interruptions, retries, and multi-turn conversations.
*   **Provider Agnostic:** Works seamlessly with the Vercel AI SDK, LangChain, or any custom LLM backend.
*   **Performance Optimized:** Minimal bundle size and optimized rendering for responsive streaming.
*   **Customizable UI:** Built on top of Radix UI primitives, making it easy to theme and style.

---

## 2. Getting Started

### Installation
The fastest way to get started is using the CLI to initialize a new project or add it to an existing one.

```bash
# Create a new project with a template
npx assistant-ui@latest create

# Or add to an existing project
npx assistant-ui@latest init
```

### Quick Start (Next.js + Vercel AI SDK)
1.  **Setup Backend Endpoint:**
    Create an API route to handle chat requests.

    ```typescript
    // app/api/chat/route.ts
    import { openai } from "@ai-sdk/openai";
    import { streamText } from "ai";

    export async function POST(req: Request) {
      const { messages } = await req.json();
      const result = streamText({
        model: openai("gpt-4o"),
        messages,
      });
      return result.toDataStreamResponse();
    }
    ```

2.  **Configure the Frontend:**
    Wrap your application in the `AssistantRuntimeProvider`.

    ```tsx
    // app/page.tsx
    "use client";

    import { AssistantRuntimeProvider } from "@assistant-ui/react";
    import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
    import { Thread } from "@/components/assistant-ui/thread";

    export default function MyApp() {
      const runtime = useChatRuntime({
        api: "/api/chat",
      });

      return (
        <AssistantRuntimeProvider runtime={runtime}>
          <div className="h-screen">
            <Thread />
          </div>
        </AssistantRuntimeProvider>
      );
    }
    ```

---

## 3. Core Concepts

### Runtimes
Runtimes are the "brains" of assistant-ui. They manage the state of the conversation, including messages, attachments, and tool calls.
*   **`useChatRuntime`**: The most common runtime, designed for use with the Vercel AI SDK.
*   **`LocalRuntime`**: Used for custom backends or purely client-side logic.
*   **`ExternalStoreRuntime`**: Connects assistant-ui to external state stores like LangGraph or custom state management systems.

### Primitives
assistant-ui provides "primitives" which are unstyled or minimally styled components that handle complex logic:
*   **`Thread`**: The main container for a conversation. Handles auto-scrolling and viewport management.
*   **`Message`**: Represents an individual message in the thread.
*   **`Composer`**: The input area where users type their messages.

---

## 4. Advanced Features

### Tool UI & Generative UI
assistant-ui allows you to render custom React components when the LLM calls a tool.

```tsx
<Thread 
  tools={{
    get_weather: ({ location }) => <WeatherCard location={location} />
  }}
/>
```

### Copilots & System Instructions
You can dynamically update the assistant's behavior using hooks like `useAssistantInstructions`.

```tsx
import { useAssistantInstructions } from "@assistant-ui/react";

function MyComponent() {
  useAssistantInstructions("You are a helpful assistant specialized in banking.");
  // ...
}
```

### Attachments & File Handling
assistant-ui includes built-in support for file uploads and attachments, providing a `AttachmentRuntime` to manage file states.

---

## 5. Theming & Styling

assistant-ui is designed to be styled with **Tailwind CSS**. It uses Radix UI primitives under the hood, ensuring high accessibility and flexible customization.

### Customizing the Thread
You can pass custom components to the `Thread` to change its appearance:

```tsx
<Thread 
  components={{
    Message: MyCustomMessage,
    UserMessage: MyUserMessage,
    AssistantMessage: MyAssistantMessage,
  }}
/>
```

---

## 6. Integrations

| Integration | Description |
| :--- | :--- |
| **Vercel AI SDK** | First-class support via `@assistant-ui/react-ai-sdk`. |
| **LangChain** | Use `useExternalStoreRuntime` to connect to LangServe or LangGraph. |
| **Assistant Cloud** | Adds persistence, thread management, and analytics out of the box. |
| **Clerk** | Authentication integration for user-specific chat histories. |
| **MCP** | Model Context Protocol support for using remote tools. |

---

## 7. Resources

*   **Official Website:** [assistant-ui.com](https://www.assistant-ui.com/)
*   **Documentation:** [assistant-ui.com/docs](https://www.assistant-ui.com/docs)
*   **GitHub:** [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui)
*   **Starter Templates:** [assistant-ui-starter](https://github.com/assistant-ui/assistant-ui-starter)

---
*Documentation generated on March 28, 2026.*
