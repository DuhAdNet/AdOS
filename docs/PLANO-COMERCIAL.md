# JVOS — Plano de Comercialização

## Modelo de Negócio: "Managed AI Desktop" (estilo n8n Cloud)

### Conceito

O usuário baixa o JVOS (desktop app grátis), mas toda a infraestrutura de IA fica conosco:
- **Nós gerenciamos:** tokens de API (OpenAI, Anthropic, Google), servidores MCP, roteamento multi-agente, atualizações
- **O usuário configura:** contexto da empresa, preferências, skills, automações, integrações

O usuário nunca precisa obter API keys, configurar billing em 4 providers, ou entender tokens/costs. Paga uma assinatura fixa mensal e usa.

---

## Arquitetura Cloud

```
┌──────────────────────────────────────────────────────┐
│              JVOS Desktop (cliente)                    │
│  - UI completa (React)                                │
│  - SQLite local (sessões, mensagens, config)          │
│  - MCP client                                         │
│  - Browser automation local                           │
└──────────────────┬───────────────────────────────────┘
                   │ HTTPS (API Gateway)
┌──────────────────┴───────────────────────────────────┐
│              JVOS Cloud (nosso backend)                │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Token Vault │  │ LLM Router  │  │  MCP Proxy   │  │
│  │ (encrypted) │  │ (multi-tier)│  │  (hosted)    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ Usage Meter │  │ Sync Engine │  │ Marketplace  │  │
│  │ (billing)   │  │ (E2E enc.)  │  │ (skills hub) │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## Comparativo com n8n

| Aspecto | n8n | JVOS |
|---------|-----|------|
| Tipo | Workflow automation | AI agent desktop |
| Self-hosted | Sim (open-source) | Sim (app local, traz sua key) |
| Cloud | n8n Cloud (managed) | JVOS Cloud (managed tokens) |
| Diferencial cloud | Hosting + SSL + updates | Tokens + routing + MCP + sync |
| Monetização | Executions/mês | Mensagens/mês ou flat |
| Lock-in | Baixo (exporta workflows) | Baixo (dados locais no SQLite) |

---

## Planos de Assinatura

### Free (Self-Hosted)
- App desktop completo
- Traz suas próprias API keys
- MCP servers locais
- Sem sync, sem marketplace premium
- **Preço:** R$ 0

### Starter
- 1.000 mensagens/mês (mix de modelos)
- Tokens gerenciados (sem API key)
- Sync entre 2 dispositivos
- 5 skills do marketplace premium
- Suporte via comunidade
- **Preço:** R$ 97/mês

### Pro
- 5.000 mensagens/mês
- Acesso a todos os modelos (GPT-5.5, Claude Opus, Gemini Pro)
- MCP servers hosted (5 servidores)
- Sync ilimitado + backup
- Marketplace premium completo
- Telegram/WhatsApp gateway
- Suporte prioritário
- **Preço:** R$ 297/mês

### Enterprise
- Mensagens ilimitadas (fair use)
- Modelos dedicados (sem fila)
- MCP servers custom (ilimitados)
- SSO + multi-workspace
- Auditoria e compliance
- SLA 99.9%
- Onboarding dedicado
- **Preço:** R$ 997/mês (por workspace)

---

## Componentes Técnicos do Backend

### 1. Token Vault
- Armazena API keys dos providers (OpenAI, Anthropic, Google)
- Rotação automática de keys
- Rate limiting por plano
- Encryption at rest (AES-256)
- O cliente nunca vê/toca os tokens

### 2. LLM Router
- Recebe requests do desktop via API
- Roteia para o provider/modelo correto baseado no tier do agente
- Fallback automático (se OpenAI cai, redireciona para Anthropic)
- Cache de respostas idênticas (reduz custo)
- Metering: conta tokens por usuário para billing

### 3. MCP Proxy
- Hospeda MCP servers para usuários (filesystem, web, databases)
- Isolamento por container (cada workspace = 1 container)
- Permite ao desktop conectar em MCP servers remotos sem configurar infra

### 4. Sync Engine
- Sincroniza sessões e config entre dispositivos
- End-to-end encryption (chave derivada da senha do usuário)
- Conflict resolution automático (last-write-wins com merge de mensagens)
- Backup diário com retenção de 30 dias

### 5. Marketplace Hub
- Skills e workflows publicados pela comunidade
- Revenue share: 70% criador / 30% plataforma
- Review e aprovação antes de publicar
- Versionamento (usuário pode travar versão)

### 6. Usage Metering & Billing
- Conta: mensagens enviadas, tokens consumidos, ferramentas executadas
- Dashboard de uso para o cliente
- Alertas quando atingir 80% do plano
- Upgrade/downgrade sem perda de dados

---

## Vantagens Competitivas

1. **Desktop-first:** dados locais, privacidade, funciona offline (com key própria)
2. **Multi-provider sem fricção:** usuário não precisa entender providers/modelos
3. **MCP native:** marketplace de tools via protocolo aberto
4. **Browser automation:** agente pode navegar e executar tarefas web
5. **Custo previsível:** flat mensal vs pay-per-token (mais simples de vender)
6. **Marketplace de skills:** ecossistema de monetização para criadores

---

## Roadmap de Comercialização

### Fase 1 — MVP Cloud (4 semanas)
- [ ] Backend API Gateway (Node.js/Fastify)
- [ ] Token Vault (encrypted store + proxy para providers)
- [ ] LLM Router (recebe request, roteia, responde)
- [ ] Auth: login por email + workspace creation
- [ ] Metering básico (conta mensagens)
- [ ] Desktop: toggle "usar JVOS Cloud" vs "minha key"

### Fase 2 — Billing & Sync (3 semanas)
- [ ] Integração Stripe (assinaturas recorrentes)
- [ ] Dashboard de uso no app
- [ ] Sync Engine (E2E encrypted)
- [ ] Onboarding flow no desktop (criar conta → escolher plano → usar)

### Fase 3 — Marketplace & Growth (4 semanas)
- [ ] Marketplace hub com submissão + review
- [ ] Revenue share automático (Stripe Connect)
- [ ] Landing page + docs públicas
- [ ] Beta fechado (50 usuários)

### Fase 4 — Scale (ongoing)
- [ ] MCP Proxy hosted
- [ ] WhatsApp gateway (além do Telegram)
- [ ] Enterprise features (SSO, audit, multi-seat)
- [ ] Mobile companion app

---

## Unit Economics (estimativa)

| Métrica | Valor |
|---------|-------|
| Custo médio por mensagem (mix de modelos) | ~R$ 0,03 |
| Mensagens/mês plano Starter (1000) | Custo: R$ 30 |
| Receita Starter | R$ 97 |
| **Margem bruta Starter** | **69%** |
| Mensagens/mês plano Pro (5000) | Custo: R$ 150 |
| Receita Pro | R$ 297 |
| **Margem bruta Pro** | **49%** |
| Break-even (infra + dev) | ~100 assinantes Pro |

---

## Go-to-Market

1. **Público-alvo inicial:** gestores de operação, PMEs que usam IA para produtividade
2. **Canal:** Product Hunt, LinkedIn (conteúdo sobre IA operacional), comunidades de automação
3. **Posicionamento:** "Seu departamento de IA por R$97/mês — sem precisar de developer"
4. **Free tier como funil:** app gratuito gera awareness, cloud converte power users
5. **Marketplace como flywheel:** mais skills → mais valor → mais usuários → mais criadores

---

## Decisões de Arquitetura Pendentes

| Decisão | Opções | Recomendação |
|---------|--------|--------------|
| Backend runtime | Node.js / Go / Python | Node.js (Fastify) — mesma stack, time ramp-up zero |
| Hosting | AWS / Vercel / Railway | Railway (simples, escala rápido, preço honesto) |
| Token storage | Vault / KMS / custom AES | AWS KMS para encrypt, Postgres para metadata |
| Auth | Clerk / Auth0 / custom | Clerk (rápido, built-in billing hooks) |
| Billing | Stripe / Lemonsqueezy | Stripe (mais flexível, Stripe Connect para marketplace) |
| Sync protocol | CRDTs / OT / LWW | Last-Write-Wins com merge (simples, suficiente para v1) |
