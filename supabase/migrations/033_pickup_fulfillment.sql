-- Admin Retirada/Envio: preparation data and status history for pickup_requests.

alter table public.pickup_requests
  add column if not exists tracking_code text,
  add column if not exists admin_notes text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists handled_by uuid references auth.users (id) on delete set null;

create index if not exists pickup_requests_status_idx
  on public.pickup_requests (status, created_at desc);

notify pgrst, 'reload schema';
