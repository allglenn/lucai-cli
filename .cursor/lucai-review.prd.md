# Product Requirements Document: lucai review

## 1. Overview

lucai review is a CLI tool that performs AI-enhanced, context-aware code reviews for developers, consultants, and teams. Unlike static analysis tools like SonarQube, lucai focuses on architectural soundness, developer ergonomics, and human-readable feedback to catch not just smells, but strategy-level design flaws.

---

## 2. Problem Statement

Modern devs use linters and Sonar, but:
- These tools miss cross-file logic, domain model violations, and design patterns.
- Human-readable summaries and PR-specific comments are absent.
- Developers need feedback they’d get from a senior engineer or CTO, not just a rule engine.

---

## 3. Goals
- Provide structured, natural-language code reviews using AI
- Allow analysis of files, diffs, or commits via CLI
- Output reviews with meaningful sections: dangers, issues, refactors, good practices
- Enable use in local dev and CI/CD (e.g. GitHub Actions)

---

## 4. User Stories

### 🧑‍💻 Developer
> "As a developer, I want to review code before committing or creating a PR, so I can ensure quality and avoid obvious mistakes."

### 🧑‍🏫 Tech Lead / Consultant
> "As a consultant, I want to generate clean, insightful reports that show code risks to the client."

### 🧑‍💼 Engineering Manager
> "As a manager, I want to receive summaries of risks and strengths in a PR to prioritize reviews better."

---

## 5. Features & Functional Requirements

### A. Core CLI Command: `lucai review`

Example:
```sh
lucai review --path ./src --output markdown --gpt --summary
```

#### ✅ Inputs
- `--path` or `--file`: Path to scan
- `--from` / `--to`: Git diff range
- `--commits N`: Last N commits
- `--model`: AI model to use (gpt-4o, claude, etc.)
- `--prompt`: Custom system prompt file
- `--output`: Format (markdown, json, inline)
- `--summary`: Append executive summary
- `--blame`: Attribute code authorship
- `--track`: Save quality scores over time

#### ✅ Output Sections
- 🛑 **criticals**: bugs, security risks, race conditions
- ⚠️ **issues**: anti-patterns, code smells, bad practices
- 💡 **refactors**: abstractions, naming, performance ideas
- ✅ **good**: clean patterns worth keeping
- 🧠 **clever**: surprisingly elegant code
- 📊 **score**: 0–100 quality metric
- 🧾 **summary**: manager- or client-friendly paragraph

---

### B. Optional Features

| Feature         | Description                                      |
|----------------|--------------------------------------------------|
| `--arch`       | Analyze architecture and layering violations      |
| `--dx`         | Evaluate developer experience (naming, readability) |
| `--tests`      | Suggest test coverage improvements               |
| GitHub PR comment | Post inline review via GitHub API             |
| Trend tracking | Save scores to a local `.lucai/log.db` (SQLite). Team-based tracking via Firebase is planned for a future release. |

---

## 6. Non-Functional Requirements
- Token-aware chunking for large files
- API usage limits & cost-aware batching for OpenAI/Anthropic
- Works offline with fallback to static linting
- Secure handling of sensitive code (env, secrets, API keys)
- Output readable in VSCode terminal, CI, or Slack

---

## 7. Success Metrics

| Metric                        | Target                  |
|-------------------------------|-------------------------|
| Developer adoption (weekly CLI use) | > 10 active users in beta |
| PRs reviewed with lucai     | > 100 within 3 months   |
| False positive rate vs Sonar  | < 10%                   |
| Time to actionable review     | < 15s for 5 files       |
| Quality improvement (tracked score) | +10% within 1 month |

---

## 8. Risks & Mitigations

| Risk                  | Mitigation                                      |
|-----------------------|-------------------------------------------------|
| AI hallucination      | Use explicit prompts and function constraints    |
| Large cost from API usage | Add local mode and batching                |
| Sonar/ESLint duplication | Focus on high-level insights and human-centric reports |
| Privacy of code       | Support local mode and .gitignore scanning      |

---

## 9. Technical Stack

| Component      | Stack                                               |
|----------------|----------------------------------------------------|
| CLI Tool       | Node.js (commander, chalk) or Python (click, rich) |
| AI Backend     | OpenAI GPT-4o (default), Anthropic Claude, or local LLM (Ollama) |
| Git Integration| simple-git, git diff, or pygit2                    |
| Scoring/History| SQLite (local for solo mode). Firebase is planned for future team-based features. |
| Optional CI    | GitHub Actions, GitLab CI                          |

---

## 10. Roadmap

| Phase | Features                                                      |
|-------|---------------------------------------------------------------|
| v0.1  | Core Review & Local Tracking: Basic CLI, GPT integration, Markdown output, scoring, and local trend tracking with SQLite. |
| v0.2  | Git Integration: Git diff support, blame, commit range.       |
| v0.3  | Advanced Output & CI: More output formats (inline, JSON), and a basic GitHub Action. |
| v0.4  | Advanced Analysis: Architecture (`--arch`) and Developer Experience (`--dx`) review modes. |
| v1.0  | Team Features & Extensibility: Firebase integration for teams, multi-model support, and a plugin system. | 