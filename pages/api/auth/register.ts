import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Validate request body with Zod schema
    const { name, email, password } = registerSchema.parse(req.body);

    // Check if the user already exists in the database
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a unique username (email prefix as base)
    let username = email.split('@')[0];
    let counter = 1;

    // Check if the generated username already exists in the database
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${email.split('@')[0]}${counter}`;
      counter++;
    }

    // Create the new user using Prisma
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        username,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Return the created user data
    return res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      username: newUser.username,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    } else {
      return res.status(500).json({ error: "An unknown error occurred" });
    }
  }
}
