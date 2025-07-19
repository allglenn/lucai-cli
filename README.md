# lucai

> **⚠️ Under Construction**  
> This bot is still in active development. Features may be incomplete or subject to change. We're working hard to make it production-ready!

A powerful, AI-driven code review CLI that goes beyond static analysis to provide deep, contextual feedback.

## Overview

`lucai` is a command-line tool designed for developers, consultants, and teams who want to elevate their code quality. It uses AI to analyze code for architectural soundness, developer ergonomics, and strategic design flaws, providing insights that traditional linters and static analysis tools often miss.

## Features

- **AI-Powered Reviews**: Get human-readable feedback on your code.
- **Flexible Analysis**: Review entire directories, single files, or git diffs.
- **Multiple Output Formats**: Choose from markdown, JSON, or inline comments.
- **Customizable**: Use different AI models and custom prompts.
- **Project-Level Configuration**: Define project-specific settings in a `.lucai.json` file for consistent reviews.

## Handling Large Files

When `lucai` encounters a file that is too large for the selected AI model's context window, it automatically splits the file into smaller chunks. This allows `lucai` to review even very large files without running into context length issues. The chunks are processed individually and the feedback is then combined, giving you a complete picture of your code's quality.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)

### Installation

1.  **Clone or install the package:**

    *   **From Source:**
        ```sh
        git clone https://github.com/allglenn/lucai.git
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

**Review changed files in the last commit:**
```sh
lucai review --diff
```

**Review with a specific model:**
```sh
lucai review --path ./src --model gemini-1.5-pro-latest
```

**Review with a specific profile:**
```sh
lucai review --profile security
```

### Project-Level Configuration

You can configure `lucai` on a per-project basis by creating a `.lucai.json` file in your project's root directory. This file allows you to define default options and create custom review profiles.

**Example `.lucai.json`:**
```json
{
  "model": "gemini-1.5-pro-latest",
  "output": "markdown",
  "ignore": [
    "dist/",
    "**/*.test.js"
  ],
  "reviewProfiles": {
    "default": "Analyze this code for architectural soundness, developer ergonomics, and strategic design flaws.",
    "security": "Analyze this code strictly for potential security vulnerabilities, such as injection flaws, broken authentication, and sensitive data exposure. Do not comment on style.",
    "performance": "Review this code for performance bottlenecks and suggest optimizations."
  }
}
```

When you run `lucai review`, the options in this file will be used as defaults. You can override them with command-line flags.

To use a specific review profile, use the `--profile` option:
```sh
lucai review --profile security --path ./src
```

To output the result to a markdown file:
```sh
bin/lucai.js review --profile security --path ./bin --output markdown --output-file security_review.md
```

### Commands

| Command     | Description                                               |
|-------------|-----------------------------------------------------------|
| `review`    | Perform an AI-enhanced code review on a directory or file.  |
| `configure` | Configure your AI provider (OpenAI or Google) and API key. |
| `help`      | Display the help guide.                                   |

**Review Command Options:**
- `--path <path>`: Path to a directory to scan.
- `--file <file>`: Path to a single file to scan.
- `--diff`: Review files changed in the last commit.
- `--profile <name>`: Run a review with a specific profile from your `.lucai.json`.

For a full list of options for the `review` command, run:
```sh
lucai review --help
```


## Author

Created by **Glenn Allogho**

-   **Email**: `glennfreelance365@gmail.com`
-   **LinkedIn**: [glenn-allogho](https://www.linkedin.com/in/glenn-allogho-94649688/)
-   **Medium**: [@glennlenormand](https://medium.com/@glennlenormand)
-   **Twitter**: [@glenn_all](https://twitter.com/glenn_all)
-   **GitHub**: [@allglenn](https://github.com/allglenn)
-   **GitLab**: [@glennlenormand](https://gitlab.com/glennlenormand)