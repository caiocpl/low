# 🎯 Desafio Criativo — Planejando Automações com N8N Usando Bons Prompts

**Automação escolhida:** registro e notificação de ocorrências de segurança (quase-acidentes, desvios e incidentes) reportadas por formulário.

---

## 🧱 Passo 1 — Defina a automação desejada

```text
Quero criar uma automação no N8N para registrar automaticamente ocorrências de segurança
(quase-acidentes, desvios e incidentes) reportadas por formulário e acionar a equipe responsável.

Público ou responsável:
Equipe de Segurança do Trabalho (SST/HSE) e gestores de área.

Resultado esperado:
Salvar cada ocorrência em uma planilha (base de dados de ocorrências), classificar a gravidade
e enviar uma notificação ao responsável — com alerta imediato nos casos críticos —
além de uma confirmação ao colaborador que reportou.
```

---

## 🧱 Passo 2 — Adicione contexto e regras

```text
Ferramentas envolvidas:
Google Forms, Google Sheets e Gmail.

Fluxo desejado:
1. Receber uma nova resposta do formulário de ocorrências.
2. Validar e padronizar os dados (e-mail, data, área, descrição).
3. Classificar a gravidade (Baixa, Média, Alta ou Crítica) conforme a resposta do formulário.
4. Registrar a ocorrência na planilha, com ID único, data/hora e status "Aberta".
5. Notificar a equipe de SST por e-mail:
   - Gravidade Alta ou Crítica: alerta imediato, com assunto destacado.
   - Gravidade Baixa ou Média: resumo de acompanhamento.
6. Enviar ao colaborador um e-mail de confirmação com o número do registro.

Regras importantes:
- Ignorar (e registrar em uma aba de "Rejeitados") respostas sem e-mail válido ou sem descrição.
- Ocorrências com lesão ou risco à vida são sempre classificadas como Crítica, independentemente
  da gravidade informada.
- Evitar duplicidade: não registrar duas vezes a mesma resposta.
- Em caso de falha em qualquer etapa, avisar o administrador por e-mail.
```

---

## 🧱 Passo 3 — Prompt final (pronto para uso)

```text
Atue como um especialista em N8N e em automação de processos de Segurança do Trabalho (SST/HSE).

Crie uma automação para registrar ocorrências de segurança (quase-acidentes, desvios e incidentes)
reportadas por formulário e acionar a equipe responsável.

Público:
Equipe de Segurança do Trabalho (SST/HSE) e gestores de área.

Ferramentas envolvidas:
Google Forms, Google Sheets e Gmail.

Fluxo:
1. Receber uma nova resposta do formulário de ocorrências.
2. Validar e padronizar os dados (e-mail, data, área, descrição).
3. Classificar a gravidade (Baixa, Média, Alta ou Crítica).
4. Registrar a ocorrência na planilha, com ID único, data/hora e status "Aberta".
5. Notificar a equipe de SST por e-mail: alerta imediato para gravidade Alta ou Crítica
   e resumo de acompanhamento para Baixa ou Média.
6. Enviar ao colaborador um e-mail de confirmação com o número do registro.

Regras:
- Ignorar respostas sem e-mail válido ou sem descrição, registrando-as em uma aba "Rejeitados".
- Ocorrências com lesão ou risco à vida são sempre classificadas como Crítica.
- Evitar registros duplicados.
- Em caso de falha em qualquer etapa, notificar o administrador por e-mail.

Explique quais nós do N8N devem ser utilizados e a lógica de funcionamento do workflow.
Apresente a resposta em formato estruturado: (1) visão geral, (2) tabela de nós
(ordem, nó, função, principais configurações), (3) lógica de decisão e tratamento de erros,
(4) campos da planilha e (5) como testar o workflow.
```

---

## ✅ Checklist de revisão

| Pergunta | Resposta |
|---|---|
| O objetivo da automação está claro? | Sim — registrar ocorrências, classificar a gravidade e notificar. |
| As etapas estão em ordem? | Sim — receber → validar → classificar → registrar → notificar → confirmar. |
| As regras e restrições foram informadas? | Sim — validação, gravidade crítica, duplicidade e tratamento de falhas. |

## 💡 Por que este prompt funciona

| Elemento | Efeito |
|---|---|
| **Papel definido** ("especialista em N8N e SST") | Alinha o vocabulário e o nível técnico da resposta. |
| **Objetivo e público** | Dá contexto sobre quem usa e qual problema resolve. |
| **Ferramentas explícitas** | Evita que a IA sugira integrações que você não usa. |
| **Fluxo numerado** | Define a ordem dos nós e reduz ambiguidades. |
| **Regras e exceções** | Gera o tratamento de erros, as validações e as ramificações (nó IF/Switch). |
| **Formato de saída pedido** | Entrega a resposta pronta para virar documentação ou implementação. |

## 🚀 Possíveis evoluções

- Adicionar um **SLA de tratamento** (ex.: alerta se a ocorrência crítica ficar sem resposta por 24 h).
- Gerar um **relatório semanal** com indicadores (nº de ocorrências por área e gravidade).
- Incluir **análise de causa raiz** como etapa de encerramento do registro.
- Integrar um canal de mensagens (Slack, Teams ou WhatsApp) para os alertas críticos.
