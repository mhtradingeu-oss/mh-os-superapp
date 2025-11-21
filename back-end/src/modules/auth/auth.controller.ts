import { Request, Response } from "express";
import {
  comparePassword,
  createUser,
  findUserByEmail,
  generateToken,
} from "./auth.service.js";

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ status: "error", message: "Email and password are required" });
    }

    const user = await createUser({
      email,
      password,
      name,
      role,
    });

    const token = generateToken({
      userId: user.id,
      role: user.role,
    });

    const { password: _pw, ...safeUser } = user;

    return res.json({
      status: "success",
      token,
      user: safeUser,
    });
  } catch (error: any) {
    if (error.message === "EMAIL_ALREADY_EXISTS") {
      return res
        .status(409)
        .json({ status: "error", message: "Email already in use" });
    }

    console.error("Register error:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ status: "error", message: "Email and password are required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res
        .status(401)
        .json({ status: "error", message: "Invalid credentials" });
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({ status: "error", message: "Invalid credentials" });
    }

    const token = generateToken({
      userId: user.id,
      role: user.role,
    });

    const { password: _pw, ...safeUser } = user;

    return res.json({
      status: "success",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};
