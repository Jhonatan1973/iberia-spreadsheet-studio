-- Checklist compartilhado: documentos, anexos e nomes visíveis para todos os membros.
-- Só quem estiver na tabela "membros" (pelo e-mail do login) consegue ver ou mexer.

create table if not exists public.membros (
  email text primary key
);

-- >>> TROQUE pelos e-mails que vão usar o app (os mesmos do cadastro/login) <<<
insert into public.membros (email) values
  ('jhonatan@exemplo.com'),
  ('ester@exemplo.com')
on conflict do nothing;

create or replace function public.is_membro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.membros
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create table if not exists public.itens (
  id text primary key,
  secao text not null check (secao in ('BRASIL', 'ESPANHA')),
  documento text not null,
  obs text not null default '',
  traducao text not null default 'Não' check (traducao in ('Sim', 'Não', 'Talvez')),
  jonathan text not null default 'Pendente' check (jonathan in ('Pendente', 'Feito', 'N/A')),
  esther text not null default 'Pendente' check (esther in ('Pendente', 'Feito', 'N/A')),
  ordem integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.anexos (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references public.itens (id) on delete cascade,
  nome text not null,
  mime text not null,
  path text not null unique,
  who text not null default 'ambos' check (who in ('ambos', 'jonathan', 'esther')),
  created_at timestamptz not null default now()
);
create index if not exists anexos_item_id_idx on public.anexos (item_id);

create table if not exists public.config (
  chave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.membros enable row level security;
alter table public.itens enable row level security;
alter table public.anexos enable row level security;
alter table public.config enable row level security;

drop policy if exists "membro ve o proprio cadastro" on public.membros;
create policy "membro ve o proprio cadastro" on public.membros
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "membros gerenciam itens" on public.itens;
create policy "membros gerenciam itens" on public.itens
  for all to authenticated using (public.is_membro()) with check (public.is_membro());

drop policy if exists "membros gerenciam anexos" on public.anexos;
create policy "membros gerenciam anexos" on public.anexos
  for all to authenticated using (public.is_membro()) with check (public.is_membro());

drop policy if exists "membros gerenciam config" on public.config;
create policy "membros gerenciam config" on public.config
  for all to authenticated using (public.is_membro()) with check (public.is_membro());

-- Arquivos (fotos e PDFs) em bucket PRIVADO: só membros logados acessam, via link temporário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anexos', 'anexos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "membros leem arquivos" on storage.objects;
create policy "membros leem arquivos" on storage.objects
  for select to authenticated using (bucket_id = 'anexos' and public.is_membro());

drop policy if exists "membros enviam arquivos" on storage.objects;
create policy "membros enviam arquivos" on storage.objects
  for insert to authenticated with check (bucket_id = 'anexos' and public.is_membro());

drop policy if exists "membros apagam arquivos" on storage.objects;
create policy "membros apagam arquivos" on storage.objects
  for delete to authenticated using (bucket_id = 'anexos' and public.is_membro());

-- Atualização ao vivo: quando um muda algo, aparece para o outro sem recarregar.
do $$
begin
  begin alter publication supabase_realtime add table public.itens; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.anexos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.config; exception when duplicate_object then null; end;
end $$;
