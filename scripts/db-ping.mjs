import pg from "pg";

const user = "postgres.mkksxwbchrfftsdyzmeq";
const host = "aws-1-eu-west-1.pooler.supabase.com";
const passwords = [process.env.PGPASSWORD, process.env.PGPASSWORD_ALT].filter(Boolean);

const results = [];

for (const password of [...new Set(passwords)]) {
  const client = new pg.Client({
    host,
    port: 6543,
    user,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    const version = (await client.query("select version()")).rows[0];
    const who = (await client.query("select current_user, current_database()")).rows[0];
    const tables = (
      await client.query(`
        select table_schema, table_name
        from information_schema.tables
        where table_schema not in ('pg_catalog', 'information_schema')
          and table_type = 'BASE TABLE'
        order by table_schema, table_name
      `)
    ).rows;
    await client.end();
    console.log(JSON.stringify({ ok: true, host, ...version, ...who, tables }, null, 2));
    process.exit(0);
  } catch (error) {
    results.push({ error: `${error.code ?? ""} ${error.message}`.trim() });
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

console.error(JSON.stringify({ ok: false, results }, null, 2));
process.exit(1);
