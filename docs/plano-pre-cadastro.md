# Plano — Pré-cadastro de clientes (Cliente e Smart)

Status: **implementado** (exceto o envio para a API da Mais Envios, que é a próxima tarefa).

## 1. O que entendi

Hoje existem dois cadastros manuais no portal +Envios:

| | **Cliente** | **Smart** (licença PDV Smart) |
|---|---|---|
| Origem dos dados | Ficha cadastral em Word | Linha da planilha Google Sheets |
| Onde é criado | Conta principal | Dentro de uma licença master (ex.: MAIS ENVIOS 005) |
| Campos variáveis | Quase todos vêm da ficha | Poucos (nome, CNPJ, endereço, e-mail, contato, telefone) |
| Campos fixos | Só o beneficiário padrão e o cartão como principal | Quase tudo: tabelas, limite, serviços, dias, malha... e alguns são escolhidos no envio, dentro da licença |
| Usuários criados | 1 (`<1ª palavra>admin`, Admin Cliente) | 2 (`admpdvsmart<sufixo>` e `pdvsmart<sufixo>`) |
| Ajuste final | — | Seguro 2% |

**Conclusão central:** os dois são o *mesmo cadastro de cliente* do portal. O Smart é um Cliente com um **modelo pré-preenchido**, em que a maioria dos campos é fixa ou definida no envio, dentro da licença master. Por isso o plano usa **uma única estrutura** com um campo `tipo` (`cliente` | `smart`), e as regras de cada tipo dizem o que é obrigatório, o que é fixo e o que é calculado.

### O fluxo novo

1. Alguém cria uma linha de pré-cadastro (escolhe o tipo) com o que já sabe — pode ser só o nome.
2. Vários usuários vão completando campos em momentos diferentes, numa **grade estilo Excel**.
3. O sistema mostra, linha a linha, **o que falta** e muda o status sozinho para *Pronto* quando tudo que é obrigatório está preenchido e válido.
4. Um administrador **aprova** a linha.
5. *(Próxima tarefa)* A integração envia para a API da Mais Envios e grava o retorno (logins e senhas gerados, erros).

## 2. Campos e regras

Legenda — **Obr.**: obrigatório para ficar *Pronto*. **Fixo**: preenchido pelo sistema e não editável. **Padrão**: vem preenchido mas pode mudar. **Calc.**: calculado de outros campos.

### 2.1 Dados principais

| Campo | Cliente | Smart | Regras |
|---|---|---|---|
| Nome Fantasia | Obr. (na ficha colada, sem Nome Fantasia usa a Razão Social) | Obr. (col. C) | Máx. 30 caracteres no portal → avisar e bloquear acima disso |
| Razão Social | Obr. | Obr. (col. E) | |
| CPF/CNPJ | Obr. | Obr. (col. F) | Validar dígitos; avisar se já existe outro pré-cadastro com o mesmo documento |
| Tipo Cliente | Obr. (Cliente/Licença/Filial) | Fixo: Cliente | |
| Licença master | — | Obr. (col. B) | Texto com o nome da licença (ex.: MAIS ENVIOS 005) |

### 2.2 Faturamento

| Campo | Cliente | Smart | Regras |
|---|---|---|---|
| Tipo de faturamento | Obr. | Padrão: Mensal (col. W) | Mensal ou Quinzenal |
| E-mail financeiro | Obr. | Obr. (col. X) | Formato de e-mail |
| Dias a vencer | Fixo: 10 | Fixo: 10 | |
| Beneficiário | Padrão: MAIS ENVIOS INTELIGENCIA LOGISTICA LTDA | No envio: 1º disponível na licença | Lista |

### 2.3 Endereços

| Campo | Cliente | Smart | Regras |
|---|---|---|---|
| Endereço principal | Obr. | Obr. (col. R–V) | CEP, rua, número, complemento, bairro, cidade, UF |
| Endereço de coleta | Sim/Não (padrão: não); ligado, mostra e cobra CEP e número da coleta | — | Não pode repetir o CEP do principal (o portal recusa) |

- **Obrigatórios: CEP (8 dígitos) e número.** Complemento é opcional.
- O portal busca rua, bairro, cidade e UF pelo CEP no momento do cadastro. Aqui esses campos ficam só para conferência: a tela consulta o ViaCEP ao digitar o CEP e mostra o resultado, sem bloquear se a consulta falhar.
- Smart: a coluna R junta rua, número e complemento ("RUA PAULISTA 498 CASA DOS FUNDOS") → separar em rua / 498 / "CASA DOS FUNDOS".

### 2.4 Contratos

