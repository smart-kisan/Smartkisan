import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import {
  AcceptBidParams,
  AcceptBidResponse,
  CreateBidBody,
  CreateBidParams,
  CreateBidResponse,
  CreateListingBody,
  CreateListingResponse,
  GetListingBidsParams,
  GetListingBidsResponse,
  GetListingsQueryParams,
  GetListingsResponse,
  GetMyOrdersResponse,
  GetOrderContactParams,
  GetOrderContactResponse,
} from "@workspace/api-zod";
import { signedInUserId } from "../lib/clerkUser";
import { getSupabaseAdmin, supabaseUnavailable } from "../lib/supabaseAdmin";

const router: IRouter = Router();

function valueOfParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function listingResponse(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    crop: String(row.crop),
    category: row.category,
    quantity: Number(row.quantity),
    unit: String(row.unit),
    askingPrice: Number(row.asking_price),
    location: String(row.location),
    district: typeof row.district === "string" ? row.district : null,
    state: typeof row.state === "string" ? row.state : null,
    latitude: typeof row.latitude === "number" ? row.latitude : null,
    longitude: typeof row.longitude === "number" ? row.longitude : null,
    mspPrice: row.msp_price == null ? null : Number(row.msp_price),
    qualityScore: row.quality_score == null ? null : Number(row.quality_score),
    status: row.status,
    createdAt: String(row.created_at),
    bidCount: Number(row.bid_count ?? 0),
    sellerLabel: String(row.seller_label ?? "Farmer"),
    distanceKm: row.distance_km == null ? null : Number(row.distance_km),
    isMine: Boolean(row.is_mine),
  };
}

async function profileRole(userId: string): Promise<{ role: string; verified: boolean } | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("role,verified")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

