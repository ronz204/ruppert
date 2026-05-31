import { env } from "@env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/generated/client";

const connectionString = env.POSTGRES_URL;

const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });
