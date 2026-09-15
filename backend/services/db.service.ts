// ============================================================================
// SERVICE BASE DE DONNÉES HYBRIDE (PostgreSQL & Fallback Résilient)
// Gère le pool de connexions PostgreSQL avec auto-initialisation du schéma
// et bascule sans interruption vers le store local si PostgreSQL est inaccessible.
// ============================================================================

import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface DatabaseStatus {
  connected: boolean;
  provider: 'postgresql' | 'json_fallback';
  database?: string;
  host?: string;
  port?: number;
  uptimeSeconds: number;
}

class DatabaseService {
  private pool: Pool | null = null;
  private isConnected: boolean = false;
  private startTime: number = Date.now();
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor() {
    this.initPool();
  }

  /**
   * Initialise le pool de connexion PostgreSQL
   */
  private initPool(): void {
    try {
      const config: PoolConfig = {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: Number(process.env.POSTGRES_PORT) || 5432,
        user: process.env.POSTGRES_USER || 'santeplus',
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB || 'santeplus',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 4000,
      };

      if (process.env.DATABASE_URL) {
        const url = process.env.DATABASE_URL;
        const requiresSsl = process.env.DB_SSL === 'true' ||
                            process.env.PGSSLMODE === 'require' ||
                            url.includes('sslmode=require') ||
                            url.includes('render.com') ||
                            url.includes('supabase.co') ||
                            url.includes('neon.tech');
        this.pool = new Pool({
          connectionString: url,
          connectionTimeoutMillis: 10000,
          ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
        });
      } else {
        this.pool = new Pool(config);
      }

      this.pool.on('error', (err) => {
        console.warn(`[PostgreSQL Pool Error] ${err.message}`);
        this.isConnected = false;
      });
    } catch (err: any) {
      console.warn('[PostgreSQL Init] Échec configuration pool:', err.message);
      this.pool = null;
    }
  }

  /**
   * Teste la connexion et initialise le schéma SQL si connecté
   */
  public async testAndInit(): Promise<boolean> {
    if (!this.pool) {
      if (this.isProduction) throw new Error('PostgreSQL pool is not configured');
      return false;
    }

    try {
      const client = await this.pool.connect();
      try {
        const res = await client.query('SELECT NOW() as current_time, version()');
        this.isConnected = true;
        console.log(`[PostgreSQL] ✅ Connecté avec succès à la base ${process.env.POSTGRES_DB || 'santeplus'}`);
        
        // Auto-initialisation du schéma SQL
        await this.runInitSql(client);
        return true;
      } finally {
        client.release();
      }
    } catch (err: any) {
      this.isConnected = false;
      if (this.isProduction) {
        throw new Error(`PostgreSQL is required in production: ${err.message}`);
      }
      console.log(`[Database] ℹ️ PostgreSQL hors ligne (${err.message}) → Mode JSON développement.`);
      return false;
    }
  }

  /**
   * Exécute les migrations et le schéma d'initialisation
   */
  private async runInitSql(client: any): Promise<void> {
    const initSqlPath = path.join(process.cwd(), 'backend', 'init-db.sql');
    if (fs.existsSync(initSqlPath)) {
      try {
        const sql = fs.readFileSync(initSqlPath, 'utf8');
        await client.query(sql);
        console.log('[PostgreSQL] 📋 Schéma et tables Santé+ vérifiés / initialisés.');
      } catch (err: any) {
        console.warn('[PostgreSQL] Erreur chargement init-db.sql:', err.message);
        if (this.isProduction) {
          throw new Error(`PostgreSQL schema initialization failed: ${err.message}`);
        }
      }
    }
  }

  /**
   * Exécute une requête SQL sécurisée avec paramètres
   */
  public async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T> | null> {
    if (!this.isConnected || !this.pool) {
      return null;
    }

    try {
      return await this.pool.query<T>(text, params);
    } catch (err: any) {
      console.error(`[PostgreSQL Query Error] "${text.slice(0, 60)}...":`, err.message);
      throw err;
    }
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T | null> {
    if (!this.isConnected || !this.pool) {
      return null;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Récupère l'état actuel de la base de données pour le monitoring et la page /api/health
   */
  public getStatus(): DatabaseStatus {
    return {
      connected: this.isConnected,
      provider: this.isConnected ? 'postgresql' : 'json_fallback',
      database: process.env.POSTGRES_DB || 'santeplus',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT) || 5432,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * Fermeture propre du pool lors de l'arrêt du serveur
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
    }
  }
}

export const dbService = new DatabaseService();
export default dbService;
