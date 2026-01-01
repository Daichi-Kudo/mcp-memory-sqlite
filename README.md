# MCP Memory SQLite

A high-performance [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) memory server using SQLite with WAL mode for concurrent access.

**Drop-in replacement for `@modelcontextprotocol/server-memory` with better concurrency support.**

## Why This Package?

The official `@modelcontextprotocol/server-memory` uses JSONL files without file locking, which can lead to:

- **Race conditions** when multiple sessions access the same memory file
- **Data corruption** under concurrent write operations
- **Lost updates** when parallel agents write simultaneously

This package solves these issues by using **SQLite with WAL (Write-Ahead Logging)** mode:

| Feature | server-memory | mcp-memory-sqlite |
|---------|---------------|-------------------|
| Storage | JSONL (text file) | SQLite database |
| Concurrent reads | Limited | Unlimited |
| Concurrent writes | Race conditions | Safe (WAL mode) |
| Lock contention | No handling | 5s timeout with retry |
| Data integrity | No guarantees | ACID transactions |
| Multiple sessions | Problematic | Fully supported |

## Installation

```bash
npm install @daichi-kudo/mcp-memory-sqlite
```

## Usage

### With Claude Code

Add to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["@daichi-kudo/mcp-memory-sqlite"],
      "env": {
        "MEMORY_DB_PATH": "./.claude/memory.db"
      }
    }
  }
}
```

### With Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["@daichi-kudo/mcp-memory-sqlite"],
      "env": {
        "MEMORY_DB_PATH": "/path/to/your/memory.db"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MEMORY_DB_PATH` | Path to SQLite database file | `./memory.db` in package directory |

## Available Tools

This server provides the same Knowledge Graph API as the official memory server:

### Entity Management

- **`create_entities`** - Create multiple new entities
- **`delete_entities`** - Delete entities and their relations
- **`open_nodes`** - Retrieve specific entities by name

### Observation Management

- **`add_observations`** - Add observations to existing entities
- **`delete_observations`** - Remove specific observations

### Relation Management

- **`create_relations`** - Create relations between entities
- **`delete_relations`** - Remove relations

### Query Operations

- **`read_graph`** - Read the entire knowledge graph
- **`search_nodes`** - Search entities by name, type, or observation content

## Data Model

```
Entity
├── name (unique identifier)
├── entityType (category)
└── observations[] (facts about the entity)

Relation
├── from (source entity name)
├── to (target entity name)
└── relationType (relationship description)
```

### Example

```typescript
// Create entities
await create_entities({
  entities: [
    {
      name: "TypeScript",
      entityType: "Language",
      observations: [
        "Superset of JavaScript",
        "Adds static typing"
      ]
    }
  ]
});

// Create relations
await create_relations({
  relations: [
    {
      from: "TypeScript",
      to: "JavaScript",
      relationType: "compiles_to"
    }
  ]
});

// Search
await search_nodes({ query: "typing" });
```

## Technical Details

### SQLite Configuration

- **WAL Mode**: Enables concurrent reads while writing
- **Busy Timeout**: 5 seconds (prevents immediate lock failures)
- **Foreign Keys**: Cascade deletes for data integrity

### Schema

```sql
CREATE TABLE entities (
  name TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL
);

CREATE TABLE observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_name TEXT NOT NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (entity_name) REFERENCES entities(name) ON DELETE CASCADE,
  UNIQUE(entity_name, content)
);

CREATE TABLE relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_entity TEXT NOT NULL,
  to_entity TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  FOREIGN KEY (from_entity) REFERENCES entities(name) ON DELETE CASCADE,
  FOREIGN KEY (to_entity) REFERENCES entities(name) ON DELETE CASCADE,
  UNIQUE(from_entity, to_entity, relation_type)
);
```

## Migration from server-memory

This package is API-compatible with `@modelcontextprotocol/server-memory`. Simply:

1. Install this package
2. Update your MCP configuration to use `@daichi-kudo/mcp-memory-sqlite`
3. Set `MEMORY_DB_PATH` to your preferred location

Note: This package uses SQLite instead of JSONL, so existing JSONL data won't be automatically migrated.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev
```

## License

MIT

## Contributing

Issues and pull requests are welcome at [GitHub](https://github.com/Daichi-Kudo/mcp-memory-sqlite).