| Campo | Cliente | Smart | Regras |
|---|---|---|---|
| Tabela Pacote | Obr. | Fixo: TABELA MAIS ENVIOS À VISTA - PROMOCAO DE INAUGURAÇÃO | Lista |
| Tabela Pacote Reversa | Obr. | Fixo: TABELA MAIS ENVIOS À VISTA | Lista |
| Cartão de postagem (contrato + cartão) | Fixo: contrato 9912701275, cartão 0079505155 | No envio: o único contrato e cartão disponíveis na licença | Sempre **Principal = Sim** |
| CNPJ de faturamento | Calculado: = CPF/CNPJ | Calculado: = CNPJ | |
| Limite de crédito | Obr. | Fixo: R$ 30.000,00 | Valor em reais |
| Seguro | Fixo: 1% | Fixo: 2% | Smart vai com 2% direto na integração, sem o ajuste posterior |
| Dias de validade da reversa | Fixo: 90 | Fixo: 90 | |
| Não cobrar custo de postagem | Padrão: não | Fixo: não | |
| Permitir etiquetas lógicas | Padrão: não (editável) | — | |
| Boleto separado para a filial | Padrão: não (editável) | — | |

### 2.5 Serviços

| | Cliente | Smart |
|---|---|---|
| Serviços | Obr. ao menos 1; cada um com código, % spread e % malha | Fixo: 03298, 03220, 04227, 03158, 03140 |

Ignorar serviços marcados como "NÃO UTILIZAR" / "INDISPONÍVEL".

### 2.6 Dados fiscais

| Campo | Cliente | Smart |
|---|---|---|
| Inscrição Estadual / Municipal | Opcional | — |
| Notificações via WhatsApp | Padrão: sim (editável) | Fixo: sim |
| Etiqueta unificada DANFE/DC-e | Padrão: sim (editável) | Fixo: não |
| Emitir DC-e nas integrações | Padrão: não (editável) | Fixo: não |
| Etiqueta +Envios | Padrão: não (editável) | Fixo: não |
| Exigir CPF/CNPJ do destinatário nas telas (não bloqueia API/integrações) | Padrão: não (editável) | Fixo: não |

### 2.7 Contatos

| Campo | Cliente | Smart |
|---|---|---|
| Nome do contato | Opcional | Col. Y |
| Telefone celular | Opcional | Col. Z |
| Telefones comercial / residencial, site | Opcional | — |

Telefone sem DDD → aviso.

### 2.8 Malha

| Campo | Cliente | Smart |
|---|---|---|
| Utiliza malha | Opcional | Fixo: não |
| Todas as unidades, desconto, declaração de conteúdo (conteúdo, quantidade, valor) | Obr. só se usar malha | — |

### 2.9 Usuários do portal (calculados)

| | Cliente | Smart |
|---|---|---|
| Quantos | 1 | 2 |
| Login | `<1ª palavra do nome fantasia>admin`; se existir, soma a próxima palavra (`testeadmin` → `testebhadmin`...) | `admpdvsmart<sufixo>` e `pdvsmart<sufixo>`, sufixo = última palavra do nome fantasia |
| Nome | Nome Fantasia | Razão Social |
| E-mail | E-mail financeiro | E-mail financeiro |
| Papel | Admin Cliente | Admin Cliente / PDV LICENCIADO (+ Atendente PDV + autorizador da master) |
| Senha | Gerada pelo portal no envio | Gerada pelo portal no envio |

O login é só **sugerido** no pré-cadastro (minúsculo, sem acento) e pode ser editado. A checagem de "login já existe" depende da API e fica para a integração.

### 2.10 Dados do Smart definidos no envio

Beneficiário, contrato, cartão de postagem e autorizador do Smart **não** ficam no pré-cadastro e não há cadastro de masters. Na integração, dentro da licença master informada:

- **Beneficiário:** o primeiro da lista disponível.
- **Contrato e cartão:** a opção disponível (normalmente só existe uma).
- **Autorizador do `pdvsmart...`:** o da própria master.

Esses valores são gravados no pré-cadastro depois do envio, para a revisão de vocês. Se a licença não oferecer nenhuma opção, o envio falha com a mensagem do motivo.

## 3. Como vai funcionar no sistema

### 3.1 Status de cada pré-cadastro

```
Rascunho ──(tudo obrigatório ok)──▶ Pronto ──(admin aprova)──▶ Aprovado ──(próxima tarefa)──▶ Enviado / Erro no envio
   ▲                                  │
   └──────(alguém apaga um campo)─────┘
```

- *Rascunho* e *Pronto* são calculados pelo sistema; ninguém escolhe à mão.
- Só o **Admin global** aprova e dispara o envio.
- Depois de *Aprovado* a linha fica travada para Editores. O Admin global continua podendo editar; a alteração fica na auditoria e, se deixar a linha incompleta, ela volta para *Rascunho*.
- Cada linha mostra o contador "faltam N campos" e a lista do que falta.

### 3.2 Tela em grade (estilo Excel)

