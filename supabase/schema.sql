-- 保護者ポータル / 公開ギャラリー用の最小スキーマ
-- 1) これをSQL Editorで実行
-- 2) StorageバケットはDashboardで作成: parents-photos(private), public-photos(public)

create extension if not exists pgcrypto;

-- ユーザー権限（運営/保護者）
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'parent' check (role in ('parent', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

-- Authユーザー作成時にprofilesを自動作成
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
for select
using (public.is_admin());

-- 投稿（写真付き）
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete cascade,

  title text not null,
  body text not null,

  author_name text,
  is_anonymous boolean not null default false,

  requested_visibility text not null check (requested_visibility in ('parents', 'public')),
  visibility text check (visibility in ('parents', 'public')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),

  image_bucket text not null,
  image_path text not null
);

alter table public.posts enable row level security;

-- posts policies
-- 公開: 匿名(未ログイン)でも「承認済み & 一般公開」だけ読める
drop policy if exists "posts_select_public" on public.posts;
create policy "posts_select_public" on public.posts
for select
using (
  status = 'approved'
  and visibility = 'public'
);

-- 保護者(ログイン): 承認済みの parents/public を読める
drop policy if exists "posts_select_authenticated" on public.posts;
create policy "posts_select_authenticated" on public.posts
for select
using (
  auth.role() = 'authenticated'
  and status = 'approved'
  and visibility in ('parents', 'public')
);

-- 運営(admin): すべて閲覧可（承認待ちの一覧に必要）
drop policy if exists "posts_select_admin" on public.posts;
create policy "posts_select_admin" on public.posts
for select
using (public.is_admin());

-- いいね（匿名トークンで二重押し防止）
create table if not exists public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_token text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_token)
);

alter table public.likes enable row level security;

-- likes は直接アクセスさせず、RPC経由で扱う
revoke all on table public.likes from anon, authenticated;

create or replace function public.get_like_counts(post_ids uuid[])
returns table(post_id uuid, like_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select l.post_id, count(*)::bigint as like_count
  from public.likes l
  where l.post_id = any(post_ids)
  group by l.post_id;
$$;

create or replace function public.like_post(p_post_id uuid, p_user_token text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_token is null or length(p_user_token) < 16 then
    raise exception 'invalid token';
  end if;

  insert into public.likes (post_id, user_token)
  values (p_post_id, p_user_token)
  on conflict do nothing;

  return (select count(*)::bigint from public.likes where post_id = p_post_id);
end;
$$;

grant execute on function public.get_like_counts(uuid[]) to anon, authenticated;
grant execute on function public.like_post(uuid, text) to anon, authenticated;

-- 投稿: ログインユーザーが pending として作成
drop policy if exists "posts_insert_authenticated" on public.posts;
create policy "posts_insert_authenticated" on public.posts
for insert
with check (
  auth.role() = 'authenticated'
  and created_by = auth.uid()
  and status = 'pending'
  and requested_visibility in ('parents', 'public')
  and image_bucket = 'parents-photos'
);

-- 運営: 承認/公開先変更など
drop policy if exists "posts_update_admin" on public.posts;
create policy "posts_update_admin" on public.posts
for update
using (public.is_admin())
with check (public.is_admin());

-- 投稿者: 自分のpendingは削除可（運用上あると便利）
drop policy if exists "posts_delete_own_pending" on public.posts;
create policy "posts_delete_own_pending" on public.posts
for delete
using (
  auth.role() = 'authenticated'
  and created_by = auth.uid()
  and status = 'pending'
);

-- 運営: いつでも削除可
drop policy if exists "posts_delete_admin" on public.posts;
create policy "posts_delete_admin" on public.posts
for delete
using (public.is_admin());

-- Storage policies
-- 事前: Storageバケットを作成
-- - parents-photos (private)
-- - public-photos (public)

-- parents-photos: upload
drop policy if exists "parents_photos_insert_authenticated" on storage.objects;
create policy "parents_photos_insert_authenticated" on storage.objects
for insert
with check (
  bucket_id = 'parents-photos'
  and auth.role() = 'authenticated'
);

-- parents-photos: adminはすべて閲覧可
drop policy if exists "parents_photos_select_admin" on storage.objects;
create policy "parents_photos_select_admin" on storage.objects
for select
using (
  bucket_id = 'parents-photos'
  and public.is_admin()
);

-- parents-photos: 承認済み（保護者限定/一般公開）に紐づく画像だけ、ログインユーザーが閲覧可
drop policy if exists "parents_photos_select_approved_for_parents" on storage.objects;
create policy "parents_photos_select_approved_for_parents" on storage.objects
for select
using (
  bucket_id = 'parents-photos'
  and auth.role() = 'authenticated'
  and exists (
    select 1
    from public.posts p
    where p.status = 'approved'
      and p.visibility in ('parents', 'public')
      and p.image_bucket = 'parents-photos'
      and p.image_path = storage.objects.name
  )
);

-- parents-photos: uploaderは自分のオブジェクトを削除可
drop policy if exists "parents_photos_delete_owner" on storage.objects;
create policy "parents_photos_delete_owner" on storage.objects
for delete
using (
  bucket_id = 'parents-photos'
  and auth.uid() = owner
);

-- parents-photos: adminは削除可
drop policy if exists "parents_photos_delete_admin" on storage.objects;
create policy "parents_photos_delete_admin" on storage.objects
for delete
using (
  bucket_id = 'parents-photos'
  and public.is_admin()
);

-- public-photos: 誰でも閲覧可（バケットを public にする想定）
drop policy if exists "public_photos_select_any" on storage.objects;
create policy "public_photos_select_any" on storage.objects
for select
using (bucket_id = 'public-photos');

-- public-photos: adminだけアップロード/削除可
drop policy if exists "public_photos_insert_admin" on storage.objects;
create policy "public_photos_insert_admin" on storage.objects
for insert
with check (
  bucket_id = 'public-photos'
  and public.is_admin()
);

drop policy if exists "public_photos_delete_admin" on storage.objects;
create policy "public_photos_delete_admin" on storage.objects
for delete
using (
  bucket_id = 'public-photos'
  and public.is_admin()
);
