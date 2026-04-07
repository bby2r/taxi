# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taxi application built on **Laravel 13** (PHP 8.3+) with SQLite (default), Vite + TailwindCSS v4 frontend, and **Laravel Boost** MCP integration.

## Common Commands

```bash
# Development (runs server, queue, log viewer, and Vite concurrently)
composer run dev

# Initial setup (install deps, migrate, build)
composer run setup

# Run all tests
php artisan test --compact

# Run a single test file
php artisan test --compact tests/Feature/ExampleTest.php

# Run a specific test by name
php artisan test --compact --filter=testName

# Fix PHP code formatting (run after modifying PHP files)
vendor/bin/pint --dirty --format agent

# Frontend build
npm run build
```

## Architecture

- Standard Laravel 13 structure — no custom base folders
- SQLite database at `database/database.sqlite` (configurable via `.env`)
- Session, cache, and queue all use database driver by default
- Vite bundles frontend assets with TailwindCSS v4

## Laravel Boost Integration

This project uses Laravel Boost (`boost.json`, `.mcp.json`) which provides MCP tools. Prefer Boost tools over manual alternatives:
- `search-docs` — **always use before making code changes** to get version-specific docs
- `database-query` — run read-only queries instead of raw SQL in tinker
- `database-schema` — inspect table structure before writing migrations/models
- `get-absolute-url` — resolve correct URLs before sharing with user

## Code Conventions

