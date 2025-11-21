import prisma from "@src/core/prisma.js";
import bcrypt from "bcryptjs";

export async function seedAdmin() {
  console.log("🔍 Checking for existing ADMIN user...");

  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (existingAdmin) {
    console.log("✔️ ADMIN already exists → Skipping.");
    return existingAdmin;
  }

  console.log("⚡ Creating default ADMIN user...");

  const hashedPassword = await bcrypt.hash("Admin@12345", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@mh-trading.com",
      password: hashedPassword,
      name: "System Administrator",
      role: "ADMIN",
    },
  });

  console.log("🎉 Default ADMIN created:");
  console.log("➡ Email: admin@mh-trading.com");
  console.log("➡ Temp Password: Admin@12345");

  return admin;
}
