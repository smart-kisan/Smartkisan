import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateMandiTaxRuleBody,
  CreateMandiTaxRuleResponse,
  CreateMspPriceBody,
  CreateMspPriceResponse,
  GetGovernmentOverviewResponse,
  GetMandiTaxRulesResponse,
  GetMspPricesResponse,
} from "@workspace/api-zod";
import { signedInUserId } from "../lib/clerkUser";
import { getSupabaseAdmin, supabaseUnavailable } from "../lib/supabaseAdmin";

const router: IRouter = Router();
const mspColumns =
  "id,crop,state,mandi,price_per_quintal,effective_date,source";
const taxColumns = "id,state,tax_rate,effective_date,source";

function mspPriceResponse(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    crop: String(row.crop),
    state: String(row.state),
    mandi: typeof row.mandi === "string" ? row.mandi : null,
    pricePerQuintal: Number(row.price_per_quintal),
    effectiveDate: String(row.effective_date),
    source: String(row.source),
  };
}

function mandiTaxRuleResponse(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    state: String(row.state),
    taxRate: Number(row.tax_rate),
    effectiveDate: String(row.effective_date),
    source: String(row.source),
  };
}

async function requireMandiAdmin(
  req: Request,
  res: Response,
  supabase: ReturnType<typeof getSupabaseAdmin>,
): Promise<string | null> {
  const userId = signedInUserId(req, res);
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    supabaseUnavailable(req, res, error);
    return null;
  }
  if (!data || !["admin", "mandi_admin"].includes(data.role)) {
    res.status(403).json({
      error: "Only an authorized mandi administrator can update government records.",
    });
    return null;
  }
  return userId;
}

router.get("/government/overview", async (req, res): Promise<void> => {
  try {
    const { data, error } = await getSupabaseAdmin().rpc("get_government_overview");
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    res.json(GetGovernmentOverviewResponse.parse({
      farmerCount: Number(row?.farmer_count ?? 0),
      buyerCount: Number(row?.buyer_count ?? 0),
      listingCount: Number(row?.listing_count ?? 0),
      activeBidCount: Number(row?.active_bid_count ?? 0),
      settledValue: Number(row?.settled_value ?? 0),
      taxTracked: Number(row?.tax_tracked ?? 0),
      mspAlertCount: Number(row?.msp_alert_count ?? 0),
    }));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.get("/government/msp", async (req, res): Promise<void> => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("msp_reference_prices")
      .select(mspColumns)
      .lte("effective_date", new Date().toISOString().slice(0, 10))
      .order("effective_date", { ascending: false })
      .limit(1000);
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }

    // Return the most recent effective record for each crop/state/mandi pair.
    const latest = new Map<string, Record<string, unknown>>();
    for (const row of data ?? []) {
      const key = [
        String(row.crop).trim().toLocaleLowerCase(),
        String(row.state).trim().toLocaleLowerCase(),
        String(row.mandi ?? "").trim().toLocaleLowerCase(),
      ].join("|");
      if (!latest.has(key)) latest.set(key, row);
    }
    res.json(GetMspPricesResponse.parse([...latest.values()].map(mspPriceResponse)));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.post("/government/msp", async (req, res): Promise<void> => {
  try {
    const supabase = getSupabaseAdmin();
    const userId = await requireMandiAdmin(req, res, supabase);
    if (!userId) return;

    const parsed = CreateMspPriceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const input = parsed.data;
    const { data, error } = await supabase
      .from("msp_reference_prices")
      .insert({
        crop: input.crop.trim(),
        state: input.state.trim(),
        mandi: input.mandi?.trim() || null,
        price_per_quintal: input.pricePerQuintal,
        effective_date: input.effectiveDate,
        source: input.source.trim(),
        created_by: userId,
      })
      .select(mspColumns)
      .single();
    if (error) {
      if (error.code === "23505") {
        res.status(409).json({
          error: "An MSP record already exists for this crop, location, and effective date.",
        });
        return;
      }
      supabaseUnavailable(req, res, error);
      return;
    }
    res.status(201).json(CreateMspPriceResponse.parse(mspPriceResponse(data)));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.get("/government/tax-rules", async (req, res): Promise<void> => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("mandi_tax_rules")
      .select(taxColumns)
      .lte("effective_date", new Date().toISOString().slice(0, 10))
      .order("effective_date", { ascending: false })
      .limit(1000);
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }

    // The latest effective rule wins for each state.
    const latest = new Map<string, Record<string, unknown>>();
    for (const row of data ?? []) {
      const key = String(row.state).trim().toLocaleLowerCase();
      if (!latest.has(key)) latest.set(key, row);
    }
    res.json(
      GetMandiTaxRulesResponse.parse([...latest.values()].map(mandiTaxRuleResponse)),
    );
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.post("/government/tax-rules", async (req, res): Promise<void> => {
  try {
    const supabase = getSupabaseAdmin();
    const userId = await requireMandiAdmin(req, res, supabase);
    if (!userId) return;

    const parsed = CreateMandiTaxRuleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const input = parsed.data;
    const { data, error } = await supabase
      .from("mandi_tax_rules")
      .insert({
        state: input.state.trim(),
        tax_rate: input.taxRate,
        effective_date: input.effectiveDate,
        source: input.source.trim(),
        created_by: userId,
      })
      .select(taxColumns)
      .single();
    if (error) {
      if (error.code === "23505") {
        res.status(409).json({
          error: "A mandi tax rule already exists for this state and effective date.",
        });
        return;
      }
      supabaseUnavailable(req, res, error);
      return;
    }
    res
      .status(201)
      .json(CreateMandiTaxRuleResponse.parse(mandiTaxRuleResponse(data)));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

export default router;
