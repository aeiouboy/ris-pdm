// Database configuration placeholder
// In a real implementation, this would contain database connection logic

const config = {
  development: {
    // For now, using mock data
    // In production, configure your database here
    type: 'mock',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ris_performance',
    username: process.env.DB_USER || 'ris_user',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
    },
  },
  production: {
    type: 'postgresql',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: true,
    pool: {
      max: 50,
      min: 10,
      acquire: 60000,
      idle: 10000,
    },
  },
};

module.exports = config[process.env.NODE_ENV || 'development'];