import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

type QueryRow = Record<string, unknown>;
type RunResult = { meta: { changes: number } };

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is not configured.');
  return value;
}

function numberedPlaceholders(query: string) {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`);
}

export class PostgresStatement {
  private values: unknown[] = [];

  constructor(
    private readonly sql: NeonQueryFunction<false, true>,
    private readonly query: string,
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  private execute() {
    return this.sql.query(numberedPlaceholders(this.query), this.values);
  }

  async first<T extends QueryRow = QueryRow>(): Promise<T | null> {
    const result = await this.execute();
    return (result.rows[0] as T | undefined) ?? null;
  }

  async all<T extends QueryRow = QueryRow>(): Promise<{ results: T[] }> {
    const result = await this.execute();
    return { results: result.rows as T[] };
  }

  async run(): Promise<RunResult> {
    const result = await this.execute();
    return { meta: { changes: result.rowCount ?? 0 } };
  }
}

class PostgresDatabase {
  private readonly sql = neon(databaseUrl(), { fullResults: true });

  prepare(query: string) {
    return new PostgresStatement(this.sql, query);
  }

  async batch(statements: PostgresStatement[]) {
    const results: RunResult[] = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

let database: PostgresDatabase | undefined;

export function getDb() {
  database ??= new PostgresDatabase();
  return database;
}

export function getTokenKey(): string {
  const value = process.env.POSTMASTER_TOKEN_KEY;
  if (!value) throw new Error('POSTMASTER_TOKEN_KEY is not configured.');
  return value;
}
