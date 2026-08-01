-- ============================================================================
-- Supabase: tabela de marca branca (tema do app do aluno)
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
-- ============================================================================

create table if not exists public.brand_theme (
  coach_id   text primary key,          -- tenant: um personal = uma marca
  brand_name text not null default 'FlowFit',
  tagline    text not null default 'Seu treino, no seu ritmo',
  accent     text not null default '#7667ff',
  mode       text not null default 'dark',
  updated_at timestamptz not null default now()
);

-- Permissoes para o papel anon (cliente de navegador usando a anon key).
grant select, insert, update on public.brand_theme to anon;

-- RLS: isolar dados por tenant desde a primeira API.
alter table public.brand_theme enable row level security;

-- Piloto: apenas o tenant demo (coach-demo) e acessivel enquanto nao existe
-- autenticacao. Quando o login chegar, trocar por policies baseadas em
-- auth.uid()/auth.jwt() mapeando personal -> coach_id.
drop policy if exists "brand_theme_select_demo" on public.brand_theme;
drop policy if exists "brand_theme_insert_demo" on public.brand_theme;
drop policy if exists "brand_theme_update_demo" on public.brand_theme;

create policy "brand_theme_select_demo"
  on public.brand_theme for select
  using (coach_id = 'coach-demo');

create policy "brand_theme_insert_demo"
  on public.brand_theme for insert
  with check (coach_id = 'coach-demo');

create policy "brand_theme_update_demo"
  on public.brand_theme for update
  using (coach_id = 'coach-demo')
  with check (coach_id = 'coach-demo');

-- Linha inicial do tenant demo.
insert into public.brand_theme (coach_id, brand_name, tagline, accent, mode)
values ('coach-demo', 'FlowFit', 'Seu treino, no seu ritmo', '#7667ff', 'dark')
on conflict (coach_id) do nothing;
