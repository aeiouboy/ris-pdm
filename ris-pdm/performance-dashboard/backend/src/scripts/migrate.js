#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { databaseService } = require('../config/database');

class MigrationRunner {
  constructor() {
    this.migrationsPath = path.join(__dirname, '../../migrations');
    this.seedsPath = path.join(__dirname, '../../seeds');
  }

  async initialize() {
    try {
      await databaseService.initialize();
      await databaseService.runMigrations();
      console.log('✅ Migration runner initialized');
    } catch (error) {
      console.error('❌ Failed to initialize migration runner:', error);
      throw error;
    }
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort()
        .map(file => ({
          version: file.split('_')[0],
          filename: file,
          filepath: path.join(this.migrationsPath, file)
        }));
    } catch (error) {
      console.error('❌ Error reading migration files:', error);
      return [];
    }
  }

  async getSeedFiles() {
    try {
      const files = await fs.readdir(this.seedsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort()
        .map(file => ({
          version: file.split('_')[0],
          filename: file,
          filepath: path.join(this.seedsPath, file)
        }));
    } catch (error) {
      console.error('❌ Error reading seed files:', error);
      return [];
    }
  }

  async runMigration(migration) {
    try {
      console.log(`🔄 Running migration: ${migration.filename}`);
      
      // Check if migration was already applied
      const isApplied = await databaseService.isMigrationApplied(migration.version);
      if (isApplied) {
        console.log(`⏭️  Migration ${migration.version} already applied, skipping`);
        return true;
      }

      // Read and execute migration file
      const migrationSQL = await fs.readFile(migration.filepath, 'utf8');
      
      // Execute migration in a transaction
      await databaseService.transaction(async (client) => {
        // Split SQL into individual statements (basic splitting)
        const statements = migrationSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            await client.query(statement);
          }
        }

        // Mark migration as applied
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [migration.version]
        );
      });

      console.log(`✅ Migration ${migration.version} completed successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  async runSeed(seed) {
    try {
      console.log(`🌱 Running seed: ${seed.filename}`);
      
      // Read and execute seed file
      const seedSQL = await fs.readFile(seed.filepath, 'utf8');
      
      // Execute seed in a transaction
      await databaseService.transaction(async (client) => {
        // Split SQL into individual statements
        const statements = seedSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            await client.query(statement);
          }
        }
      });

      console.log(`✅ Seed ${seed.version} completed successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Seed ${seed.version} failed:`, error);
      throw error;
    }
  }

  async runAllMigrations() {
    try {
      const migrations = await this.getMigrationFiles();
      
      if (migrations.length === 0) {
        console.log('📭 No migration files found');
        return;
      }

      console.log(`📦 Found ${migrations.length} migration files`);
      
      for (const migration of migrations) {
        await this.runMigration(migration);
      }

      console.log('🎉 All migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration process failed:', error);
      throw error;
    }
  }

  async runAllSeeds() {
    try {
      const seeds = await this.getSeedFiles();
      
      if (seeds.length === 0) {
        console.log('📭 No seed files found');
        return;
      }

      console.log(`🌱 Found ${seeds.length} seed files`);
      
      for (const seed of seeds) {
        await this.runSeed(seed);
      }

      console.log('🎉 All seeds completed successfully');
    } catch (error) {
      console.error('❌ Seed process failed:', error);
      throw error;
    }
  }

  async reset() {
    try {
      console.log('🔄 Resetting database...');
      
      await databaseService.transaction(async (client) => {
        // Drop all tables in reverse dependency order
        await client.query('DROP TABLE IF EXISTS individual_performance CASCADE');
        await client.query('DROP TABLE IF EXISTS performance_metrics CASCADE');  
        await client.query('DROP TABLE IF EXISTS work_items_cache CASCADE');
        await client.query('DROP TABLE IF EXISTS schema_migrations CASCADE');
        
        // Drop functions
        await client.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
        await client.query('DROP FUNCTION IF EXISTS calculate_cycle_time(TIMESTAMP, TIMESTAMP) CASCADE');
        await client.query('DROP FUNCTION IF EXISTS calculate_lead_time(TIMESTAMP, TIMESTAMP) CASCADE');
        
        // Drop views
        await client.query('DROP VIEW IF EXISTS v_latest_individual_performance CASCADE');
        await client.query('DROP VIEW IF EXISTS v_active_work_items CASCADE');
        await client.query('DROP VIEW IF EXISTS v_completed_work_items CASCADE');
      });

      console.log('✅ Database reset completed');
    } catch (error) {
      console.error('❌ Database reset failed:', error);
      throw error;
    }
  }

  async getStatus() {
    try {
      const migrations = await this.getMigrationFiles();
      const appliedMigrations = await databaseService.query(
        'SELECT version, applied_at FROM schema_migrations ORDER BY version'
      );
      
      const appliedVersions = new Set(appliedMigrations.rows.map(row => row.version));
      
      console.log('\n📊 Migration Status:');
      console.log('===================');
      
      for (const migration of migrations) {
        const status = appliedVersions.has(migration.version) ? '✅ Applied' : '⏸️  Pending';
        const appliedAt = appliedMigrations.rows.find(row => row.version === migration.version)?.applied_at;
        const dateStr = appliedAt ? ` (${appliedAt.toISOString()})` : '';
        console.log(`${migration.version}: ${status}${dateStr}`);
      }
      
      console.log(`\nTotal: ${migrations.length} migrations, ${appliedVersions.size} applied\n`);
    } catch (error) {
      console.error('❌ Error getting migration status:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const health = await databaseService.healthCheck();
      console.log('\n🏥 Database Health Check:');
      console.log('========================');
      console.log(`PostgreSQL: ${health.postgresql ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`Redis: ${health.redis ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`Timestamp: ${health.timestamp}\n`);
      return health;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  }

  async close() {
    await databaseService.close();
  }
}

// CLI interface
async function main() {
  const runner = new MigrationRunner();
  const command = process.argv[2];
  
  try {
    await runner.initialize();
    
    switch (command) {
      case 'up':
      case 'migrate':
        await runner.runAllMigrations();
        break;
        
      case 'seed':
        await runner.runAllSeeds();
        break;
        
      case 'setup':
        await runner.runAllMigrations();
        if (process.env.ENABLE_SEED_DATA === 'true') {
          await runner.runAllSeeds();
        }
        break;
        
      case 'reset':
        await runner.reset();
        await runner.runAllMigrations();
        break;
        
      case 'status':
        await runner.getStatus();
        break;
        
      case 'health':
        await runner.healthCheck();
        break;
        
      default:
        console.log('📖 Migration Runner Usage:');
        console.log('==========================');
        console.log('npm run migrate up     - Run all pending migrations');
        console.log('npm run migrate seed   - Run all seed files');
        console.log('npm run migrate setup  - Run migrations + seeds (if enabled)');
        console.log('npm run migrate reset  - Reset database and run migrations');
        console.log('npm run migrate status - Show migration status');
        console.log('npm run migrate health - Check database health');
        break;
    }
  } catch (error) {
    console.error('💥 Migration runner failed:', error);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { MigrationRunner };