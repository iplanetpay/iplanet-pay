-- iPlanet Pay · interface passa a chamar a "Carteira" de "Wallet".
-- Atualiza só o texto padrão das instruções da IA de suporte (sem mexer em colunas, tabelas ou valores como source = 'carteira').
update public.support_ai_config
   set behavior_md = replace(replace(replace(replace(replace(behavior_md,
         '"Carteira"', '"Wallet"'),
         'volta para a Carteira', 'volta para a Wallet'),
         '## Carteira', '## Wallet'),
         'A Carteira reúne', 'A Wallet reúne'),
         'saldo da Carteira', 'saldo da Wallet'),
       updated_at = now()
 where id = 1;
