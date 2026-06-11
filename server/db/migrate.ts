import { pool } from './client';
import { migrate } from './schema';

async function main() {
  await migrate();
  await pool.end();
  console.log('Database migration completed');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
