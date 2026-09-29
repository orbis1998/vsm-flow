import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadDotEnv(file = ".env") {
  const full = path.resolve(file);
  if (!fs.existsSync(full)) return;
  for (const raw of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/apply-sql.mjs <file.sql>...");
  process.exit(1);
}

const passwords = [process.env.PGPASSWORD, process.env.PGPASSWORD?.replace(/]$/, "")].filter(
  (value, index, all) => Boolean(value) && all.indexOf(value) === index,
);

let lastError;
for (const password of passwords) {
  const client = new pg.Client({
    host: "aws-1-eu-west-1.pooler.supabase.com",
    port: 6543,
    user: "postgres.mkksxwbchrfftsdyzmeq",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  try {
    await client.connect();
    console.log("Connected. password length", password.length);
    try {
      for (const file of files) {
        const full = path.resolve(file);
        const sql = fs.readFileSync(full, "utf8");
        console.log("Applying", path.basename(full));
        await client.query(sql);
        console.log("OK", path.basename(full));
      }
    } finally {
      await client.end();
    }
    process.exit(0);
  } catch (error) {
    lastError = error;
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

console.error(lastError);
process.exit(1);
