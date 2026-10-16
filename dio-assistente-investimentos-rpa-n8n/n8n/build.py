#!/usr/bin/env python3
"""Gera n8n/workflow.json (MVP) e n8n/workflow-ia.json (desafio completo).

O código dos nós Code fica em n8n/src/*.js (legível, versionável e testável);
este script só o embute no JSON importável pelo N8N. Os IDs são determinísticos
(uuid5), então rodar o script de novo gera arquivos idênticos.

Uso:  python3 n8n/build.py
"""
import json
import uuid
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
SRC = RAIZ / "src"

URL_CSV = "https://digitalinnovationone.github.io/dio-lab-assistente-investimentos-rpa-n8n/data.csv"

# Nomes dos nós (as referências $('Nome') dentro dos .js dependem destes nomes)
N_WEBHOOK = "Webhook"
N_VALIDAR = "Validar clientes"
N_TEM_VALIDOS = "Tem clientes válidos?"
N_CONFIG = "Config"
N_BAIXAR = "Baixar data.csv"
N_LER = "Ler CSV"
N_AGRUPAR = "Agrupar produtos"
N_CRUZAR = "Cruzar clientes x investimentos"
N_MONTAR = "Montar resposta"
N_MONTAR_IA = "Montar resposta (IA)"
N_OK = "Responder 200"
N_ERRO = "Responder 422"
N_ERRO_CSV = "Responder 502"
N_AGENTE = "Agente de IA"
N_MODELO = "Gemini Chat Model"
N_NOTA = "Nota"


def codigo(nome_arquivo: str) -> str:
    return (SRC / nome_arquivo).read_text(encoding="utf-8").rstrip() + "\n"


_contexto = {"workflow": ""}


