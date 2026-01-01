# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-02

### Added

- **HTTP Transport Support** - New `--transport http` option for HTTP-based communication
- **Per-Project Database** - Automatic project-specific database support via `Mcp-Project-Path` header
- **Store Caching** - Multiple database connections managed efficiently with `Map<dbPath, KnowledgeGraphStore>`
- **Port Auto-Retry** - Automatic port fallback when default port is in use

### Changed

- Global database path moved to `~/.claude/memory.db`
- Enhanced graceful shutdown handling for HTTP mode

### Technical

- Added `express` and `commander` dependencies
- HTTP endpoint: `/mcp` for MCP protocol, `/ping` for health check
- AsyncLocalStorage for per-request project context

## [1.0.0] - 2025-01-01

### Added

- Initial release with SQLite WAL mode support
- Thread-safe concurrent access for multiple sessions
- Drop-in replacement API for `@modelcontextprotocol/server-memory`
- ACID transaction guarantees
- 5-second busy timeout with retry logic
- Knowledge Graph API:
  - `create_entities` - Create multiple entities
  - `create_relations` - Create relations between entities
  - `add_observations` - Add observations to entities
  - `delete_entities` - Delete entities with cascade
  - `delete_observations` - Remove specific observations
  - `delete_relations` - Remove relations
  - `read_graph` - Read entire knowledge graph
  - `search_nodes` - Search by name, type, or content
  - `open_nodes` - Retrieve specific entities

### Technical

- SQLite with WAL (Write-Ahead Logging) mode
- `better-sqlite3` for synchronous, high-performance operations
- Automatic directory creation for database path
- Indexed queries for fast search operations
