// app/api/auth/login/route.ts

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "@/app/models/User";
import { connectDB } from "@/lib/mongodb";

const JWT_SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.JWT_SECRET ||
  "dev-secret";

function normalizeRole(role: string): string {
  const normalized = role.toLowerCase();

  if (normalized === "admin") return "Admin";
  if (normalized === "customer") return "Customer";

  return "Employee";
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    console.log("Login attempt:", email);

    await connectDB();

    console.log("Database connected");

    const user = await User.findOne({ email });

    console.log("User found:", !!user);

    if (!user) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    console.log("Stored password exists:", !!user.password);

    const valid = await bcrypt.compare(password, user.password);

    console.log("Password valid:", valid);

    if (!valid) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 }
      );
    }

    const role = normalizeRole(user.role || "employee");

    const token = jwt.sign(
      {
        sub: user._id.toString(),
        name: user.name,
        email: user.email,
        role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user._id,
          name: user.name,
          role,
          email: user.email,
        },
      },
      { status: 200 }
    );

    response.cookies.set("session", token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error: any) {
    console.error("LOGIN ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || String(error),
        stack:
          process.env.NODE_ENV === "development"
            ? error?.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}
