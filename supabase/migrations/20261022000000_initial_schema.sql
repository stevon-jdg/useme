-- 1. EXTENSIONS & ENUMS
create extension if not exists "uuid-ossp";

create type user_role as enum ('customer', 'runner', 'admin');
create type errand_status as enum ('draft', 'pending', 'assigned', 'in_progress', 'completed', 'cancelled');
create type payment_status as enum ('pending', 'completed', 'failed', 'refunded');

-- 2. USERS / PROFILES TABLE
-- Links directly to Supabase Auth metadata
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    full_name text not null,
    phone_number text unique not null,
    role user_role not null default 'customer',
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. RUNNER PROFILES TABLE
create table public.runner_details (
    id uuid references public.profiles(id) on delete cascade primary key,
    vehicle_type text not null, -- 'bicycle', 'motorcycle', 'car'
    license_plate text,
    is_active boolean default false not null,
    current_latitude numeric,
    current_longitude numeric,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. PRICING CONFIGURATION TABLE
create table public.pricing_rules (
    id uuid default gen_random_uuid() primary key,
    base_fare numeric not null,          -- Base price in Nigerian Naira (₦)
    per_km_rate numeric not null,        -- Charge per kilometer
    rush_hour_multiplier numeric default 1.0 not null,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. ERRANDS TABLE
create table public.errands (
    id uuid default gen_random_uuid() primary key,
    customer_id uuid references public.profiles(id) on delete set null not null,
    runner_id uuid references public.runner_details(id) on delete set null,
    title text not null,
    description text,
    
    -- Pickup & Delivery details
    pickup_address text not null,
    pickup_latitude numeric,
    pickup_longitude numeric,
    delivery_address text not null,
    delivery_latitude numeric,
    delivery_longitude numeric,
    
    -- Financials & Status
    estimated_distance_km numeric,
    final_cost numeric not null,
    status errand_status not null default 'draft',
    payment_status payment_status not null default 'pending',
    
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. ENABLE ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.runner_details enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.errands enable row level security;

-- 7. RLS POLICIES

-- Profiles
create policy "Users can view all profiles" on public.profiles for select using (true);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id);

-- Errands
create policy "Customers can view their own errands" on public.errands 
    for select using (auth.uid() = customer_id);
create policy "Runners can view assigned or pending errands" on public.errands 
    for select using (auth.uid() = runner_id or status = 'pending');
create policy "Customers can create errands" on public.errands 
    for insert with check (auth.uid() = customer_id);
create policy "Involved parties can update errands" on public.errands 
    for update using (auth.uid() = customer_id or auth.uid() = runner_id);

-- Pricing
create policy "Anyone can view active pricing rules" on public.pricing_rules 
    for select using (is_active = true);

-- 8. AUTOMATIC PROFILE TRIGGER ON SIGNUP
-- Automatically maps newly registered Supabase auth users into our public profiles table
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone_number, role)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', 'New Runner/Customer'),
    coalesce(new.raw_user_meta_data->>'phone_number', '08000000000'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'customer')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
