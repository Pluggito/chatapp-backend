const { PrismaClient } = require('../generated/prisma');
const isProd = process.env.NODE_ENV === 'production';

// Construct DIRECT_URL from DATABASE_URL if not provided
const databaseUrl = process.env.DATABASE_URL;

const prisma = new PrismaClient({
  log: isProd ? ['warn', 'error'] : ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

// Test database connection with retry logic
const connectWithRetry = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connection established');
      return;
    } catch (err) {
      console.error(`❌ Database connection attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('❌ All database connection attempts failed');
        process.exit(1);
      }
    }
  }
};

connectWithRetry();

module.exports = prisma;