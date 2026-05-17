# JVOS + n8n — Integração Estratégica

## Conceito: IA Pensa, n8n Executa

```
┌──────────────────────────────────────────────────────────┐
│                        JVOS                                │
│                                                           │
│   Usuário → IA decide o que fazer → Precisa de tokens?    │
│                                                           │
│        SIM                              NÃO               │
│         ↓                                ↓                │
│   [Executa via LLM]              [Delega para n8n]        │
│   - Análise complexa             - Enviar email           │
│   - Geração de texto             - Mover arquivo          │
│   - Raciocínio                   - Atualizar planilha     │
│   - Conversação                  - Postar em rede social  │
│   - Decisões ambíguas            - Backup agendado        │
│                                  - Webhook → ação         │
│                                  - CRUD em qualquer API   │
└──────────────────────────────────────────────────────────┘
```

---

## Por que n8n?

| Critério | n8n | Zapier | Make |
|----------|-----|--------|------|
| Open-source | ✅ Sim (fair-code) | ❌ | ❌ |
| Self-hosted | ✅ | ❌ | ❌ |
| Embeddable | ✅ (API + SDK) | ❌ | ❌ |
| Custo de execução | $0 (self-hosted) | $0.01-0.05/task | $0.003/op |
| Nodes disponíveis | 400+ | 5000+ | 1500+ |
| Execução local | ✅ | ❌ | ❌ |
| Custom nodes | ✅ (TypeScript) | ❌ | ❌ |
| Licença | Sustainable Use License | Proprietário | Proprietário |

**Veredito:** n8n é o único que pode rodar embutido dentro do JVOS sem custo de terceiros, com execução local e controle total.

---

## Arquitetura de Integração

### Opção A: n8n Embedded (Recomendada)

```
JVOS Desktop (Electron)
├── Frontend (React)
├── LLM Engine (multi-agent)
├── n8n Instance (embedded)        ← NOVO
│   ├── Roda como subprocess
│   ├── Porta local (5678)
│   ├── DB próprio (SQLite)
│   ├── UI acessível via iframe ou browser integrado
│   └── Comunica com JVOS via:
│       ├── REST API (trigger/execute workflows)
│       ├── Webhooks (n8n → JVOS: notificar conclusão)
│       └── Custom Nodes (JVOS como node dentro do n8n)
└── SQLite (sessões, config, memórias)
```

**Instalação:** n8n vem bundled com o instalador do JVOS. Zero configuração.

### Opção B: n8n Cloud (Para tier Pro/Enterprise)

```
JVOS Desktop → JVOS Cloud → n8n Cloud instance (per-user)
```

Usuário não precisa saber que n8n existe — é infraestrutura invisível.

---

## Fluxo de Decisão: LLM vs n8n

```
Usuário: "Manda esse relatório por email pro time toda segunda às 8h"

JVOS Router analisa:
1. Precisa entender linguagem natural? → SIM → LLM interpreta
2. Geração do relatório precisa de IA? → SIM → LLM gera conteúdo
3. Envio de email é repetitivo e determinístico? → SIM → n8n
4. Agendamento (toda segunda 8h) é cron? → SIM → n8n

Resultado:
- LLM gera template do relatório (1 vez, gasta tokens)
- n8n executa toda segunda: puxa dados → preenche template → envia email (0 tokens)
```

### Regra de Roteamento

| Tipo de tarefa | Motor | Razão |
|---------------|-------|-------|
| Interpretar intenção | LLM | Precisa de linguagem natural |
| Gerar texto/análise | LLM | Criatividade e raciocínio |
| Decidir entre opções ambíguas | LLM | Julgamento |
| Enviar email/mensagem | n8n | Determinístico |
| CRUD em APIs (Sheets, Notion, CRM) | n8n | API call simples |
| Mover/copiar/renomear arquivos | n8n | Operação de filesystem |
| Agendar tarefas recorrentes | n8n | Cron nativo |
| Webhooks (ouvir eventos) | n8n | Event-driven nativo |
| Transformar dados (JSON, CSV) | n8n | Nodes de transformação |
| Condicionais simples (if/then) | n8n | Flow control |
| Loops e batch processing | n8n | Nativo em n8n |

---

## Custom Nodes JVOS para n8n

Criar nodes customizados que conectam n8n ao JVOS:

### 1. JVOS Trigger Node
```
Dispara workflow n8n quando algo acontece no JVOS:
- Nova mensagem de usuário com tag específica
- Skill executada com output
- Automação JVOS finalizada
- Memória salva com categoria X
```

### 2. JVOS Action Node
```
Ações do JVOS disponíveis dentro de workflows n8n:
- Enviar mensagem no chat (notificação)
- Salvar em memória
- Executar skill
- Criar/atualizar sessão
- Gerar conteúdo via LLM (com fallback para tokens mínimos)
```

