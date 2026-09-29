import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadDotEnv(file = ".env") {
  const full = path.resolve(file);
  for (const raw of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

const client = new pg.Client({
  host: "aws-1-eu-west-1.pooler.supabase.com",
  port: 6543,
  user: "postgres.mkksxwbchrfftsdyzmeq",
  password: process.env.PGPASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

await client.connect();
const { rows } = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`);
const counts = [];
for (const { table_name } of rows) {
  const r = await client.query(`select count(*)::int as n from ${table_name}`);
  counts.push({ table: table_name, rows: r.rows[0].n });
}
await client.end();
console.log(JSON.stringify({ tables: rows.length, counts }, null, 2));
