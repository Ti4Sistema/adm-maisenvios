# CLAUDE.md

Sistema administrativo isolado do monorepo `maisenvios`. Não acessa o banco dele nem compartilha código: a integração é só pela API, após aprovação de um administrador. Veja o `README.md` para rodar e para as receitas de permissão, papel e auditoria.

## Regras

- **Vocabulário:** quem opera este sistema é **administrador** (`Administrator` no código), nunca "usuário". A palavra fica livre para o futuro cadastro de usuários.
- **Poucas dependências:** é um pedido explícito do dono do projeto. Antes de adicionar um pacote, tente resolver com a plataforma ou com código próprio. Por isso não há Passport, JWT, Pinia, axios, biblioteca de componentes ou de testes.
- **Papéis vêm do dono do projeto:** ele descreve o que cada tipo de administrador pode fazer, e isso vira entradas em `ROLES` e `PERMISSIONS`. Não invente papéis.
- **Acesso:** toda rota exige sessão, salvo `@Public()`. A checagem de permissão no frontend só controla a tela; quem decide é a API.
- **Auditoria:** novas entidades de negócio usam `@Auditable` e são alteradas com `save()` ou `remove()`. Migrations não passam pela auditoria.
- **Banco:** nunca use `synchronize`. Toda mudança de schema é uma migration.
- **Idioma:** interface, mensagens de erro e comentários em português do Brasil; identificadores em inglês.
