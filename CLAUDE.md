# CLAUDE.md

Sistema administrativo isolado do monorepo `maisenvios`. Não acessa o banco dele nem compartilha código: a integração é só pela API, após aprovação de um administrador. Veja o `README.md` para rodar e para as receitas de permissão, papel e auditoria.

## Regras

- **Poucas dependências:** é um pedido explícito do usuário. Antes de adicionar um pacote, tente resolver com a plataforma ou com código próprio. Por isso não há Passport, JWT, Pinia, axios, biblioteca de componentes ou de testes.
- **Papéis vêm do usuário:** ele descreve o que cada tipo de usuário pode fazer, e isso vira entradas em `ROLES` e `PERMISSIONS`. Não invente papéis.
- **Acesso:** toda rota exige sessão, salvo `@Public()`. A checagem de permissão no frontend só controla a tela; quem decide é a API.
- **Auditoria:** novas entidades de negócio usam `@Auditable` e são alteradas com `save()` ou `remove()`. Migrations não passam pela auditoria.
- **Banco:** nunca use `synchronize`. Toda mudança de schema é uma migration.
- **Idioma:** interface, mensagens de erro e comentários em português do Brasil; identificadores em inglês.
