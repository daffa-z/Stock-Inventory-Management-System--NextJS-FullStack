import { MongoClient } from "mongodb";

let cachedClient: MongoClient | null = null;

export const getMongoClient = async () => {
  const mongoUri = process.env.DATABASE_URL;
  if (!mongoUri) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(mongoUri);
    await cachedClient.connect();
  }

  return cachedClient;
};

export const getMongoDb = async () => {
  const client = await getMongoClient();
  const mongoUri = process.env.DATABASE_URL as string;
  const dbName = new URL(mongoUri).pathname.replace("/", "") || undefined;
  return client.db(dbName);
};

export const isReplicaSetTransactionError = (error: unknown) => {
  return (
    error instanceof Error &&
    error.message.includes("Prisma needs to perform transactions") &&
    error.message.includes("replica set")
  );
};
