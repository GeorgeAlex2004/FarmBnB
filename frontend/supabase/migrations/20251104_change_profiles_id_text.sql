-- Change profiles.id from UUID to TEXT to support Firebase UIDs
do $$
begin
  -- Drop FK if it exists
  begin
    alter table public.profiles drop constraint if exists profiles_id_fkey;
  exception when others then null;
  end;
  
  -- Drop the trigger that references auth.users
  drop trigger if exists on_auth_user_created on auth.users;
  
  -- Drop the function that uses auth.users
  drop function if exists public.handle_new_user();
end $$;

-- Change id column type
alter table public.profiles
  alter column id type text using id::text;

-- Remove the primary key constraint temporarily
alter table public.profiles drop constraint if exists profiles_pkey;

-- Re-add primary key with TEXT
alter table public.profiles add primary key (id);

-- Update user_roles.user_id to TEXT as well
do $$
begin
  begin
    alter table public.user_roles drop constraint if exists user_roles_user_id_fkey;
  exception when others then null;
  end;
end $$;

alter table public.user_roles
  alter column user_id type text using user_id::text;

