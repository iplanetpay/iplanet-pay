-- 041: mapa nome→hex igual ao do app (src/lib/catalog/colors.ts NAME_RULES):
-- Bordô ganha #6B2A35 e Laranja cósmico passa a #F77E2D. Corrige variantes já gravadas com o hex antigo/nulo.

create or replace function public.color_hex_from_name(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_name is null or btrim(p_name) = '' then null
    when p_name ~* 'tit[aâ]nio\s*natural|natural' then '#BAB4A9'
    when p_name ~* 'tit[aâ]nio\s*preto|black\s*titanium' then '#3C3C3D'
    when p_name ~* 'tit[aâ]nio\s*branco|white\s*titanium' then '#F2F1ED'
    when p_name ~* 'tit[aâ]nio\s*deserto|deserto|desert' then '#BFA48F'
    when p_name ~* 'azul[\s-]*sierra|sierra' then '#9BB5CE'
    when p_name ~* 'meia[\s-]*noite|midnight' then '#232A31'
    when p_name ~* 'cinza[\s-]*espacial|space\s*gr[ae]y' then '#535150'
    when p_name ~* 'grafite|graphite' then '#41424C'
    when p_name ~* 'estelar|starlight' then '#F0E8DC'
    when p_name ~* 'lavanda|lavender' then '#C9B8E8'
    when p_name ~* 'bord[oô]|burgundy' then '#6B2A35'
    when p_name ~* 'product|vermelho|red' then '#BA0C2E'
    when p_name ~* 'preto|black|space' then '#1D1D1F'
    when p_name ~* 'branco|white' then '#F5F5F0'
    when p_name ~* 'prata|prateado|silver' then '#E3E4E5'
    when p_name ~* 'azul|blue|ultramar' then '#3D7EA6'
    when p_name ~* 'verde|green|teal' then '#ADC7B4'
    when p_name ~* 'rosa|pink' then '#F2C9CE'
    when p_name ~* 'roxo|purple' then '#B7A6D8'
    when p_name ~* 'amarelo|yellow' then '#F5E39A'
    when p_name ~* 'dourado|gold' then '#F4E3C1'
    when p_name ~* 'laranja|orange|c[oó]smico' then '#F77E2D'
    when p_name ~* 'tit[aâ]nio|titanium' then '#8D8D92'
    else null
  end;
$$;

update public.products
   set color_hex = public.color_hex_from_name(color)
 where color is not null
   and color ~* 'bord[oô]|burgundy|laranja|orange|c[oó]smico'
   and (color_hex is null or color_hex = '#E07A3D');
update public.product_variants
   set color_hex = public.color_hex_from_name(color)
 where color is not null
   and color ~* 'bord[oô]|burgundy|laranja|orange|c[oó]smico'
   and (color_hex is null or color_hex = '#E07A3D');