### 3. JVOS Context Node
```
Puxa contexto do JVOS para usar em workflows:
- Preferências do usuário
- Memórias relevantes
- Estado do workspace
- Última interação
```

---

## Implementação Técnica

### Fase 1: n8n como subprocess (Semana 1-2)

```typescript
// electron/n8n-manager.ts
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let n8nProcess: ChildProcess | null = null;

export async function startN8n(): Promise<void> {
  const n8nBinary = path.join(app.getAppPath(), 'vendor', 'n8n', 'bin', 'n8n');
  
  n8nProcess = spawn(n8nBinary, ['start', '--tunnel'], {
    env: {
      ...process.env,
      N8N_PORT: '5678',
      N8N_BASIC_AUTH_ACTIVE: 'false', // local only
      DB_TYPE: 'sqlite',
      DB_SQLITE_DATABASE: path.join(app.getPath('userData'), 'n8n.db'),
      N8N_USER_FOLDER: path.join(app.getPath('userData'), 'n8n-data'),
      EXECUTIONS_DATA_SAVE_ON_ERROR: 'all',
      EXECUTIONS_DATA_SAVE_ON_SUCCESS: 'all',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Wait for ready
  await waitForPort(5678);
}

export async function executeWorkflow(workflowId: string, data?: any): Promise<any> {
  const response = await fetch(`http://localhost:5678/api/v1/workflows/${workflowId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  return response.json();
}

export async function createWorkflow(definition: any): Promise<string> {
  const response = await fetch('http://localhost:5678/api/v1/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(definition),
  });
  const result = await response.json();
  return result.id;
}

export function stopN8n(): void {
  if (n8nProcess) {
    n8nProcess.kill('SIGTERM');
    n8nProcess = null;
  }
}
```

### Fase 2: Router inteligente LLM↔n8n (Semana 3-4)

```typescript
// electron/task-router.ts

interface TaskAnalysis {
  requiresLLM: boolean;
  requiresN8n: boolean;
  reasoning: string;
  n8nWorkflowSuggestion?: string;
}

async function analyzeTask(userMessage: string): Promise<TaskAnalysis> {
  // LLM rápido (nano) classifica a tarefa
  const classification = await classifyWithLLM(userMessage, `
    Classifique esta tarefa:
    1. Precisa de geração de texto/análise/raciocínio? → requiresLLM: true
    2. Tem execução repetitiva/determinística? → requiresN8n: true
    3. É mista (LLM gera, n8n executa)? → ambos true
    
    Responda JSON: {requiresLLM, requiresN8n, reasoning, n8nWorkflowSuggestion}
  `);
  
  return classification;
}

