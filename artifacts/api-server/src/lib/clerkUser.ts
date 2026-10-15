import { getAuth } from "@clerk/express";
import type { Request, Response } from "express";

export function signedInUserId(req: Request, res: Response): string | null {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return null;
  }
  return userId;
}
