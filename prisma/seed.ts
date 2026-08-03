import "dotenv/config";

import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { hashPassword } from "@/lib";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: "SUPER_ADMIN",
    },
  });

  if (existingAdmin) {
    console.log("SUPER_ADMIN already exists.");
    return;
  }

  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!bootstrapPassword) {
    throw new Error(
      "BOOTSTRAP_ADMIN_PASSWORD is required to create the initial SUPER_ADMIN.",
    );
  }

  const passwordHash = await hashPassword(bootstrapPassword);

  await prisma.user.create({
    data: {
      employeeNumber: "SYS-001",

      username: "admin",
      email: "admin@nemesys.local",
      passwordHash,

      firstName: "System",
      lastName: "Administrator",

      gender: "MALE",

      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("SUPER_ADMIN created.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
