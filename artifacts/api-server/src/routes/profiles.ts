import { Router, type IRouter } from "express";
import { GetMyProfileResponse, SaveMyProfileBody, SaveMyProfileResponse } from "@workspace/api-zod";
import { signedInUserId } from "../lib/clerkUser";
import { getSupabaseAdmin, supabaseUnavailable } from "../lib/supabaseAdmin";

const router: IRouter = Router();

function profileResponse(row: Record<string, unknown>) {
  return {
    userId: String(row.user_id),
    displayName: String(row.display_name ?? ""),
    role: String(row.role ?? "farmer"),
    phone: typeof row.phone === "string" ? row.phone : null,
    gstin: typeof row.gstin === "string" ? row.gstin : null,
    businessName: typeof row.business_name === "string" ? row.business_name : null,
    district: typeof row.district === "string" ? row.district : null,
    state: typeof row.state === "string" ? row.state : null,
    verified: Boolean(row.verified),
  };
}

router.get("/me", async (req, res): Promise<void> => {
  const userId = signedInUserId(req, res);
  if (!userId) return;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("profiles")
      .select("user_id,display_name,role,phone,gstin,business_name,district,state,verified")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    res.json(GetMyProfileResponse.parse({ profile: data ? profileResponse(data) : null }));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.put("/me", async (req, res): Promise<void> => {
  const userId = signedInUserId(req, res);
  if (!userId) return;
  const body = SaveMyProfileBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: existing, error: lookupError } = await supabase
      .from("profiles")
      .select("role,verified")
      .eq("user_id", userId)
      .maybeSingle();
    if (lookupError) {
      supabaseUnavailable(req, res, lookupError);
      return;
    }

    // A user can choose or change between the two self-serve roles only.
    // Authority roles and verification are never accepted from a browser body.
    const role = existing && ["admin", "mandi_admin"].includes(existing.role)
      ? existing.role
      : body.data.role;
    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        user_id: userId,
        display_name: body.data.displayName.trim(),
        role,
        phone: body.data.phone.trim(),
        gstin: body.data.gstin?.trim() || null,
        business_name: body.data.businessName?.trim() || null,
        district: body.data.district?.trim() || null,
        state: body.data.state?.trim() || null,
        verified: existing?.verified ?? false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select("user_id,display_name,role,phone,gstin,business_name,district,state,verified")
      .single();
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    res.json(SaveMyProfileResponse.parse(profileResponse(data)));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

export default router;
