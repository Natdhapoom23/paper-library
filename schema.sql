-- Personal library. Run once in the SQL Editor of the dedicated project.
create table if not exists public.paper_books (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 200),
 pages jsonb not null check (jsonb_typeof(pages)='array' and jsonb_array_length(pages) between 1 and 1000),
 original_files jsonb not null default '[]'::jsonb,
 position integer not null default 0 check (position>=0),
 created timestamptz not null default now()
);
create index if not exists paper_books_owner_created on public.paper_books(owner_id,created desc);
alter table public.paper_books enable row level security;
revoke all on public.paper_books from anon;
grant select, insert, update, delete on public.paper_books to authenticated;
create policy "Read own books" on public.paper_books for select to authenticated using ((select auth.uid())=owner_id);
create policy "Create own books" on public.paper_books for insert to authenticated with check ((select auth.uid())=owner_id);
create policy "Update own books" on public.paper_books for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy "Delete own books" on public.paper_books for delete to authenticated using ((select auth.uid())=owner_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('paper-library','paper-library',false,52428800,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown','text/csv','image/png','image/jpeg','image/webp','image/gif','application/octet-stream'])
on conflict(id) do nothing;
create policy "Read own library files" on storage.objects for select to authenticated using (bucket_id='paper-library' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Upload own library files" on storage.objects for insert to authenticated with check (bucket_id='paper-library' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Remove own library files" on storage.objects for delete to authenticated using (bucket_id='paper-library' and (storage.foldername(name))[1]=(select auth.uid())::text);
