# AudioShader Makefile
# Run `make help` to see available commands

.PHONY: help init dev build test test-unit test-e2e check clean install-deps

# Default target
help:
	@echo "AudioShader Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make init          Install all dependencies (npm + Playwright browsers)"
	@echo "  make install-deps  Install system dependencies for Playwright (Linux/WSL)"
	@echo ""
	@echo "Development:"
	@echo "  make dev           Start development server with hot reload"
	@echo "  make build         Build for production"
	@echo ""
	@echo "Testing:"
	@echo "  make test          Run all tests (unit + E2E)"
	@echo "  make test-unit     Run unit tests only"
	@echo "  make test-e2e      Run E2E tests only"
	@echo "  make check         Full quality check (typecheck + lint + unit tests)"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean         Remove build artifacts and node_modules"

# Initialize project - install all dependencies
init: node_modules playwright-browsers
	@echo "✓ Project initialized successfully"
	@echo ""
	@echo "Run 'make dev' to start the development server"

node_modules: package.json package-lock.json
	npm install
	@touch node_modules

playwright-browsers: node_modules
	npx playwright install
	@mkdir -p .playwright-installed
	@touch .playwright-installed/.done

.playwright-installed/.done:
	npx playwright install
	@mkdir -p .playwright-installed
	@touch .playwright-installed/.done

# Development server
dev: node_modules
	npm run dev

# Production build
build: node_modules
	npm run build

# Run all tests
test: test-unit test-e2e

# Unit tests only
test-unit: node_modules
	npm run test:run

# E2E tests only (requires Playwright browsers)
test-e2e: node_modules .playwright-installed/.done
	npm run test:e2e

# Full quality check (typecheck + lint + unit tests)
check: node_modules
	npm run check

# Clean build artifacts and dependencies
clean:
	rm -rf node_modules
	rm -rf dist
	rm -rf .playwright-installed
	rm -rf coverage
	@echo "✓ Cleaned build artifacts and dependencies"

# Install system dependencies for Playwright (Linux/WSL only)
install-deps: node_modules
	npx playwright install-deps
	@echo "✓ System dependencies installed"
