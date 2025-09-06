# 🐳 Lucai CLI Docker Setup

This Docker setup provides a complete containerized environment for the Lucai CLI with multiple useful services and configurations.

## 🚀 Quick Start

1. **Copy environment file:**
   ```bash
   cp env.example .env
   ```

2. **Edit your API keys in `.env`:**
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   GOOGLE_API_KEY=your_google_api_key_here
   CODE_PATH=./test-code
   ```

3. **Build and run:**
   ```bash
   npm run docker:build
   npm run docker:review
   ```

## 📦 Available Services

### Core Services

- **`lucai`** - Main CLI service (production)
- **`lucai-dev`** - Development service with hot reload
- **`lucai-web`** - Future web interface (port 3000)
- **`lucai-db`** - SQLite database for review history
- **`lucai-cache`** - Redis cache service
- **`lucai-tools`** - Comprehensive code quality tools

### Service Profiles

Use profiles to run specific combinations of services:

```bash
# CLI only
docker-compose --profile cli up

# Development environment
docker-compose --profile dev up

# Web interface
docker-compose --profile web up

# Database services
docker-compose --profile db up

# Code quality tools
docker-compose --profile tools up

# Cache services
docker-compose --profile cache up
```

## 🛠️ Available Commands

### NPM Scripts

```bash
# Build all services
npm run docker:build

# Start all services
npm run docker:up

# Stop all services
npm run docker:down

# Development mode
npm run docker:dev

# Run CLI commands
npm run docker:cli
npm run docker:review
npm run docker:review-diff
npm run docker:configure

# Code quality tools
npm run docker:tools

# View logs
npm run docker:logs

# Clean up everything
npm run docker:clean
```

### Direct Docker Commands

```bash
# Review specific directory
docker-compose run --rm lucai review --path /code

# Review git diff
docker-compose run --rm lucai review --diff

# Configure API keys
docker-compose run --rm lucai configure

# Run with custom model
docker-compose run --rm lucai review --path /code --model gemini-1.5-pro-latest

# Generate JSON output
docker-compose run --rm lucai review --path /code --output json

# Save report to file
docker-compose run --rm lucai review --path /code --output-file /code/review.md
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `GOOGLE_API_KEY` | Google API key | Required |
| `CODE_PATH` | Directory to review | `./test-code` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Web interface port | `3000` |

### Volumes

- **`lucai_data`** - Persistent storage for database and config
- **`lucai_cache`** - Redis cache data
- **`/code`** - Your code directory (read-only)
- **`~/.gitconfig`** - Git configuration

## 🛠️ Code Quality Tools

The `lucai-tools` service includes:

### JavaScript/TypeScript
- ESLint
- Prettier
- TypeScript ESLint

### Python
- Flake8
- Black
- isort
- MyPy

### Go
- golangci-lint
- go-critic

### Rust
- Clippy

### Java
- Checkstyle

### PHP
- PHP_CodeSniffer

### Ruby
- RuboCop

### Swift
- Swift compiler

### Kotlin
- Kotlin compiler

### C/C++
- Clang
- Cppcheck

### Shell
- ShellCheck

## 📁 Directory Structure

```
lucai-cli/
├── Dockerfile              # Main application image
├── Dockerfile.tools        # Code quality tools image
├── docker-compose.yml      # Main compose file
├── docker-compose.override.yml  # Development overrides
├── .dockerignore           # Docker ignore file
├── env.example            # Environment template
└── test-code/             # Your code to review
```

## 🔍 Usage Examples

### Review a Project

```bash
# Set your code path
export CODE_PATH=/path/to/your/project

# Review the project
npm run docker:review
```

### Review Git Changes

```bash
# Review only changed files
npm run docker:review-diff
```

### Use Code Quality Tools

```bash
# Access the tools container
npm run docker:tools

# Inside the container, run tools like:
eslint /code/src/
prettier --check /code/
flake8 /code/
golangci-lint run /code/
```

### Development Mode

```bash
# Start development environment
npm run docker:dev

# The code will be mounted and changes will be reflected
```

## 🐛 Troubleshooting

### Common Issues

1. **Permission denied errors:**
   ```bash
   # Fix ownership
   sudo chown -R $USER:$USER ./test-code
   ```

2. **API key not found:**
   ```bash
   # Configure API keys
   npm run docker:configure
   ```

3. **Git operations fail:**
   ```bash
   # Ensure git config is mounted
   # Check ~/.gitconfig exists
   ```

4. **Out of space:**
   ```bash
   # Clean up Docker
   npm run docker:clean
   ```

### Debug Mode

```bash
# Run with debug logging
docker-compose run --rm -e DEBUG=lucai:* lucai review --path /code
```

## 🔒 Security

- All containers run as non-root users
- Code directory is mounted read-only
- Sensitive data stored in volumes
- Environment variables for API keys

## 📈 Performance

- Multi-stage builds for smaller images
- Alpine Linux for minimal footprint
- Redis caching for faster reviews
- Volume mounting for persistent data

## 🤝 Contributing

To add new tools or services:

1. Update `Dockerfile.tools` for new tools
2. Add service to `docker-compose.yml`
3. Update this documentation
4. Test with `npm run docker:build`

## 📝 License

Same as the main project - MIT License
