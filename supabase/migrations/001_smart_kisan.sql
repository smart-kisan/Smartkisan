-- Smart Kisan production schema. Deliberately contains no demo or seed records.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id text primary key,
  display_name text not null,
  role text not null default 'farmer'
    check (role in ('farmer', 'buyer', 'mandi_admin', 'admin')),
  phone text,
  gstin text,
  business_name text,
  district text,
  state text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.msp_reference_prices (
  id uuid primary key default gen_random_uuid(),
  crop text not null,
  state text not null,
  mandi text,
  price_per_quintal numeric(12,2) not null check (price_per_quintal > 0),
  effective_date date not null,
  source text not null,
  created_by text,
  created_at timestamptz not null default now(),
  unique (crop, state, mandi, effective_date)
);

create table if not exists public.mandi_tax_rules (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  tax_rate numeric(7,4) not null check (tax_rate >= 0 and tax_rate <= 100),
  effective_date date not null,
  source text not null,
  created_by text,
  created_at timestamptz not null default now(),
  unique (state, effective_date)
);

create table if not exists public.crop_listings (
  id uuid primary key default gen_random_uuid(),
  farmer_id text not null references public.profiles(user_id),
  crop text not null,
  category text not null check (category in ('crop', 'nursery')),
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null,
  asking_price numeric(12,2) not null check (asking_price >= 0),
  location text not null,
  district text,
  state text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  quality_score numeric(5,2) check (quality_score between 0 and 100),
  status text not null default 'live'
    check (status in ('live', 'pending', 'sold', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.crop_listings(id),
  buyer_id text not null references public.profiles(user_id),
  amount numeric(12,2) not null check (amount > 0),
  quantity numeric(14,3) not null check (quantity > 0),
  status text not null default 'active'
    check (status in ('active', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.crop_listings(id),
  bid_id uuid not null unique references public.bids(id),
  farmer_id text not null references public.profiles(user_id),
  buyer_id text not null references public.profiles(user_id),
  quantity numeric(14,3) not null,
  total_amount numeric(14,2) not null,
  status text not null default 'locked'
    check (status in ('locked', 'in_progress', 'completed', 'cancelled')),
  deal_locked_at timestamptz not null default now(),
  tax_amount numeric(14,2),
  created_at timestamptz not null default now()
);

create table if not exists public.farm_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  farmer_id text not null references public.profiles(user_id),
  category text not null
    check (category in ('diesel', 'labor', 'fertilizer', 'tractor', 'other')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  hours numeric(8,2) check (hours is null or hours >= 0),
  entry_date date not null,
  created_at timestamptz not null default now()
);

-- This table contains only broad invalidation signals. No identity, phone, GSTIN,
-- bid amount, listing detail, or ledger data is placed on the public realtime channel.
create table if not exists public.marketplace_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('listing_changed', 'bid_changed', 'order_changed', 'msp_changed', 'tax_rule_changed')),
  created_at timestamptz not null default now()
);

create index if not exists crop_listings_live_created_idx
  on public.crop_listings (status, created_at desc);
create index if not exists crop_listings_location_idx
  on public.crop_listings (state, district, category);
create index if not exists bids_listing_status_idx on public.bids (listing_id, status, created_at desc);
create index if not exists orders_farmer_idx on public.orders (farmer_id, created_at desc);
create index if not exists orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index if not exists ledger_farmer_date_idx on public.farm_ledger_entries (farmer_id, entry_date desc);
create index if not exists msp_crop_state_effective_idx
  on public.msp_reference_prices (crop, state, effective_date desc);
create unique index if not exists msp_reference_prices_effective_key_idx
  on public.msp_reference_prices (lower(crop), lower(state), coalesce(lower(mandi), ''), effective_date);
create index if not exists tax_state_effective_idx
  on public.mandi_tax_rules (state, effective_date desc);

alter table public.profiles enable row level security;
alter table public.msp_reference_prices enable row level security;
alter table public.mandi_tax_rules enable row level security;
alter table public.crop_listings enable row level security;
alter table public.bids enable row level security;
alter table public.orders enable row level security;
alter table public.farm_ledger_entries enable row level security;
alter table public.marketplace_events enable row level security;

revoke all on public.profiles, public.msp_reference_prices, public.mandi_tax_rules,
  public.crop_listings, public.bids, public.orders, public.farm_ledger_entries,
  public.marketplace_events from anon, authenticated;
grant all on public.profiles, public.msp_reference_prices, public.mandi_tax_rules,
  public.crop_listings, public.bids, public.orders, public.farm_ledger_entries,
  public.marketplace_events to service_role;

grant select on public.marketplace_events to anon, authenticated;
drop policy if exists marketplace_event_signal_read on public.marketplace_events;
create policy marketplace_event_signal_read on public.marketplace_events
  for select to anon, authenticated using (true);

create or replace function public.emit_marketplace_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'crop_listings' then
    insert into public.marketplace_events(event_type) values ('listing_changed');
  elsif tg_table_name = 'bids' then
    insert into public.marketplace_events(event_type) values ('bid_changed');
  elsif tg_table_name = 'msp_reference_prices' then
    insert into public.marketplace_events(event_type) values ('msp_changed');
  elsif tg_table_name = 'mandi_tax_rules' then
    insert into public.marketplace_events(event_type) values ('tax_rule_changed');
  else
    insert into public.marketplace_events(event_type) values ('order_changed');
  end if;
  return new;
end;
$$;

drop trigger if exists crop_listing_marketplace_event on public.crop_listings;
create trigger crop_listing_marketplace_event
  after insert or update on public.crop_listings
  for each row execute function public.emit_marketplace_event();
drop trigger if exists bid_marketplace_event on public.bids;
create trigger bid_marketplace_event
  after insert or update on public.bids
  for each row execute function public.emit_marketplace_event();
drop trigger if exists order_marketplace_event on public.orders;
create trigger order_marketplace_event
  after insert or update on public.orders
  for each row execute function public.emit_marketplace_event();
drop trigger if exists msp_marketplace_event on public.msp_reference_prices;
create trigger msp_marketplace_event
  after insert or update on public.msp_reference_prices
  for each row execute function public.emit_marketplace_event();
drop trigger if exists tax_rule_marketplace_event on public.mandi_tax_rules;
create trigger tax_rule_marketplace_event
  after insert or update on public.mandi_tax_rules
  for each row execute function public.emit_marketplace_event();

-- Public search returns only marketplace-safe fields and masks profile identifiers.
create or replace function public.search_public_listings(
  p_search text default null,
  p_category text default null,
  p_state text default null,
  p_district text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_radius_km integer default null
)
returns table (
  id uuid,
  crop text,
  category text,
  quantity numeric,
  unit text,
  asking_price numeric,
  location text,
  district text,
  state text,
  latitude double precision,
  longitude double precision,
  msp_price numeric,
  quality_score numeric,
  status text,
  created_at timestamptz,
  bid_count bigint,
  seller_label text,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.crop,
    l.category,
    l.quantity,
    l.unit,
    l.asking_price,
    l.location,
    l.district,
    l.state,
    l.latitude,
    l.longitude,
    (
      select m.price_per_quintal
      from public.msp_reference_prices m
      where lower(m.crop) = lower(l.crop)
        and lower(m.state) = lower(coalesce(l.state, ''))
        and m.effective_date <= current_date
      order by m.effective_date desc
      limit 1
    ) as msp_price,
    l.quality_score,
    l.status,
    l.created_at,
    (select count(*) from public.bids b where b.listing_id = l.id and b.status = 'active') as bid_count,
    coalesce(nullif(p.display_name, ''), 'Farmer') as seller_label,
    case
      when p_latitude is null or p_longitude is null or l.latitude is null or l.longitude is null then null
      else 6371.0 * 2 * asin(sqrt(
        power(sin(radians(l.latitude - p_latitude) / 2), 2) +
        cos(radians(p_latitude)) * cos(radians(l.latitude)) *
        power(sin(radians(l.longitude - p_longitude) / 2), 2)
      ))
    end as distance_km
  from public.crop_listings l
  left join public.profiles p on p.user_id = l.farmer_id
  where l.status = 'live'
    and (p_search is null or p_search = '' or l.crop ilike '%' || p_search || '%' or l.location ilike '%' || p_search || '%')
    and (p_category is null or l.category = p_category)
    and (p_state is null or p_state = '' or l.state ilike p_state)
    and (p_district is null or p_district = '' or l.district ilike p_district)
    and (
      p_radius_km is null
      or (p_latitude is not null and p_longitude is not null
        and l.latitude is not null and l.longitude is not null
        and 6371.0 * 2 * asin(sqrt(
          power(sin(radians(l.latitude - p_latitude) / 2), 2) +
          cos(radians(p_latitude)) * cos(radians(l.latitude)) *
          power(sin(radians(l.longitude - p_longitude) / 2), 2)
        )) <= p_radius_km)
    )
  order by l.created_at desc
  limit 200;
$$;

create or replace function public.get_government_overview()
returns table (
  farmer_count bigint,
  buyer_count bigint,
  listing_count bigint,
  active_bid_count bigint,
  settled_value numeric,
  tax_tracked numeric,
  msp_alert_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles where role = 'farmer'),
    (select count(*) from public.profiles where role = 'buyer'),
    (select count(*) from public.crop_listings where status = 'live'),
    (select count(*) from public.bids where status = 'active'),
    (select coalesce(sum(total_amount), 0) from public.orders where status in ('locked', 'in_progress', 'completed')),
    (select coalesce(sum(tax_amount), 0) from public.orders where tax_amount is not null),
    (
      select count(*)
      from public.crop_listings l
      join lateral (
        select m.price_per_quintal
        from public.msp_reference_prices m
        where lower(m.crop) = lower(l.crop)
          and lower(m.state) = lower(coalesce(l.state, ''))
          and m.effective_date <= current_date
        order by m.effective_date desc
        limit 1
      ) msp on true
      where l.status = 'live'
        and lower(trim(l.unit)) in ('quintal', 'quintals', 'qtl', 'qtl.', '100 kg')
        and l.asking_price < msp.price_per_quintal
    );
$$;

create or replace function public.accept_listing_bid(p_bid_id uuid, p_actor text)
returns setof public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid public.bids%rowtype;
  v_listing public.crop_listings%rowtype;
  v_tax_rate numeric(7,4);
  v_order_id uuid;
begin
  select b.* into v_bid
  from public.bids b
  where b.id = p_bid_id and b.status = 'active';
  if not found then
    raise exception 'Bid is no longer available' using errcode = 'P0002';
  end if;

  select l.* into v_listing
  from public.crop_listings l
  where l.id = v_bid.listing_id
  for update;
  if not found or v_listing.farmer_id <> p_actor or v_listing.status <> 'live' then
    raise exception 'Only the listing owner can accept an active bid' using errcode = '42501';
  end if;

  select r.tax_rate into v_tax_rate
  from public.mandi_tax_rules r
  where lower(r.state) = lower(coalesce(v_listing.state, ''))
    and r.effective_date <= current_date
  order by r.effective_date desc
  limit 1;

  update public.bids
  set status = case when id = p_bid_id then 'accepted' else 'rejected' end
  where listing_id = v_listing.id and status = 'active';

  update public.crop_listings set status = 'sold', updated_at = now()
  where id = v_listing.id;

  insert into public.orders (
    listing_id, bid_id, farmer_id, buyer_id, quantity, total_amount, status, tax_amount
  ) values (
    v_listing.id,
    v_bid.id,
    v_listing.farmer_id,
    v_bid.buyer_id,
    v_bid.quantity,
    v_bid.amount * v_bid.quantity,
    'locked',
    case when v_tax_rate is null then null
      else round(v_bid.amount * v_bid.quantity * v_tax_rate / 100, 2)
    end
  )
  returning id into v_order_id;

  return query select * from public.orders where id = v_order_id;
end;
$$;

revoke all on function public.search_public_listings(text, text, text, text, double precision, double precision, integer) from public, anon, authenticated;
revoke all on function public.get_government_overview() from public, anon, authenticated;
revoke all on function public.accept_listing_bid(uuid, text) from public, anon, authenticated;
grant execute on function public.search_public_listings(text, text, text, text, double precision, double precision, integer) to service_role;
grant execute on function public.get_government_overview() to service_role;
grant execute on function public.accept_listing_bid(uuid, text) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'marketplace_events'
  ) then
    alter publication supabase_realtime add table public.marketplace_events;
  end if;
end;
$$;