- Use `php artisan make:*` commands to create new files; pass `--no-interaction` and relevant `--options`
- PHP 8 constructor property promotion, explicit return types, type hints on all parameters
- Always use curly braces for control structures, even single-line bodies
- PHPDoc blocks over inline comments; TitleCase for Enum keys
- Follow sibling file conventions for structure, approach, and naming
- For APIs, use Eloquent API Resources with versioning (unless existing routes don't)
- Use named routes and `route()` for URL generation

## Testing

- PHPUnit v12 only — convert any Pest tests to PHPUnit
- Create tests with `php artisan make:test --phpunit {name}` (add `--unit` for unit tests; most should be feature tests)
- Use model factories (check for custom states before manual setup)
- Run the minimal filtered test set after changes; ask user before running full suite
- Do not remove tests without approval

## Key Rules

- Do not change dependencies or create new base folders without approval
- Do not create documentation files unless explicitly requested
- Do not create verification scripts when tests cover the functionality
- Run `vendor/bin/pint --dirty --format agent` after modifying any PHP files
- Use single quotes for tinker: `php artisan tinker --execute 'Your::code();'`
- If a Vite manifest error occurs, run `npm run build` or `npm run dev`
- Activate the `laravel-best-practices` skill when writing/reviewing Laravel PHP code

===

<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

The Laravel Boost guidelines are specifically curated by Laravel maintainers for this application. These guidelines should be followed closely to ensure the best experience when building Laravel applications.

## Foundational Context

This application is a Laravel application and its main Laravel ecosystems package & versions are below. You are an expert with them all. Ensure you abide by these specific packages & versions.

- php - 8.4
- laravel/framework (LARAVEL) - v13
- laravel/prompts (PROMPTS) - v0
- laravel/sanctum (SANCTUM) - v4
- laravel/boost (BOOST) - v2
- laravel/mcp (MCP) - v0
- laravel/pail (PAIL) - v1
- laravel/pint (PINT) - v1
- phpunit/phpunit (PHPUNIT) - v12

## Skills Activation

This project has domain-specific skills available. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

- `laravel-best-practices` — Apply this skill whenever writing, reviewing, or refactoring Laravel PHP code. This includes creating or modifying controllers, models, migrations, form requests, policies, jobs, scheduled commands, service classes, and Eloquent queries. Triggers for N+1 and query performance issues, caching strategies, authorization and security patterns, validation, error handling, queue and job configuration, route definitions, and architectural decisions. Also use for Laravel code reviews and refactoring existing Laravel code to follow best practices. Covers any task involving Laravel backend PHP code patterns.
- `bplan` — Extract and maintain business context from existing codebases. Scans code with specialized agents, asks clarifying questions about WHY things work the way they do, and builds .ai/context/ knowledge base. Use when onboarding to a new project, when the user says "bplan", "scan the project", "extract business logic", "why does this code...", or when starting work on a large existing codebase. Also use for "bplan deep <domain>" to dive deeper into a specific area.
- `codebase-researcher` — Scan and analyze codebase structure before planning. Use this skill to gather context about a project — models, controllers, routes, migrations, config, packages, database schema, and existing patterns. Returns a structured summary for use by task-planner and other skills.
- `feature-builder` — Use this agent when you need to implement new features in a Laravel application, including creating models, controllers, migrations, routes, views, and associated business logic. This agent should be used for building complete feature sets from requirements, extending existing functionality, or implementing new modules following Laravel best practices and the project's established patterns.
- `frontend-design` — Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
- `laravel-debugger` — Use when you need to diagnose and fix issues in Laravel applications — errors, stack traces, failing queries, queue problems, auth issues, performance bottlenecks, or configuration problems. Covers Eloquent, Blade, middleware, service providers, artisan commands, and the full Laravel ecosystem.
- `laravel-simplifier` — Simplifies and refines PHP/Laravel code for clarity, consistency, and maintainability while preserving all functionality. Focuses on recently modified code unless instructed otherwise.
- `planx` — Multi-agent planner — breaks projects into features and specs. Use when "plan this", "break this down", or given a PRD/MD file.
- `task-executor` — Use when you need to execute an existing Laravel implementation plan from .ai/plans/. This includes implementing phases step-by-step using subagents, self-reviewing code, tracking progress, maintaining plan memory, writing tests, creating git commits, and writing phase summaries. Use task-planner first to create a plan, then task-executor to implement it.
- `task-planner` — Use when you need to break down complex Laravel features or projects into actionable implementation plans with phases, sub-tasks, and test specifications. Covers database design, backend logic, API endpoints, and frontend (Blade/Livewire) work. After planning, use task-executor to implement. Trigger this whenever the user asks to plan, architect, or break down a Laravel feature, migration, refactoring, or multi-step task — even if they don't say "plan" explicitly.
- `xplan` — Execute features from a plan created by planx. Multi-agent implementation pipeline — code, test, review, verify against spec, loop until done, commit. Use when "implement this", "build feature

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If the user doesn't see a frontend change reflected in the UI, it could mean they need to run `npm run build`, `npm run dev`, or `composer run dev`. Ask them.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

## Replies

- Be concise in your explanations - focus on what's important rather than explaining obvious details.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.
- Use `get-absolute-url` to resolve the correct scheme, domain, and port for project URLs. Always use this before sharing a URL with the user.
- Use `browser-logs` to read browser logs, errors, and exceptions. Only recent logs are useful, ignore old entries.

## Searching Documentation (IMPORTANT)

- Always use `search-docs` before making code changes. Do not skip this step. It returns version-specific docs based on installed packages automatically.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Artisan

- Run Artisan commands directly via the command line (e.g., `php artisan route:list`). Use `php artisan list` to discover available commands and `php artisan [command] --help` to check parameters.
- Inspect routes with `php artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `php artisan config:show app.name`, `php artisan config:show database.default`. Or read config files directly from the `config/` directory.
- To check environment variables, read the `.env` file directly.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `php artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `php artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== tests rules ===

# Test Enforcement

- Every change must be programmatically tested. Write a new test or update an existing test, then run the affected tests to make sure they pass.
- Run the minimum number of tests needed to ensure code quality and speed. Use `php artisan test --compact` with a specific filename or filter.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using `php artisan list` and check their parameters with `php artisan [command] --help`.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `php artisan make:model --help` to check the available options.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

## Vite Error

- If you receive an "Illuminate\Foundation\ViteException: Unable to locate file in Vite manifest" error, you can run `npm run build` or ask the user to run `npm run dev` or `composer run dev`.

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `vendor/bin/pint --test --format agent`, simply run `vendor/bin/pint --format agent` to fix any formatting issues.

=== phpunit/core rules ===

# PHPUnit

- This application uses PHPUnit for testing. All tests must be written as PHPUnit classes. Use `php artisan make:test --phpunit {name}` to create a new test.
- If you see a test using "Pest", convert it to PHPUnit.
- Every time a test has been updated, run that singular test.
- When the tests relating to your feature are passing, ask the user if they would like to also run the entire test suite to make sure everything is still passing.
- Tests should cover all happy paths, failure paths, and edge cases.
- You must not remove any tests or test files from the tests directory without approval. These are not temporary or helper files; these are core to the application.

## Running Tests

- Run the minimal number of tests, using an appropriate filter, before finalizing.
- To run all tests: `php artisan test --compact`.
- To run all tests in a file: `php artisan test --compact tests/Feature/ExampleTest.php`.
- To filter on a particular test name: `php artisan test --compact --filter=testName` (recommended after making a change to a related file).

</laravel-boost-guidelines>