async function executeTask(message: string): Promise<void> {
  const analysis = await analyzeTask(message);
  
  if (analysis.requiresLLM && !analysis.requiresN8n) {
    // Só LLM — fluxo normal
    await streamLLMResponse(message);
  } 
  else if (!analysis.requiresLLM && analysis.requiresN8n) {
    // Só n8n — executa sem gastar tokens
    const workflowId = await findOrCreateWorkflow(analysis.n8nWorkflowSuggestion);
    await executeWorkflow(workflowId, { input: message });
  }
  else if (analysis.requiresLLM && analysis.requiresN8n) {
    // Misto: LLM gera → n8n executa
    const llmOutput = await generateWithLLM(message);
    const workflowId = await findOrCreateWorkflow(analysis.n8nWorkflowSuggestion);
    await executeWorkflow(workflowId, { input: message, llmOutput });
  }
}
```

### Fase 3: UI Integration (Semana 5-6)

```
Chat JVOS
├── Mensagem: "Envie email pro João toda segunda"
├── [Badge: 🔄 Workflow criado]
├── [Mini-card: n8n workflow #12 — Ativo — Próxima: Seg 8h]
└── [Botão: Ver workflow | Pausar | Editar]
```

Opções de UI:
1. **Inline no chat** — cards com status de workflows criados
2. **Tab "Automações"** — já existe, agora mostra n8n workflows também
3. **Browser integrado** — abre UI do n8n em iframe/janela para edição avançada
4. **Invisible** — n8n roda por baixo, usuário nunca vê (default para básico)

---

## Economia de Tokens (ROI)

### Cenário: Empresário com 10 automações recorrentes

| Automação | Sem n8n (tokens/mês) | Com n8n (tokens/mês) | Economia |
|-----------|---------------------|---------------------|----------|
| Email semanal time | 4x 2K = 8K | 1x 2K (template) + 0 | 75% |
| Report diário métricas | 30x 5K = 150K | 1x 5K + 0 (dados via API) | 97% |
| Triagem inbox | 30x 3K = 90K | 0 (regras n8n) | 100% |
| Post redes sociais | 12x 1.5K = 18K | 1x 1.5K (template) + 0 | 92% |
| Follow-up pendências | 30x 1K = 30K | 0 (check + send n8n) | 100% |
| Backup dados | 30x 0.5K = 15K | 0 (n8n filesystem) | 100% |
| Notificação deadline | 20x 0.5K = 10K | 0 (n8n cron + check) | 100% |
| Atualizar planilha | 20x 1K = 20K | 0 (n8n Google Sheets) | 100% |
| Sync entre apps | 30x 0.5K = 15K | 0 (n8n integrations) | 100% |
| Cobrar respostas | 15x 1K = 15K | 0 (n8n + template) | 100% |
| **TOTAL** | **371K tokens/mês** | **~10K tokens/mês** | **97%** |

**Tradução:** Custo de ~$7.50/mês em tokens cai para ~$0.20/mês. O usuário paga R$197/mês flat e a margem fica enorme.

---

## Experiência do Usuário

### Para quem NÃO quer ver n8n (80% dos empresários):

```
Usuário: "Toda vez que eu receber email do fornecedor X, me avisa no Slack"
JVOS: "✅ Automação criada. Vou monitorar emails de fornecedor@x.com 
       e te notificar no #geral quando chegar algo."
       [Badge: Automação ativa · Verificando a cada 5min]
```

O n8n roda por baixo. Invisible. O usuário só vê o resultado.

### Para quem QUER customizar (20% power users):

```
Usuário: "Mostra o workflow que tá rodando"
JVOS: [Abre UI do n8n no browser integrado]
      "Aqui está o workflow. Você pode editar os nodes, 
       adicionar condições, ou conectar outros apps."
```

---

## Licenciamento do n8n

### Sustainable Use License (atual)
- ✅ Pode embutir em produto próprio
- ✅ Pode distribuir como parte do JVOS
- ✅ Pode rodar localmente para usuários
- ⚠️ NÃO pode oferecer n8n-as-a-service competindo com n8n Cloud
- ⚠️ NÃO pode remover branding sem acordo

### Estratégia:
1. **Tier local (Free/Starter):** n8n embutido, roda na máquina do usuário → 100% legal
2. **Tier Cloud (Pro/Enterprise):** Hospedar instância n8n por usuário → precisa de Enterprise license n8n OU parceria
3. **Alternativa Cloud:** Usar o próprio n8n Cloud do usuário (ele já paga) e JVOS só conecta via API

### Alternativa open-source: Temporal + custom workers
Se licença n8n for problema no futuro:
- Temporal.io (open-source, Apache 2.0) como engine de workflows
- Custom workers em TypeScript que replicam os nodes necessários
- Mais trabalho, mais controle, zero dependência de licença

---

## Workflows Pré-Built (Vem com JVOS)

Templates de workflow n8n que já vêm instalados:

### 1. Email Automations
- `send-scheduled-email` — envia email em horário agendado
- `email-to-slack` — novo email → notifica no Slack
- `email-digest` — agrupa emails do dia → resumo às 18h

### 2. Data Sync
- `sheets-to-notion` — sincroniza Google Sheets ↔ Notion
- `backup-sqlite` — backup diário do DB do JVOS
- `export-sessions` — exporta sessões para Google Drive

### 3. Social Media
- `post-to-instagram` — posta imagem/texto agendado
- `post-to-linkedin` — publica artigo/update
- `social-scheduler` — calendário editorial automático

### 4. Business Ops
- `invoice-reminder` — lembra vencimentos por email/Slack
- `lead-notifier` — novo lead no CRM → notifica time
- `weekly-report-sender` — gera + envia report semanal

### 5. Monitoring
- `uptime-check` — verifica se sites estão online
- `metric-alert` — KPI fora do range → alerta
- `competitor-price-watch` — monitora preços de concorrentes

---

## Roadmap de Implementação

| Fase | Semana | Entregável |
|------|--------|-----------|
| 1 | 1-2 | n8n embedded como subprocess + API wrapper |
| 2 | 3-4 | Router LLM↔n8n + classificação de tarefas |
| 3 | 5-6 | UI inline (cards de workflow no chat) |
| 4 | 7-8 | Custom nodes (JVOS Trigger/Action/Context) |
| 5 | 9-10 | 15 workflows pré-built |
| 6 | 11-12 | Onboarding: "O que você quer automatizar?" → gera workflow |

---

## Diferencial Final

```
ChatGPT/Claude: "Aqui está o texto do email" (você copia e cola)
Zapier/Make: "Eu envio o email" (mas não sabe escrever)
n8n standalone: "Eu executo workflows" (mas precisa montar tudo)

JVOS: "Eu entendo o que você quer, escrevo o conteúdo, 
       E executo automaticamente. Toda semana. Sem gastar a mais."
```

**O JVOS é o primeiro a combinar CÉREBRO (LLM) + MÚSCULO (n8n) em um produto unificado, invisível, e que cobra flat.**
