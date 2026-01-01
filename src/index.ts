#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";
import { Command } from "commander";
import express from "express";
import { AsyncLocalStorage } from "async_hooks";
import { KnowledgeGraphStore, Entity, Relation } from "./store.js";

let isHttpMode = false;
const DEFAULT_PORT = 3100;

const program = new Command()
  .option("--transport <stdio|http>", "transport type", "stdio")
  .option("--port <number>", "port for HTTP transport", DEFAULT_PORT.toString())
  .allowUnknownOption()
  .parse(process.argv);

const cliOptions = program.opts();

const allowedTransports = ["stdio", "http"];
if (!allowedTransports.includes(cliOptions.transport)) {
  console.error(`Invalid --transport value: '${cliOptions.transport}'. Must be one of: stdio, http.`);
  process.exit(1);
}

const TRANSPORT_TYPE = cliOptions.transport;
isHttpMode = TRANSPORT_TYPE === "http";

const passedPortFlag = process.argv.includes("--port");
if (TRANSPORT_TYPE === "stdio" && passedPortFlag) {
  console.error("The --port flag is not allowed when using --transport stdio.");
  process.exit(1);
}

const CLI_PORT = (() => {
  const parsed = parseInt(cliOptions.port, 10);
  return isNaN(parsed) ? DEFAULT_PORT : parsed;
})();

// AsyncLocalStorage for passing project context to tool handlers
const projectContext = new AsyncLocalStorage<{ projectPath: string | null }>();

// Store manager - caches stores per project path
const storeCache = new Map<string, KnowledgeGraphStore>();

// Global fallback DB path
const globalDbPath = path.join(os.homedir(), ".claude", "memory.db");

/**
 * Get or create a store for the given project path
 */
function getStore(projectPath: string | null): KnowledgeGraphStore {
  // Determine DB path
  let dbPath: string;

  if (projectPath) {
    // Project-specific DB: <project>/.claude/memory.db
    const projectDbDir = path.join(projectPath, ".claude");
    const projectDbPath = path.join(projectDbDir, "memory.db");

    // Check if project .claude directory exists or can be created
    if (fs.existsSync(projectDbDir) || canCreateDir(projectDbDir)) {
      dbPath = projectDbPath;
    } else {
      // Fallback to global
      console.error(`[Memory] Cannot access project .claude dir, using global: ${projectPath}`);
      dbPath = globalDbPath;
    }
  } else {
    // No project path - use global
    dbPath = globalDbPath;
  }

  // Check cache
  if (storeCache.has(dbPath)) {
    return storeCache.get(dbPath)!;
  }

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Create new store
  console.error(`[Memory] Creating store for: ${dbPath}`);
  const store = new KnowledgeGraphStore(dbPath);
  storeCache.set(dbPath, store);

  return store;
}

function canCreateDir(dirPath: string): boolean {
  try {
    const parent = path.dirname(dirPath);
    return fs.existsSync(parent) && fs.accessSync(parent, fs.constants.W_OK) === undefined;
  } catch {
    return false;
  }
}

/**
 * Get current store from async context
 */
function getCurrentStore(): KnowledgeGraphStore {
  const ctx = projectContext.getStore();
  return getStore(ctx?.projectPath ?? null);
}

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

const server = new McpServer({
  name: "memory-mcp-sqlite",
  version: "1.0.0",
});

