# lucai

A powerful, AI-driven code review CLI that goes beyond static analysis to provide deep, contextual feedback.

## Overview

`lucai` is a command-line tool designed for developers, consultants, and teams who want to elevate their code quality. It uses AI to analyze code for architectural soundness, developer ergonomics, and strategic design flaws, providing insights that traditional linters and static analysis tools often miss.

## Features

- **AI-Powered Reviews**: Get human-readable feedback on your code.
- **Flexible Analysis**: Review entire directories, single files, or git diffs.
- **Multiple Output Formats**: Choose from markdown, JSON, or inline comments.
- **Customizable**: Use different AI models and custom prompts.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)

### Installation

1.  **Clone or install the package:**

    *   **From Source:**
        ```sh
        git clone https://github.com/your-username/lucai.git
        cd lucai
        npm install
        npm link
        ```
    *   **Via npm (once published):**
        ```sh
        npm install -g lucai
        ```

2.  **Configure your API Key:**
    Run the `configure` command. You will be prompted to select an AI provider (OpenAI or Google) and enter the corresponding API key.
    ```sh
    lucai configure
    ```
    This will securely store your key for future use.

### Generating API Keys

-   **OpenAI**:
    1.  Go to the [OpenAI API keys page](https://platform.openai.com/account/api-keys).
    2.  Click on "Create new secret key".
    3.  Copy the key and paste it into the `lucai configure` prompt when you select `openai`.

-   **Google Gemini**:
    1.  Go to the [Google AI Studio](https://aistudio.google.com/app/apikey).
    2.  Click on "Create API key".
    3.  Copy the key and paste it into the `lucai configure` prompt when you select `google`.

### Usage

**Review a directory:**
```sh
lucai review --path ./src
```

**Review a single file:**
```sh
lucai review --file ./src/main.js
```

**Review with a specific model:**
```sh
lucai review --path ./src --model gemini-1.5-pro-latest
```

### Commands

| Command     | Description                                               |
|-------------|-----------------------------------------------------------|
| `review`    | Perform an AI-enhanced code review on a directory or file.  |
| `configure` | Configure your AI provider (OpenAI or Google) and API key. |
| `help`      | Display the help guide.                                   |

For a full list of options for the `review` command, run:
```sh
lucai review --help
```

## Roadmap

See the [Product Requirements Document](.cursor/lucai-review.prd.md) for the detailed roadmap.

## Author

Created by **Glenn Allogho**

-   **Email**: `glennfreelance365@gmail.com`
-   **LinkedIn**: [glenn-allogho](https://www.linkedin.com/in/glenn-allogho/)
-   **Medium**: [@glennlenormand](https://medium.com/@glennlenormand)
-   **Twitter**: [@glenn_all](https://twitter.com/glenn_all)
-   **GitHub**: [@allglenn](https://github.com/allglenn)
-   **GitLab**: [@glennlenormand](https://gitlab.com/glennlenormand)