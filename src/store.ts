import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

export class KnowledgeGraphStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (dir && dir !== '.') {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);

    // Enable WAL mode for concurrent access
    this.db.pragma('journal_mode = WAL');
    // Set busy timeout to 5 seconds
    this.db.pragma('busy_timeout = 5000');

    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        name TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_name TEXT NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY (entity_name) REFERENCES entities(name) ON DELETE CASCADE,
        UNIQUE(entity_name, content)
      );

      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_entity TEXT NOT NULL,
        to_entity TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        FOREIGN KEY (from_entity) REFERENCES entities(name) ON DELETE CASCADE,
        FOREIGN KEY (to_entity) REFERENCES entities(name) ON DELETE CASCADE,
        UNIQUE(from_entity, to_entity, relation_type)
      );

      CREATE INDEX IF NOT EXISTS idx_observations_entity ON observations(entity_name);
      CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity);
      CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity);
    `);
  }

  createEntities(entities: Entity[]): Entity[] {
    const insertEntity = this.db.prepare(
      'INSERT OR IGNORE INTO entities (name, entity_type) VALUES (?, ?)'
    );
    const insertObservation = this.db.prepare(
      'INSERT OR IGNORE INTO observations (entity_name, content) VALUES (?, ?)'
    );
    const checkExists = this.db.prepare(
      'SELECT 1 FROM entities WHERE name = ?'
    );

    const created: Entity[] = [];

    const transaction = this.db.transaction((entities: Entity[]) => {
      for (const entity of entities) {
        const exists = checkExists.get(entity.name);
        if (!exists) {
          insertEntity.run(entity.name, entity.entityType);
          for (const obs of entity.observations) {
            insertObservation.run(entity.name, obs);
          }
          created.push(entity);
        }
      }
    });

    transaction(entities);
    return created;
  }

  createRelations(relations: Relation[]): Relation[] {
    const insertRelation = this.db.prepare(
      'INSERT OR IGNORE INTO relations (from_entity, to_entity, relation_type) VALUES (?, ?, ?)'
    );
    const checkExists = this.db.prepare(
      'SELECT 1 FROM relations WHERE from_entity = ? AND to_entity = ? AND relation_type = ?'
    );

    const created: Relation[] = [];

    const transaction = this.db.transaction((relations: Relation[]) => {
      for (const rel of relations) {
        const exists = checkExists.get(rel.from, rel.to, rel.relationType);
        if (!exists) {
          insertRelation.run(rel.from, rel.to, rel.relationType);
          created.push(rel);
        }
      }
    });

    transaction(relations);
    return created;
  }

  addObservations(observations: { entityName: string; contents: string[] }[]): { entityName: string; addedObservations: string[] }[] {
    const insertObservation = this.db.prepare(
      'INSERT OR IGNORE INTO observations (entity_name, content) VALUES (?, ?)'
    );
    const checkEntity = this.db.prepare(
      'SELECT 1 FROM entities WHERE name = ?'
    );
    const checkObservation = this.db.prepare(
      'SELECT 1 FROM observations WHERE entity_name = ? AND content = ?'
    );

    const results: { entityName: string; addedObservations: string[] }[] = [];

    const transaction = this.db.transaction((observations: { entityName: string; contents: string[] }[]) => {
      for (const obs of observations) {
        const entityExists = checkEntity.get(obs.entityName);
        if (!entityExists) {
          throw new Error(`Entity with name ${obs.entityName} not found`);
        }

        const added: string[] = [];
        for (const content of obs.contents) {
          const exists = checkObservation.get(obs.entityName, content);
          if (!exists) {
            insertObservation.run(obs.entityName, content);
            added.push(content);
          }
        }
        results.push({ entityName: obs.entityName, addedObservations: added });
      }
    });

    transaction(observations);
    return results;
  }

  deleteEntities(entityNames: string[]): void {
    const deleteEntity = this.db.prepare('DELETE FROM entities WHERE name = ?');
    const deleteObservations = this.db.prepare('DELETE FROM observations WHERE entity_name = ?');
    const deleteRelationsFrom = this.db.prepare('DELETE FROM relations WHERE from_entity = ?');
    const deleteRelationsTo = this.db.prepare('DELETE FROM relations WHERE to_entity = ?');

    const transaction = this.db.transaction((names: string[]) => {
      for (const name of names) {
        deleteObservations.run(name);
        deleteRelationsFrom.run(name);
        deleteRelationsTo.run(name);
        deleteEntity.run(name);
      }
    });

    transaction(entityNames);
  }

  deleteObservations(deletions: { entityName: string; observations: string[] }[]): void {
    const deleteObservation = this.db.prepare(
      'DELETE FROM observations WHERE entity_name = ? AND content = ?'
    );

    const transaction = this.db.transaction((deletions: { entityName: string; observations: string[] }[]) => {
      for (const del of deletions) {
        for (const obs of del.observations) {
          deleteObservation.run(del.entityName, obs);
        }
      }
    });

    transaction(deletions);
  }

  deleteRelations(relations: Relation[]): void {
    const deleteRelation = this.db.prepare(
      'DELETE FROM relations WHERE from_entity = ? AND to_entity = ? AND relation_type = ?'
    );

    const transaction = this.db.transaction((relations: Relation[]) => {
      for (const rel of relations) {
        deleteRelation.run(rel.from, rel.to, rel.relationType);
      }
    });

    transaction(relations);
  }

  readGraph(): KnowledgeGraph {
    const entities = this.getEntities();
    const relations = this.getRelations();
    return { entities, relations };
  }

  private getEntities(): Entity[] {
    const entityRows = this.db.prepare('SELECT name, entity_type FROM entities').all() as { name: string; entity_type: string }[];
    const getObservations = this.db.prepare('SELECT content FROM observations WHERE entity_name = ?');

    return entityRows.map(row => ({
      name: row.name,
      entityType: row.entity_type,
      observations: (getObservations.all(row.name) as { content: string }[]).map(o => o.content)
    }));
  }

  private getRelations(): Relation[] {
    const rows = this.db.prepare(
      'SELECT from_entity, to_entity, relation_type FROM relations'
    ).all() as { from_entity: string; to_entity: string; relation_type: string }[];

    return rows.map(row => ({
      from: row.from_entity,
      to: row.to_entity,
      relationType: row.relation_type
    }));
  }

  searchNodes(query: string): KnowledgeGraph {
    const lowerQuery = `%${query.toLowerCase()}%`;

    // Search entities by name, type, or observations
    const entityNames = this.db.prepare(`
      SELECT DISTINCT e.name
      FROM entities e
      LEFT JOIN observations o ON e.name = o.entity_name
      WHERE LOWER(e.name) LIKE ?
         OR LOWER(e.entity_type) LIKE ?
         OR LOWER(o.content) LIKE ?
    `).all(lowerQuery, lowerQuery, lowerQuery) as { name: string }[];

    const names = entityNames.map(e => e.name);
    if (names.length === 0) {
      return { entities: [], relations: [] };
    }

    const entities = this.getEntitiesByNames(names);
    const relations = this.getRelationsBetween(names);

    return { entities, relations };
  }

  openNodes(names: string[]): KnowledgeGraph {
    if (names.length === 0) {
      return { entities: [], relations: [] };
    }

    const entities = this.getEntitiesByNames(names);
    const relations = this.getRelationsBetween(names);

    return { entities, relations };
  }

  private getEntitiesByNames(names: string[]): Entity[] {
    const placeholders = names.map(() => '?').join(',');
    const entityRows = this.db.prepare(
      `SELECT name, entity_type FROM entities WHERE name IN (${placeholders})`
    ).all(...names) as { name: string; entity_type: string }[];

    const getObservations = this.db.prepare('SELECT content FROM observations WHERE entity_name = ?');

    return entityRows.map(row => ({
      name: row.name,
      entityType: row.entity_type,
      observations: (getObservations.all(row.name) as { content: string }[]).map(o => o.content)
    }));
  }

  private getRelationsBetween(names: string[]): Relation[] {
    const placeholders = names.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT from_entity, to_entity, relation_type
      FROM relations
      WHERE from_entity IN (${placeholders}) AND to_entity IN (${placeholders})
    `).all(...names, ...names) as { from_entity: string; to_entity: string; relation_type: string }[];

    return rows.map(row => ({
      from: row.from_entity,
      to: row.to_entity,
      relationType: row.relation_type
    }));
  }

  close(): void {
    this.db.close();
  }
}