router.get("/marketplace/listings", async (req, res): Promise<void> => {
  const query = GetListingsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { category, search, state, district, radiusKm, latitude, longitude } = query.data;
  if (radiusKm != null && (latitude == null || longitude == null)) {
    res.status(400).json({ error: "Allow location access to filter by distance, or choose Pan-India." });
    return;
  }

  try {
    const { data, error } = await getSupabaseAdmin().rpc("search_public_listings", {
      p_search: search || null,
      p_category: category || null,
      p_state: state || null,
      p_district: district || null,
      p_latitude: latitude ?? null,
      p_longitude: longitude ?? null,
      p_radius_km: radiusKm ?? null,
    });
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    const mine = new Set<string>();
    const userId = getAuth(req).userId;
    if (userId) {
      const { data: ownedRows, error: ownedError } = await getSupabaseAdmin()
        .from("crop_listings")
        .select("id")
        .eq("farmer_id", userId);
      if (ownedError) {
        supabaseUnavailable(req, res, ownedError);
        return;
      }
      for (const row of ownedRows ?? []) mine.add(String(row.id));
    }
    const result = (data ?? []).map((row: Record<string, unknown>) => listingResponse({
      ...row,
      is_mine: mine.has(String(row.id)),
    }));
    res.json(GetListingsResponse.parse(result));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.post("/marketplace/listings", async (req, res): Promise<void> => {
  const userId = signedInUserId(req, res);
  if (!userId) return;
  const body = CreateListingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const role = await profileRole(userId);
    if (!role) {
      res.status(409).json({ error: "Complete your farmer profile before creating a listing." });
      return;
    }
    if (role.role !== "farmer") {
      res.status(403).json({ error: "Only farmer profiles can publish crop listings." });
      return;
    }
    const { data: created, error } = await supabase
      .from("crop_listings")
      .insert({
        farmer_id: userId,
        crop: body.data.crop.trim(),
        category: body.data.category,
        quantity: body.data.quantity,
        unit: body.data.unit.trim(),
        asking_price: body.data.askingPrice,
        location: body.data.location.trim(),
        district: body.data.district ?? null,
        state: body.data.state ?? null,
        latitude: body.data.latitude ?? null,
        longitude: body.data.longitude ?? null,
      })
      .select("id")
      .single();
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    const { data: refreshed, error: searchError } = await supabase.rpc("search_public_listings", {
      p_search: null,
      p_category: null,
      p_state: null,
      p_district: null,
      p_latitude: null,
      p_longitude: null,
      p_radius_km: null,
    });
    if (searchError) {
      supabaseUnavailable(req, res, searchError);
      return;
    }
    const createdRow = (refreshed ?? []).find((row: Record<string, unknown>) => row.id === created.id);
    if (!createdRow) {
      res.status(500).json({ error: "The listing was saved but could not be reloaded." });
      return;
    }
    res.status(201).json(CreateListingResponse.parse(listingResponse({ ...createdRow, is_mine: true })));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.get("/marketplace/listings/:listingId/bids", async (req, res): Promise<void> => {
  const userId = signedInUserId(req, res);
  if (!userId) return;
  const params = GetListingBidsParams.safeParse({ listingId: valueOfParam(req.params.listingId) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: listing, error: listingError } = await supabase
      .from("crop_listings")
      .select("id,farmer_id,status")
      .eq("id", params.data.listingId)
      .maybeSingle();
    if (listingError) {
      supabaseUnavailable(req, res, listingError);
      return;
    }
    if (!listing) {
      res.status(404).json({ error: "Listing not found." });
      return;
    }
    if (listing.farmer_id !== userId) {
      const role = await profileRole(userId);
      if (!role || !["buyer", "admin", "mandi_admin"].includes(role.role)) {
        res.status(403).json({ error: "Only the listing owner or a buyer can view these offers." });
        return;
      }
    }
    const { data, error } = await supabase
      .from("bids")
      .select("id,listing_id,amount,quantity,status,created_at")
      .eq("listing_id", params.data.listingId)
      .order("created_at", { ascending: false });
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    const result = (data ?? []).map((row) => ({
      id: String(row.id),
      listingId: String(row.listing_id),
      amount: Number(row.amount),
      quantity: Number(row.quantity),
      buyerLabel: "Buyer",
      status: row.status,
      createdAt: String(row.created_at),
    }));
    res.json(GetListingBidsResponse.parse(result));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.post("/marketplace/listings/:listingId/bids", async (req, res): Promise<void> => {
  const userId = signedInUserId(req, res);
  if (!userId) return;
  const params = CreateBidParams.safeParse({ listingId: valueOfParam(req.params.listingId) });
  const body = CreateBidBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const role = await profileRole(userId);
    if (!role) {
      res.status(409).json({ error: "Complete your buyer profile before placing an offer." });
      return;
    }
    if (role.role !== "buyer") {
      res.status(403).json({ error: "Only buyer profiles can place offers." });
      return;
    }
    const { data: listing, error: listingError } = await supabase
      .from("crop_listings")
      .select("id,farmer_id,quantity,status")
      .eq("id", params.data.listingId)
      .maybeSingle();
    if (listingError) {
      supabaseUnavailable(req, res, listingError);
      return;
    }
    if (!listing || listing.status !== "live") {
      res.status(404).json({ error: "This listing is no longer available." });
      return;
    }
    if (listing.farmer_id === userId) {
      res.status(403).json({ error: "You cannot bid on your own listing." });
      return;
    }
    if (body.data.quantity > Number(listing.quantity)) {
      res.status(400).json({ error: "Offer quantity cannot exceed the listed quantity." });
      return;
    }
    const { data, error } = await supabase
      .from("bids")
      .insert({
        listing_id: params.data.listingId,
        buyer_id: userId,
        amount: body.data.amount,
        quantity: body.data.quantity,
      })
      .select("id,listing_id,amount,quantity,status,created_at")
      .single();
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    res.status(201).json(CreateBidResponse.parse({
      id: String(data.id),
      listingId: String(data.listing_id),
      amount: Number(data.amount),
      quantity: Number(data.quantity),
      buyerLabel: "You",
      status: data.status,
      createdAt: String(data.created_at),
    }));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.post("/marketplace/bids/:bidId/accept", async (req, res): Promise<void> => {
  const userId = signedInUserId(req, res);
  if (!userId) return;
  const params = AcceptBidParams.safeParse({ bidId: valueOfParam(req.params.bidId) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("accept_listing_bid", {
      p_bid_id: params.data.bidId,
      p_actor: userId,
    });
    if (error) {
      if (error.code === "42501") {
        res.status(403).json({ error: "Only the farmer who owns the listing can accept this offer." });
        return;
      }
      if (error.code === "P0002") {
        res.status(409).json({ error: "This offer is no longer available." });
        return;
      }
      supabaseUnavailable(req, res, error);
      return;
    }
    const order = Array.isArray(data) ? data[0] : data;
    if (!order) {
      res.status(500).json({ error: "The deal could not be locked." });
      return;
    }
    const { data: listing } = await supabase
      .from("crop_listings")
      .select("crop")
      .eq("id", order.listing_id)
      .maybeSingle();
    const { data: partner } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", order.buyer_id)
      .maybeSingle();
    res.json(AcceptBidResponse.parse({
      id: String(order.id),
      listingId: String(order.listing_id),
      crop: String(listing?.crop ?? ""),
      quantity: Number(order.quantity),
      totalAmount: Number(order.total_amount),
      status: order.status,
      partnerLabel: String(partner?.display_name ?? "Buyer"),
      dealLockedAt: String(order.deal_locked_at),
      taxAmount: order.tax_amount == null ? null : Number(order.tax_amount),
    }));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.get("/marketplace/orders", async (req, res): Promise<void> => {
  const userId = signedInUserId(req, res);
  if (!userId) return;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("orders")
      .select("id,listing_id,farmer_id,buyer_id,quantity,total_amount,status,deal_locked_at,tax_amount")
      .or(`farmer_id.eq.${userId},buyer_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    const result = await Promise.all((data ?? []).map(async (order) => {
      const otherUserId = order.farmer_id === userId ? order.buyer_id : order.farmer_id;
      const [{ data: listing }, { data: partner }] = await Promise.all([
        supabase.from("crop_listings").select("crop").eq("id", order.listing_id).maybeSingle(),
        supabase.from("profiles").select("display_name").eq("user_id", otherUserId).maybeSingle(),
      ]);
      return {
        id: String(order.id),
        listingId: String(order.listing_id),
        crop: String(listing?.crop ?? ""),
        quantity: Number(order.quantity),
        totalAmount: Number(order.total_amount),
        status: order.status,
        partnerLabel: String(partner?.display_name ?? "Marketplace partner"),
        dealLockedAt: String(order.deal_locked_at),
        taxAmount: order.tax_amount == null ? null : Number(order.tax_amount),
      };
    }));
    res.json(GetMyOrdersResponse.parse(result));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

router.get("/marketplace/orders/:orderId/contact", async (req, res): Promise<void> => {
  const userId = signedInUserId(req, res);
  if (!userId) return;
  const params = GetOrderContactParams.safeParse({ orderId: valueOfParam(req.params.orderId) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,farmer_id,buyer_id,deal_locked_at")
      .eq("id", params.data.orderId)
      .maybeSingle();
    if (orderError) {
      supabaseUnavailable(req, res, orderError);
      return;
    }
    if (!order || (order.farmer_id !== userId && order.buyer_id !== userId)) {
      res.status(404).json({ error: "Locked deal not found." });
      return;
    }
    if (!order.deal_locked_at) {
      res.status(403).json({ error: "Contact details are only available after a deal is locked." });
      return;
    }
    const otherUserId = order.farmer_id === userId ? order.buyer_id : order.farmer_id;
    const { data: contact, error } = await supabase
      .from("profiles")
      .select("display_name,phone,business_name,gstin")
      .eq("user_id", otherUserId)
      .maybeSingle();
    if (error) {
      supabaseUnavailable(req, res, error);
      return;
    }
    if (!contact?.phone) {
      res.status(409).json({ error: "The other party has not added a contact number." });
      return;
    }
    res.json(GetOrderContactResponse.parse({
      name: String(contact.display_name ?? ""),
      phone: String(contact.phone),
      businessName: typeof contact.business_name === "string" ? contact.business_name : null,
      gstin: typeof contact.gstin === "string" ? contact.gstin : null,
    }));
  } catch (error) {
    supabaseUnavailable(req, res, error);
  }
});

export default router;
