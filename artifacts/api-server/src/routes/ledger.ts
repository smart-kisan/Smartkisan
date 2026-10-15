import { Router, type IRouter } from "express";
import {
  CreateLedgerEntryBody,
  CreateLedgerEntryResponse,
  DeleteLedgerEntryParams,
  GetLedgerEntriesResponse,
} from "@workspace/api-zod";
import { signedInUserId } from "../lib/clerkUser";
import { getSupabaseAdmin, supabaseUnavailable } from "../lib/supabaseAdmin";

const router: IRouter = Router();

async function isFarmer(userId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.role === "farmer";
}

router.get("/ledger/entries", async (req, res): Promise<void> => {
  const userId = signedInUserId(req, res);
  if (!userId) return;
  try {
    if (!(await isFarmer(userId))) {
      res.status(403).json({ error: "The KhetKhata ledger is available to farmer profiles." });
      return;
    }
    const { data, error } = await getSupabaseAdmin()
      .from("farm_ledger_entries")
      .select("id,category,description,amount,hours,entry_date,created_at")
      .eq("farmer_id", userId)
      .order("entry_date", { ascending: false });
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    res.json(GetLedgerEntriesResponse.parse((data ?? []).map((row) => ({
      id: String(row.id),
      category: row.category,
      description: row.description,
      amount: Number(row.amount),
      hours: row.hours == null ? null : Number(row.hours),
      entryDate: String(row.entry_date),
      createdAt: String(row.created_at),
    }))));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.post("/ledger/entries", async (req, res): Promise<void> => {
  const userId = signedInUserId(req, res);
  if (!userId) return;
  const body = CreateLedgerEntryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  try {
    if (!(await isFarmer(userId))) {
      res.status(403).json({ error: "The KhetKhata ledger is available to farmer profiles." });
      return;
    }
    const { data, error } = await getSupabaseAdmin()
      .from("farm_ledger_entries")
      .insert({
        farmer_id: userId,
        category: body.data.category,
        description: body.data.description.trim(),
        amount: body.data.amount,
        hours: body.data.hours ?? null,
        entry_date: body.data.entryDate,
      })
      .select("id,category,description,amount,hours,entry_date,created_at")
      .single();
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    res.status(201).json(CreateLedgerEntryResponse.parse({
      id: String(data.id),
      category: data.category,
      description: data.description,
      amount: Number(data.amount),
      hours: data.hours == null ? null : Number(data.hours),
      entryDate: String(data.entry_date),
      createdAt: String(data.created_at),
    }));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.delete("/ledger/entries/:entryId", async (req, res): Promise<void> => {
  const userId = signedInUserId(req, res);
  if (!userId) return;
  const rawId = Array.isArray(req.params.entryId) ? req.params.entryId[0] : req.params.entryId;
  const params = DeleteLedgerEntryParams.safeParse({ entryId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("farm_ledger_entries")
      .delete()
      .eq("id", params.data.entryId)
      .eq("farmer_id", userId)
      .select("id");
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    if (!data?.length) {
      res.status(404).json({ error: "Ledger entry not found." });
      return;
    }
    res.sendStatus(204);
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

export default router;
