-- Create the storage bucket for generated PPTX/DOCX files (Public)
insert into storage.buckets (id, name, public) 
values ('deliverables_public', 'deliverables_public', true)
on conflict (id) do nothing;

-- Since it's public, anyone with the URL can view files
create policy "Anyone can view deliverables"
  on storage.objects for select
  using ( bucket_id = 'deliverables_public' );

-- Users can upload files (our app uploads generated blobs)
create policy "Authenticated users can upload deliverables"
  on storage.objects for insert
  with check ( bucket_id = 'deliverables_public' AND auth.role() = 'authenticated' );

-- Users can delete files
create policy "Authenticated users can delete deliverables"
  on storage.objects for delete
  using ( bucket_id = 'deliverables_public' AND auth.role() = 'authenticated' );