- Uma linha por pré-cadastro; colunas agrupadas pelas seções acima (Dados, Faturamento, Endereço, Contratos...). Dá para esconder grupos.
- Filtros por tipo (Cliente/Smart), status, master e busca por nome/CNPJ.
- Edição direto na célula, salvando **campo a campo**: duas pessoas podem preencher partes diferentes da mesma linha ao mesmo tempo sem sobrescrever uma à outra. Se as duas mexerem no mesmo campo, a segunda recebe aviso de conflito.
- Célula obrigatória vazia ou inválida fica destacada; campo fixo aparece em cinza, sem edição.
- Navegação por teclado (setas, Enter, Tab).
- Endereços, serviços e cartões são listas: abrem num painel lateral da linha.
- Botão "Nova linha" com escolha do tipo. No Smart, os campos fixos já vêm preenchidos.
- **Ctrl+V da planilha**, de dois jeitos:
  - **Linhas inteiras da planilha Smart** (colunas A a Z): cada linha colada vira um pré-cadastro Smart, mapeando as colunas conforme a seção 2 (B master, C nome fantasia, E razão social, F CNPJ, R–V endereço, W faturamento, X e-mail, Y contato, Z telefone). Antes de gravar, uma prévia mostra o que será criado, linhas com problema e possíveis duplicados (mesmo CNPJ).
  - **Bloco de células dentro da grade**: com uma célula selecionada, o Ctrl+V preenche a partir dela para a direita e para baixo, como no Excel. Campos fixos são pulados.
- O texto copiado do Excel/Google Sheets chega como colunas separadas por tabulação; a leitura é feita em código próprio, sem biblioteca.

### 3.3 Histórico

Toda alteração passa pela auditoria que já existe (`@Auditable`): quem mudou, quando, valor antigo e novo de cada campo. Na linha, um botão "Histórico" mostra essas alterações.

## 4. Como fica no código

Seguindo as regras do projeto (poucas dependências, migrations, auditoria, português na interface).

### Backend (`backend/src/registrations/`)

| Peça | Conteúdo |
|---|---|
| Entidade `Registration` | Uma coluna por campo simples, mais `type`, `status`, `masterName`, `version`. `@Auditable`. |
| Entidades filhas | `RegistrationAddress`, `RegistrationService`, `RegistrationPostageCard`, `RegistrationPortalUser`. Todas `@Auditable`. |
| Catálogos | Listas de beneficiários, tabelas de pacote e serviços mantidas localmente. Na integração passam a vir da API. |
| `registration-rules.ts` | Um único lugar com os campos, rótulos, grupos e o que é obrigatório, fixo, padrão ou calculado em cada tipo. A API usa para validar e calcular pendências; o frontend recebe por `GET /registrations/schema` e monta a grade a partir dele, sem duplicar regras. |
| Endpoints | `GET /registrations` (filtros), `POST /registrations`, `PATCH /registrations/:id` (só os campos alterados + versão), `POST /registrations/:id/approve` e `/unapprove`, CRUD dos filhos. |
| Validação própria | CPF/CNPJ, CEP, e-mail, telefone com DDD e separação da rua do Smart, em código próprio, sem pacotes novos. |
| Migration | Uma migration criando as tabelas. Nada de `synchronize`. |
| Testes | Regras de completude por tipo, campos fixos não editáveis, aprovação e trava, conflito de edição. |

**Permissões novas** (em `PERMISSIONS`): `registrations.read`, `registrations.edit`, `registrations.edit_approved`, `registrations.approve`, `registrations.send`.

**Papéis** (em `ROLES`), conforme definido por vocês:

| Papel | Pode |
|---|---|
| **Admin global** (o `admin` que já existe) | Tudo: editar, aprovar, editar depois de aprovado, disparar para a Mais Envios, administradores e auditoria |
| **Editor** | Ver e preencher/alterar pré-cadastros não aprovados, incluindo colar da planilha |
| **Leitura** | Só ver os pré-cadastros, o status de cada um e os usuários do portal sugeridos para cada cliente |

### Frontend (`frontend/src/registrations/`)

- Página **Pré-cadastros**: grade, filtros e painel lateral.
- Componente de grade feito no próprio projeto (sem biblioteca de tabela, conforme a regra de poucas dependências).

### Fora deste escopo (próxima tarefa)

- Envio para a API da Mais Envios, criação dos usuários do portal e retorno das senhas.
- Checagem de login duplicado e de CNPJ já cadastrado no portal.
- Sincronizar os catálogos (tabelas, serviços, beneficiários, cartões) com a API.

## 5. Ordem de execução

1. Regras dos campos (`registration-rules.ts`) + entidades + migration + testes de completude.
2. API de pré-cadastro e aprovação, com permissões.
3. Grade no frontend com edição campo a campo e pendências.
4. Painel lateral (endereços, serviços, cartões, usuários sugeridos) e histórico.
5. Ctrl+V da planilha (linhas inteiras do Smart e bloco de células).

## 6. Decisões

| Tema | Decisão |
|---|---|
| Papéis | Admin global, Editor e Leitura (seção 4) |
| Seguro do Smart | 2% direto na integração |
| Importação | Ctrl+V da planilha, sem importação de Word |
| CEP | O portal completa o endereço; a tela consulta o ViaCEP só para conferência |
| Aprovação | Só Admin global aprova; só ele edita depois de aprovado |
| Licenças master | Sem cadastro próprio: beneficiário, contrato e cartão são o primeiro/único disponível na licença, escolhidos no envio e revisados por vocês |
