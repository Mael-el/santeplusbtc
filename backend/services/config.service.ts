import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function getSecret(name: string, fallback: string): string {
  const value = process.env[name]?.trim();

  if (value) {
    return value;
  }

  console.warn(`[Config] ${name} is missing; using a temporary fallback value. Set it in the environment before production use.`);
  return fallback;
}

export const authConfig = {
  accessSecret: getSecret('JWT_SECRET', 'santeplus-dev-access-secret-change-me'),
  refreshSecret: getSecret('JWT_REFRESH_SECRET', 'santeplus-dev-refresh-secret-change-me'),
};