def uid(chave: str) -> str:
    """UUID determinístico por workflow: MVP e IA nunca compartilham ids de nó nem webhookId."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"dio-assistente-investimentos/{_contexto['workflow']}/{chave}"))


def no(nome, tipo, versao, posicao, parametros, **extra):
    """Monta um nó no formato de exportação do N8N."""
    n = {
        "parameters": parametros,
        "type": tipo,
        "typeVersion": versao,
        "position": list(posicao),
        "id": uid(nome),
        "name": nome,
    }
    n.update(extra)
    return n


def ligar(origem, destino, saida=0, tipo="main"):
    return {"node": destino, "type": tipo, "index": 0}


def nos_comuns(caminho_webhook):
    """Nós compartilhados pelas duas versões, da entrada até o cruzamento."""
    return [
        no(N_WEBHOOK, "n8n-nodes-base.webhook", 2, (0, 300),
           {"httpMethod": "POST", "path": caminho_webhook, "responseMode": "responseNode", "options": {}},
           webhookId=uid("webhook-id")),
        no(N_VALIDAR, "n8n-nodes-base.code", 2, (240, 300),
           {"jsCode": codigo("validar_clientes.js")}),
        no(N_TEM_VALIDOS, "n8n-nodes-base.if", 2.2, (480, 300), {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                "conditions": [{
                    "id": uid("condicao-tem-validos"),
                    "leftValue": "={{ $json.validos.length > 0 }}",
                    "rightValue": "",
                    "operator": {"type": "boolean", "operation": "true", "singleValue": True},
                }],
                "combinator": "and",
            },
            "options": {},
        }),
        no(N_ERRO, "n8n-nodes-base.respondToWebhook", 1.1, (720, 500), {
            "respondWith": "json",
            "responseBody": (
                "={{ JSON.stringify({ erro: 'Nenhum cliente válido no payload. "
                "Envie {\"clientes\":[{\"nome\",\"email\",\"saldo\",\"perfil\"}]}', "
                "recebidos: $json.recebidos, ignorados: $json.ignorados }) }}"
            ),
            "options": {"responseCode": 422},
        }),
        no(N_CONFIG, "n8n-nodes-base.set", 3.4, (720, 200), {
            "assignments": {"assignments": [{
                "id": uid("atribuicao-csv-url"),
                "name": "csvUrl",
                "value": URL_CSV,
                "type": "string",
            }]},
            "includeOtherFields": True,
            "options": {},
        }),
        no(N_BAIXAR, "n8n-nodes-base.httpRequest", 4.2, (960, 200), {
            "url": "={{ $json.csvUrl }}",
            "options": {"timeout": 15000, "response": {"response": {"responseFormat": "file"}}},
        }, retryOnFail=True, maxTries=3, waitBetweenTries=2000, onError="continueErrorOutput"),
        # Falha ao baixar o data.csv (GitHub Pages fora do ar, URL errada...) -> 502 explicativo, nunca 200 vazio
        no(N_ERRO_CSV, "n8n-nodes-base.respondToWebhook", 1.1, (1200, 420), {
            "respondWith": "json",
            "responseBody": (
                "={{ JSON.stringify({ erro: 'Não foi possível carregar a base de produtos (data.csv)', "
                "detalhe: String(typeof $json.error === 'string' ? $json.error : ($json.error && $json.error.message) || '')"
                ".slice(0, 200) }) }}"
            ),
            "options": {"responseCode": 502},
        }),
        # alwaysOutputData: um CSV sem linhas ainda gera 1 item vazio -> a cadeia segue e o RPA recebe resposta
        # (sem isso, o Aggregate nem executaria e o Webhook ficaria sem responder até o timeout)
        no(N_LER, "n8n-nodes-base.extractFromFile", 1, (1200, 200),
           {"operation": "csv", "options": {}}, alwaysOutputData=True),
        no(N_AGRUPAR, "n8n-nodes-base.aggregate", 1, (1440, 200), {
            "aggregate": "aggregateAllItemData",
            "destinationFieldName": "produtos",
            "options": {},
        }),
        no(N_CRUZAR, "n8n-nodes-base.code", 2, (1680, 200),
           {"jsCode": codigo("cruzar_clientes.js")}),
    ]


def nota(texto, largura=520, altura=300):
    return no(N_NOTA, "n8n-nodes-base.stickyNote", 1, (0, 0),
              {"content": texto, "height": altura, "width": largura})


def workflow(id_workflow, nome, nos, conexoes):
    return {
        "id": id_workflow,  # obrigatório para `n8n import:workflow` (sem id o import falha no SQLite)
        "name": nome,
        "nodes": nos,
        "connections": conexoes,
        "active": False,
        "settings": {"executionOrder": "v1"},
        "pinData": {},
        "meta": {"templateCredsSetupCompleted": False},
    }


def conexoes_comuns():
    return {
        N_WEBHOOK: {"main": [[ligar(N_WEBHOOK, N_VALIDAR)]]},
        N_VALIDAR: {"main": [[ligar(N_VALIDAR, N_TEM_VALIDOS)]]},
        # saída 0 = verdadeiro (há clientes válidos); saída 1 = falso -> 422
        N_TEM_VALIDOS: {"main": [[ligar(N_TEM_VALIDOS, N_CONFIG)], [ligar(N_TEM_VALIDOS, N_ERRO)]]},
        N_CONFIG: {"main": [[ligar(N_CONFIG, N_BAIXAR)]]},
        N_BAIXAR: {"main": [[ligar(N_BAIXAR, N_LER)], [ligar(N_BAIXAR, N_ERRO_CSV)]]},
        N_LER: {"main": [[ligar(N_LER, N_AGRUPAR)]]},
        N_AGRUPAR: {"main": [[ligar(N_AGRUPAR, N_CRUZAR)]]},
    }


def montar_mvp():
    _contexto["workflow"] = "mvp"
    nos = nos_comuns("clientes") + [
        no(N_MONTAR, "n8n-nodes-base.code", 2, (1920, 200), {"jsCode": codigo("montar_resposta.js")}),
        no(N_OK, "n8n-nodes-base.respondToWebhook", 1.1, (2160, 200),
           {"respondWith": "firstIncomingItem", "options": {"responseCode": 200}}),
        nota(
            "## Assistente de Investimentos (MVP — mensagens estáticas)\n"
            "**Fluxo:** Webhook → valida clientes → baixa data.csv → cruza perfil × saldo × aporte mínimo → "
            "mensagem por template → responde ao RPA.\n\n"
            "**Como usar:** ative o workflow, copie a *Production URL* do nó Webhook (`/webhook/clientes`) e configure em "
            "`N8N_WEBHOOK` no script Python (src/extrair_clientes.py).\n\n"
            "**CSV:** a URL do data.csv fica no nó *Config* — aponte para o GitHub Pages do seu fork.\n\n"
            "**Teste rápido:** `curl -X POST <URL> -H 'Content-Type: application/json' "
            "-d '{\"clientes\":[{\"nome\":\"Ana Silva\",\"email\":\"ana@email.com\",\"saldo\":\"R$ 12.500,00\",\"perfil\":\"Conservador\"}]}'`",
            altura=330),
    ]
    con = conexoes_comuns()
    con[N_CRUZAR] = {"main": [[ligar(N_CRUZAR, N_MONTAR)]]}
    con[N_MONTAR] = {"main": [[ligar(N_MONTAR, N_OK)]]}
    return workflow("dioassistinvmvp01", "Assistente de Investimentos — MVP (mensagens estáticas)", nos, con)


def montar_ia():
    _contexto["workflow"] = "ia"
    prompt_usuario = (
        "=Cliente: {{ $json.nome }}\n"
        "Perfil de investidor: {{ $json.perfil }}\n"
        "Saldo disponível: {{ $json.saldoFormatado }}\n"
        "Produtos elegíveis (já filtrados por perfil e aporte mínimo):\n"
        "{{ $json.produtosRecomendados.length ? $json.produtosRecomendados.map(p => "
        "'- ' + p.produto + ' | aporte mínimo ' + p.minimoFormatado + ' | rentabilidade ' + p.rentabilidadeFormatada)"
        ".join('\\n') : '(nenhum — o saldo ainda não alcança o aporte mínimo)' }}\n\n"
        "Escreva a mensagem para este cliente."
    )
    nos = nos_comuns("clientes-ia") + [
        no(N_AGENTE, "@n8n/n8n-nodes-langchain.agent", 1.7, (1920, 200), {
            "promptType": "define",
            "text": prompt_usuario,
            "options": {"systemMessage": codigo("prompt_agente_ia.txt").rstrip()},
        }, onError="continueRegularOutput"),  # sem retry: o n8n reexecutaria o lote inteiro; o fallback é por cliente
        no(N_MODELO, "@n8n/n8n-nodes-langchain.lmChatGoogleGemini", 1, (1920, 440), {
            "modelName": "models/gemini-2.5-flash",
            "options": {"temperature": 0.4},
        }, credentials={"googlePalmApi": {"id": "", "name": "Google Gemini(PaLM) Api account"}}),
        no(N_MONTAR_IA, "n8n-nodes-base.code", 2, (2240, 200), {"jsCode": codigo("montar_resposta_ia.js")}),
        no(N_OK, "n8n-nodes-base.respondToWebhook", 1.1, (2480, 200),
           {"respondWith": "firstIncomingItem", "options": {"responseCode": 200}}),
        nota(
            "## Assistente de Investimentos (IA generativa)\n"
            "Mesmo fluxo do MVP, com um **Agente de IA** que escreve uma mensagem única por cliente.\n\n"
            "**Webhook próprio:** este fluxo responde em `/webhook/clientes-ia` (o MVP usa `/webhook/clientes`), então os dois podem ficar ativos juntos.\n\n"
            "**Antes de ativar:** abra o nó *Gemini Chat Model* e selecione sua credencial "
            "(Google Gemini API). Para usar OpenAI/Claude, troque esse nó por *OpenAI Chat Model* / "
            "*Anthropic Chat Model* e ligue-o à entrada *Chat Model* do Agente.\n\n"
            "**Resiliência:** se a IA falhar (cota, rede, resposta vazia), o nó *Montar resposta (IA)* "
            "usa a mensagem-template — o RPA sempre recebe uma resposta.",
            altura=330),
    ]
    con = conexoes_comuns()
    con[N_CRUZAR] = {"main": [[ligar(N_CRUZAR, N_AGENTE)]]}
    con[N_MODELO] = {"ai_languageModel": [[ligar(N_MODELO, N_AGENTE, tipo="ai_languageModel")]]}
    con[N_AGENTE] = {"main": [[ligar(N_AGENTE, N_MONTAR_IA)]]}
    con[N_MONTAR_IA] = {"main": [[ligar(N_MONTAR_IA, N_OK)]]}
    return workflow("dioassistinvia001", "Assistente de Investimentos — IA generativa", nos, con)


def posicionar_nota(wf):
    """Coloca a nota acima do fluxo, sem sobrepor nenhum nó."""
    for n in wf["nodes"]:
        if n["name"] == N_NOTA:
            n["position"] = [0, -220]


def main():
    for arquivo, wf in (("workflow.json", montar_mvp()), ("workflow-ia.json", montar_ia())):
        posicionar_nota(wf)
        destino = RAIZ / arquivo
        destino.write_text(json.dumps(wf, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"gerado: {destino.relative_to(RAIZ.parent)} ({len(wf['nodes'])} nós)")


if __name__ == "__main__":
    main()
