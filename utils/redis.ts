import { createClient, RedisClientType } from 'redis';

// Use the environment variable, fallback to localhost for local development
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Define the global type so TypeScript doesn't yell at us
const globalForRedis = globalThis as unknown as {
  redisClient: RedisClientType | undefined;
};

// Use the existing global connection, or create a new one if it doesn't exist
const redisClient = globalForRedis.redisClient ?? createClient({ url: redisUrl });

redisClient.on('error', (err) => console.log('❌ Redis Client Error:', err));
redisClient.on('connect', () => console.log('✅ Successfully connected to Redis'));

// Only attempt to connect if it isn't already open
if (!redisClient.isOpen) {
  redisClient.connect().catch(console.error);
}

// In development, save the connection to the global object so it survives Hot Reloads
if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redisClient = redisClient;
}

export default redisClient;