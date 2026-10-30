-- ขั้น 1.4: ห้องไอเดียบนคลาวด์ (ตาราง + RLS + ที่เก็บไฟล์เสียง)
-- วิธีใช้: คัดลอกทั้งไฟล์ไปวางใน Supabase → SQL Editor แล้วกด Run (รันครั้งเดียวพอ)

-- ---------------------------------------------------------------------------
-- ตาราง
-- ---------------------------------------------------------------------------

-- id เป็น uuid ที่เครื่องสร้างมาเอง (crypto.randomUUID) ไม่ให้ฐานข้อมูลสร้าง
-- เพราะคลิปเกิดตอนออฟไลน์ได้ ต้องมี id ตั้งแต่ก่อนขึ้นคลาวด์
-- user_id ไม่ต้องส่งมา ฐานข้อมูลใส่ให้จากคนที่ล็อกอินอยู่ (auth.uid())

create table public.idea_folders (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  is_auto boolean not null default false, -- true = "ลืมกดหมดไอเดีย NN"
  created_at timestamptz not null default now(),
  -- เครื่องเป็นคนตั้งค่านี้ ใช้ตัดสินตอนแก้จากหลายเครื่องว่าใครแก้ทีหลัง
  updated_at timestamptz not null default now()
);

create table public.idea_clips (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null, -- ตะกร้าที่คลิปเกิด
  folder_id uuid references public.idea_folders (id) on delete set null, -- null = ยังอยู่ในตะกร้า
  name text not null,
  storage_path text, -- null = ไฟล์เสียงยังไม่ขึ้น storage
  mime_type text not null,
  duration real not null default 0, -- วินาที
  bpm real, -- ขั้นที่ 2
  key text, -- ขั้นที่ 2
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idea_folders_user_id_idx on public.idea_folders (user_id);
create index idea_clips_user_id_folder_id_idx on public.idea_clips (user_id, folder_id);

-- ---------------------------------------------------------------------------
-- สิทธิ์: ให้เฉพาะคนที่ล็อกอินแล้ว (authenticated) แตะตารางได้ คนไม่ล็อกอิน (anon) ไม่ได้เลย
-- เขียนไว้ตรงๆ เพราะตอนสร้างโปรเจกต์ปิด "Automatically expose new tables" ไว้
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.idea_folders to authenticated;
grant select, insert, update, delete on public.idea_clips to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: แต่ละคนเห็นและแก้ได้เฉพาะแถวของตัวเอง
-- (select auth.uid()) ครอบ select ไว้ ให้ Postgres คำนวณครั้งเดียวต่อคำสั่ง ไม่ใช่ทุกแถว
-- ---------------------------------------------------------------------------

alter table public.idea_folders enable row level security;
alter table public.idea_clips enable row level security;

create policy "own folders" on public.idea_folders
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own clips" on public.idea_clips
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage: bucket ส่วนตัว ไฟล์อยู่ที่ {user_id}/{clip_id}.{นามสกุล}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('idea-clips', 'idea-clips', false, 52428800, array['audio/*']); -- ไฟล์ละไม่เกิน 50MB

-- โฟลเดอร์แรกของ path ต้องเป็น user_id ของคนที่ล็อกอินอยู่
create policy "own idea clip files: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'idea-clips' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own idea clip files: upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'idea-clips' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own idea clip files: replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'idea-clips' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'idea-clips' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own idea clip files: delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'idea-clips' and (storage.foldername(name))[1] = (select auth.uid())::text);
