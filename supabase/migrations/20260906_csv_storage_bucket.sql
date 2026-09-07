-- Create the storage bucket for CSV files (Private, not public)
insert into storage.buckets (id, name, public) 
values ('csv_uploads', 'csv_uploads', false)
on conflict (id) do nothing;

-- Users can only read files inside their own UID folder
create policy "Users can view their own CSVs"
  on storage.objects for select
  using ( bucket_id = 'csv_uploads' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Users can only upload files into their own UID folder
create policy "Users can upload their own CSVs"
  on storage.objects for insert
  with check ( bucket_id = 'csv_uploads' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Users can only delete their own files
create policy "Users can delete their own CSVs"
  on storage.objects for delete
  using ( bucket_id = 'csv_uploads' AND (storage.foldername(name))[1] = auth.uid()::text );
