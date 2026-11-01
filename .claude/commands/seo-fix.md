---
description: Aplica as correções de SEO (Critical/High) da última auditoria claude-seo no site via o prime-house-site-seo-agent
argument-hint: [critical|high|tudo] [número do item, opcional]
---

Delegue para o subagente `prime-house-site-seo-agent` (Agent tool, `subagent_type:
"prime-house-site-seo-agent"`) a implementação das correções de SEO do catálogo que
está documentado na definição desse agente (`.claude/agents/prime-house-site-seo-agent.md`),
baseado na auditoria `/seo audit https://primehouse.srv.br`.

Argumentos (`$ARGUMENTS`):
- Sem argumento, ou `critical`: aplique só os itens Critical (1-5).
- `high`: aplique só os itens High (6-10).
- `tudo`: aplique Critical e High, na ordem do catálogo (Critical antes de High).
- Um número (ex.: `2`): aplique só aquele item específico do catálogo.

Antes de delegar, se o pedido envolver os itens 3 (CNPJ), 4 (preço), 6
(depoimentos) ou 10 (links sociais/credencial da fundadora) e essa informação
ainda não tiver sido fornecida nesta conversa, pare e pergunte a William pelos
dados reais via `AskUserQuestion` — não deixe o subagente inventar CNPJ, preço,
depoimento ou link social.

Depois que o subagente terminar, resuma para William em português simples (sem
jargão de git) o que foi corrigido e o que ainda depende de alguma informação
dele.
