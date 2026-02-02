#!/usr/bin/env node

/**
 * Database Migration Runner for Cheesy Parts
 *
 * Usage:
 *   npm run migrate              # Run pending migrations
 *   npm run migrate:status       # Show migration status
 *   npm run migrate:create NAME  # Create a new migration file
 *
 * Environment:
 *   DATABASE_URL - PostgreSQL connection string (from Supabase dashboard)
 *   Set in backend/.dev.vars or as environment variable
 */

import postgres from "postgres";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .dev.vars file (simple key=value format)
function parseDevVars(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  const content = readFileSync(filePath, "utf-8");
  const vars = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        vars[key] = value;
      }
    }
  }
  return vars;
}

// Load environment from backend/.dev.vars
const devVarsPath = join(__dirname, "..", "backend", ".dev.vars");
const env = parseDevVars(devVarsPath);

const DATABASE_URL = env.DATABASE_URL || process.env.DATABASE_URL;
const migrationsDir = join(__dirname, "migrations");

// Only create SQL client when needed (not for create command)
let sql = null;
function getSql() {
  if (!sql) {
    if (!DATABASE_URL) {
      console.error("Error: Missing DATABASE_URL");
      console.error("");
      console.error("Add DATABASE_URL to backend/.dev.vars:");
      console.error("  DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres");
      console.error("");
      console.error("Find your connection string in Supabase Dashboard:");
      console.error("  Project Settings → Database → Connection string → URI");
      process.exit(1);
    }
    sql = postgres(DATABASE_URL);
  }
  return sql;
}

// Ensure schema_migrations table exists
async function ensureMigrationsTable() {
  const db = getSql();
  await db`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
}

// Get list of migration files sorted by version
function getMigrationFiles() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files
    .map((filename) => {
      const match = filename.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        console.warn(`Warning: Skipping invalid migration filename: ${filename}`);
        return null;
      }
      return {
        filename,
        version: match[1],
        name: match[2],
        path: join(migrationsDir, filename),
      };
    })
    .filter(Boolean);
}

// Get applied migrations from database
async function getAppliedMigrations() {
  await ensureMigrationsTable();
  const db = getSql();

  const rows = await db`
    SELECT version, name, applied_at
    FROM schema_migrations
    ORDER BY version
  `;

  return rows;
}

// Run a single migration
async function runMigration(migration) {
  const sqlContent = readFileSync(migration.path, "utf-8");
  const db = getSql();

  console.log(`Running migration: ${migration.filename}`);

  try {
    // Run migration in a transaction
    await db.begin(async (tx) => {
      // Execute the migration SQL using unsafe (for DDL statements)
      await tx.unsafe(sqlContent);

      // Record the migration
      await tx`
        INSERT INTO schema_migrations (version, name)
        VALUES (${migration.version}, ${migration.name})
      `;
    });

    console.log(`  ✓ Applied: ${migration.version}_${migration.name}`);
  } catch (error) {
    console.error(`  ✗ Failed: ${migration.version}_${migration.name}`);
    throw error;
  }
}

// Show migration status
async function showStatus() {
  const files = getMigrationFiles();
  const applied = await getAppliedMigrations();
  const appliedVersions = new Set(applied.map((m) => m.version));

  console.log("\nMigration Status:");
  console.log("=".repeat(60));

  if (files.length === 0) {
    console.log("No migration files found.");
    await getSql().end();
    return;
  }

  for (const file of files) {
    const isApplied = appliedVersions.has(file.version);
    const status = isApplied ? "✓ applied" : "○ pending";
    const appliedInfo = applied.find((m) => m.version === file.version);
    const date = appliedInfo
      ? ` (${new Date(appliedInfo.applied_at).toLocaleDateString()})`
      : "";
    console.log(`  ${status}  ${file.version}_${file.name}${date}`);
  }

  const pending = files.filter((f) => !appliedVersions.has(f.version));
  console.log("=".repeat(60));
  console.log(
    `Total: ${files.length} migrations, ${applied.length} applied, ${pending.length} pending\n`
  );

  await getSql().end();
}

// Run pending migrations
async function runMigrations() {
  const files = getMigrationFiles();
  const applied = await getAppliedMigrations();
  const appliedVersions = new Set(applied.map((m) => m.version));

  const pending = files.filter((f) => !appliedVersions.has(f.version));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    await getSql().end();
    return;
  }

  console.log(`\nRunning ${pending.length} pending migration(s)...\n`);

  for (const migration of pending) {
    await runMigration(migration);
  }

  console.log("\nAll migrations applied successfully.\n");
  await getSql().end();
}

// Create a new migration file
function createMigration(name) {
  if (!name) {
    console.error("Error: Migration name required.");
    console.error("Usage: npm run migrate:create <name>");
    process.exit(1);
  }

  // Sanitize name: lowercase, replace spaces with underscores
  const safeName = name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  // Find next version number
  const files = getMigrationFiles();
  let nextVersion = "001";
  if (files.length > 0) {
    const lastVersion = parseInt(files[files.length - 1].version, 10);
    nextVersion = String(lastVersion + 1).padStart(3, "0");
  }

  const filename = `${nextVersion}_${safeName}.sql`;
  const filepath = join(migrationsDir, filename);

  const template = `-- Migration: ${safeName}
-- Created: ${new Date().toISOString()}

-- Write your SQL migration here

`;

  writeFileSync(filepath, template);
  console.log(`Created migration: database/migrations/${filename}`);
}

// Seed the initial migration as applied (for existing databases)
async function seedInitialMigration() {
  await ensureMigrationsTable();
  const db = getSql();

  // Check if 001_initial_schema is already marked as applied
  const existing = await db`
    SELECT version FROM schema_migrations WHERE version = '001'
  `;

  if (existing.length === 0) {
    await db`
      INSERT INTO schema_migrations (version, name)
      VALUES ('001', 'initial_schema')
    `;
    console.log("Seeded initial migration as applied.");
  } else {
    console.log("Initial migration already seeded.");
  }

  await db.end();
}

// Main
async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes("--status")) {
      await showStatus();
    } else if (args.includes("--create")) {
      const nameIndex = args.indexOf("--create") + 1;
      const name = args[nameIndex];
      createMigration(name);
    } else if (args.includes("--seed")) {
      await seedInitialMigration();
    } else {
      await runMigrations();
    }
  } catch (error) {
    console.error("Migration error:", error.message);
    if (sql) await sql.end();
    process.exit(1);
  }
}

main();