server.tool("create_entities", "Create multiple new entities in the knowledge graph",
  { entities: z.array(EntitySchema) },
  async ({ entities }) => {
    const store = getCurrentStore();
    const result = store.createEntities(entities);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

server.tool("create_relations", "Create multiple new relations between entities in the knowledge graph. Relations should be in active voice",
  { relations: z.array(RelationSchema) },
  async ({ relations }) => {
    const store = getCurrentStore();
    const result = store.createRelations(relations);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

server.tool("add_observations", "Add new observations to existing entities in the knowledge graph",
  { observations: z.array(z.object({
      entityName: z.string().describe("The name of the entity to add the observations to"),
      contents: z.array(z.string()).describe("An array of observation contents to add")
    })) },
  async ({ observations }) => {
    const store = getCurrentStore();
    const result = store.addObservations(observations);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

server.tool("delete_entities", "Delete multiple entities and their associated relations from the knowledge graph",
  { entityNames: z.array(z.string()).describe("An array of entity names to delete") },
  async ({ entityNames }) => {
    const store = getCurrentStore();
    store.deleteEntities(entityNames);
    return { content: [{ type: "text", text: "Entities deleted successfully" }] };
  });

server.tool("delete_observations", "Delete specific observations from entities in the knowledge graph",
  { deletions: z.array(z.object({
      entityName: z.string().describe("The name of the entity containing the observations"),
      observations: z.array(z.string()).describe("An array of observations to delete")
    })) },
  async ({ deletions }) => {
    const store = getCurrentStore();
    store.deleteObservations(deletions);
    return { content: [{ type: "text", text: "Observations deleted successfully" }] };
  });

server.tool("delete_relations", "Delete multiple relations from the knowledge graph",
  { relations: z.array(RelationSchema).describe("An array of relations to delete") },
  async ({ relations }) => {
    const store = getCurrentStore();
    store.deleteRelations(relations);
    return { content: [{ type: "text", text: "Relations deleted successfully" }] };
  });

server.tool("read_graph", "Read the entire knowledge graph", {},
  async () => {
    const store = getCurrentStore();
    const graph = store.readGraph();
    return { content: [{ type: "text", text: JSON.stringify(graph, null, 2) }] };
  });

server.tool("search_nodes", "Search for nodes in the knowledge graph based on a query",
  { query: z.string().describe("The search query to match against entity names, types, and observation content") },
  async ({ query }) => {
    const store = getCurrentStore();
    const graph = store.searchNodes(query);
    return { content: [{ type: "text", text: JSON.stringify(graph, null, 2) }] };
  });

server.tool("open_nodes", "Open specific nodes in the knowledge graph by their names",
  { names: z.array(z.string()).describe("An array of entity names to retrieve") },
  async ({ names }) => {
    const store = getCurrentStore();
    const graph = store.openNodes(names);
    return { content: [{ type: "text", text: JSON.stringify(graph, null, 2) }] };
  });

process.on("SIGINT", () => {
  if (isHttpMode) {
    console.error("Received SIGINT - ignoring for multi-session stability (HTTP mode)");
  } else {
    // Close all stores
    for (const store of storeCache.values()) {
      store.close();
    }
    process.exit(0);
  }
});

process.on("SIGTERM", () => {
  console.error("Received SIGTERM - shutting down gracefully");
  // Close all stores
  for (const store of storeCache.values()) {
    store.close();
  }
  process.exit(0);
});

async function main() {
  // Ensure global .claude directory exists
  const globalDbDir = path.dirname(globalDbPath);
  if (!fs.existsSync(globalDbDir)) {
    fs.mkdirSync(globalDbDir, { recursive: true });
  }

  console.error(`[Memory] Global DB path: ${globalDbPath}`);
  console.error(`[Memory] Per-project DBs enabled via Mcp-Project-Path header`);

  if (TRANSPORT_TYPE === "http") {
    const app = express();
    app.use(express.json());

    app.use((req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Mcp-Project-Path");
      res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
      if (req.method === "OPTIONS") { res.sendStatus(200); return; }
      next();
    });

    app.all("/mcp", async (req, res) => {
      // Read project path from header
      const projectPath = req.headers["mcp-project-path"] as string | undefined;

      // Run handler with project context
      await projectContext.run({ projectPath: projectPath || null }, async () => {
        try {
          const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
          res.on("close", () => { transport.close(); });
          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);
        } catch (error) {
          console.error("Error handling MCP request:", error);
          if (!res.headersSent) {
            res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
          }
        }
      });
    });

    app.get("/ping", (_req, res) => {
      res.json({
        status: "ok",
        message: "pong",
        transport: "http",
        globalDbPath,
        cachedStores: storeCache.size
      });
    });

    app.use((_req, res) => {
      res.status(404).json({
        error: "not_found",
        message: "Endpoint not found. Use /mcp for MCP protocol communication."
      });
    });

    const startServer = (port: number, maxAttempts = 10) => {
      const httpServer = app.listen(port);
      httpServer.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && port < CLI_PORT + maxAttempts) {
          console.warn(`Port ${port} is in use, trying port ${port + 1}...`);
          startServer(port + 1, maxAttempts);
        } else {
          console.error(`Failed to start server: ${err.message}`);
          process.exit(1);
        }
      });
      httpServer.once("listening", () => {
        console.error(`Memory MCP SQLite Server running on HTTP at http://localhost:${port}/mcp`);
      });
    };

    startServer(CLI_PORT);
  } else {
    // Stdio mode - use global store (no project context available)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Memory MCP SQLite Server running on stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  // Close all stores
  for (const store of storeCache.values()) {
    store.close();
  }
  process.exit(1);
});
