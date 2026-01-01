#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";
import { KnowledgeGraphStore, Entity, Relation } from "./store.js";

// Default DB path
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.join(__dirname, "memory.db");

// Resolve DB path from environment or use default
function getDbPath(): string {
  const envPath = process.env.MEMORY_DB_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
  }
  return defaultDbPath;
}

// Zod schemas
const EntitySchema = z.object({
  name: z.string().describe("The name of the entity"),
  entityType: z.string().describe("The type of the entity"),
  observations: z.array(z.string()).describe("An array of observation contents associated with the entity")
});

const RelationSchema = z.object({
  from: z.string().describe("The name of the entity where the relation starts"),
  to: z.string().describe("The name of the entity where the relation ends"),
  relationType: z.string().describe("The type of the relation")
});

// Initialize store
const dbPath = getDbPath();
console.error(`Memory MCP Server: Using database at ${dbPath}`);
const store = new KnowledgeGraphStore(dbPath);

// Create MCP server
const server = new McpServer({
  name: "memory-mcp-sqlite",
  version: "1.0.0",
});

// Register create_entities tool
server.tool(
  "create_entities",
  "Create multiple new entities in the knowledge graph",
  {
    entities: z.array(EntitySchema)
  },
  async ({ entities }) => {
    const result = store.createEntities(entities as Entity[]);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// Register create_relations tool
server.tool(
  "create_relations",
  "Create multiple new relations between entities in the knowledge graph. Relations should be in active voice",
  {
    relations: z.array(RelationSchema)
  },
  async ({ relations }) => {
    const result = store.createRelations(relations as Relation[]);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// Register add_observations tool
server.tool(
  "add_observations",
  "Add new observations to existing entities in the knowledge graph",
  {
    observations: z.array(z.object({
      entityName: z.string().describe("The name of the entity to add the observations to"),
      contents: z.array(z.string()).describe("An array of observation contents to add")
    }))
  },
  async ({ observations }) => {
    const result = store.addObservations(observations);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// Register delete_entities tool
server.tool(
  "delete_entities",
  "Delete multiple entities and their associated relations from the knowledge graph",
  {
    entityNames: z.array(z.string()).describe("An array of entity names to delete")
  },
  async ({ entityNames }) => {
    store.deleteEntities(entityNames);
    return {
      content: [{ type: "text", text: "Entities deleted successfully" }]
    };
  }
);

// Register delete_observations tool
server.tool(
  "delete_observations",
  "Delete specific observations from entities in the knowledge graph",
  {
    deletions: z.array(z.object({
      entityName: z.string().describe("The name of the entity containing the observations"),
      observations: z.array(z.string()).describe("An array of observations to delete")
    }))
  },
  async ({ deletions }) => {
    store.deleteObservations(deletions);
    return {
      content: [{ type: "text", text: "Observations deleted successfully" }]
    };
  }
);

// Register delete_relations tool
server.tool(
  "delete_relations",
  "Delete multiple relations from the knowledge graph",
  {
    relations: z.array(RelationSchema).describe("An array of relations to delete")
  },
  async ({ relations }) => {
    store.deleteRelations(relations as Relation[]);
    return {
      content: [{ type: "text", text: "Relations deleted successfully" }]
    };
  }
);

// Register read_graph tool
server.tool(
  "read_graph",
  "Read the entire knowledge graph",
  {},
  async () => {
    const graph = store.readGraph();
    return {
      content: [{ type: "text", text: JSON.stringify(graph, null, 2) }]
    };
  }
);

// Register search_nodes tool
server.tool(
  "search_nodes",
  "Search for nodes in the knowledge graph based on a query",
  {
    query: z.string().describe("The search query to match against entity names, types, and observation content")
  },
  async ({ query }) => {
    const graph = store.searchNodes(query);
    return {
      content: [{ type: "text", text: JSON.stringify(graph, null, 2) }]
    };
  }
);

// Register open_nodes tool
server.tool(
  "open_nodes",
  "Open specific nodes in the knowledge graph by their names",
  {
    names: z.array(z.string()).describe("An array of entity names to retrieve")
  },
  async ({ names }) => {
    const graph = store.openNodes(names);
    return {
      content: [{ type: "text", text: JSON.stringify(graph, null, 2) }]
    };
  }
);

// Handle process termination
process.on("SIGINT", () => {
  store.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  store.close();
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Memory MCP SQLite Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  store.close();
  process.exit(1);
});
