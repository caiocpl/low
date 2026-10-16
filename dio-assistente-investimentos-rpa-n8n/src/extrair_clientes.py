#!/usr/bin/env python3
"""RPA — extrai os clientes de uma página web e envia ao Webhook do N8N.

O robô faz o que uma pessoa faria à mão: abre a página, lê a tabela de clientes
e entrega os dados a outro sistema (o workflow do N8N), que devolve as mensagens.

Uso:
    pip install requests beautifulsoup4

    # 1) só extrair e mostrar (não precisa do N8N)
    python src/extrair_clientes.py --dry-run

    # 2) extrair e enviar ao Webhook
    python src/extrair_clientes.py --webhook https://SEU_N8N/webhook/clientes
    # ou:  export N8N_WEBHOOK=https://SEU_N8N/webhook/clientes
"""
import argparse
import json
import os
import sys

import requests
from bs4 import BeautifulSoup

URL_PAGINA_PADRAO = "https://digitalinnovationone.github.io/dio-lab-assistente-investimentos-rpa-n8n/"
CAMPOS = ("nome", "email", "saldo", "perfil")  # ordem das colunas da tabela


def baixar_pagina(url: str, timeout: int = 15) -> str:
    """Baixa o HTML da página (falha com exceção se o servidor responder erro)."""
    resposta = requests.get(url, timeout=timeout)
    resposta.raise_for_status()
    resposta.encoding = "utf-8"  # a página é UTF-8; evita acentos quebrados (ex.: "João")
    return resposta.text


def extrair_clientes(html: str) -> list[dict]:
    """Lê a tabela #clientes e devolve uma lista de dicts {nome, email, saldo, perfil}.

    Usa as classes das células (td.nome, td.email...) e, se faltarem, a posição da coluna.
    Linhas incompletas são ignoradas com um aviso, em vez de derrubar o robô.
    """
    sopa = BeautifulSoup(html, "html.parser")
    tabela = sopa.select_one("#clientes")
    if tabela is None:
        return []
    alvo = tabela if tabela.name == "table" else (tabela.find("table") or tabela)
    for quebra in alvo.find_all("br"):
        quebra.replace_with(" ")  # <br> separa palavras; sem isso "Rua A<br>Centro" viraria "Rua ACentro"
    # Linhas de dados: têm <td>, pertencem a esta tabela (não a uma aninhada) e não estão em <thead>/<tfoot>.
    # Não exige <tbody>, que é opcional em HTML.
    linhas = [
        linha for linha in alvo.find_all("tr")
        if linha.find("td") and linha.find_parent("table") is alvo and not linha.find_parent(["thead", "tfoot"])
    ]
    clientes = []
    for numero, linha in enumerate(linhas, start=1):
        colunas = linha.find_all("td")
        cliente = {}
        for posicao, campo in enumerate(CAMPOS):
            celula = linha.select_one(f"td.{campo}")
            if celula is None and posicao < len(colunas):
                celula = colunas[posicao]
            texto = celula.get_text() if celula is not None else ""
            cliente[campo] = " ".join(texto.split())  # normaliza espaços; tags inline não quebram palavras ("Jo<b>ão</b>")
        if not all(cliente.values()):
            print(f"[aviso] linha {numero} ignorada (campos vazios): {cliente}", file=sys.stderr)
            continue
        clientes.append(cliente)
    return clientes


def _lista(valor) -> list:
    """Devolve `valor` se for lista; senão lista vazia (tolera respostas malformadas)."""
    return valor if isinstance(valor, list) else []


def _detalhe_do_erro(resposta: requests.Response) -> str:
    """Extrai uma explicação legível do corpo de uma resposta de erro do N8N."""
    try:
        corpo = resposta.json()
        if isinstance(corpo, dict):
            partes = [str(corpo[k]) for k in ("erro", "detalhe", "message") if corpo.get(k)]
            # no 422 ("nenhum cliente válido") o porquê está nos motivos de cada cliente ignorado
            ignorados = [i for i in _lista(corpo.get("ignorados")) if isinstance(i, dict)]
            if ignorados:
                resumo = "; ".join(
                    f"{i.get('nome') or '(sem nome)'}: {', '.join(map(str, _lista(i.get('motivos'))))}"
                    for i in ignorados[:5]
                )
                partes.append(f"ignorados -> {resumo}" + (" ..." if len(ignorados) > 5 else ""))
            if partes:
                return " — ".join(partes)
    except ValueError:
        pass
    texto = " ".join(resposta.text.split())
    return texto[:200] if texto else "(corpo vazio)"


def enviar_para_n8n(clientes: list[dict], webhook: str, timeout: int = 120) -> dict:
    """Envia {"clientes": [...]} ao Webhook por POST e devolve o JSON (objeto) da resposta."""
    resposta = requests.post(webhook, json={"clientes": clientes}, timeout=timeout)
    try:
        resposta.raise_for_status()
    except requests.HTTPError as erro:
        # mantém o tipo HTTPError, mas inclui o motivo que o workflow devolveu (ex.: 422/502 com {"erro": ...})
        raise requests.HTTPError(f"{erro} :: {_detalhe_do_erro(resposta)}", response=resposta) from erro
    try:
        dados = resposta.json()
    except ValueError:
        raise ValueError(
            f"resposta do N8N não é JSON (HTTP {resposta.status_code}): {_detalhe_do_erro(resposta)}"
        ) from None
    if not isinstance(dados, dict):
        raise ValueError("resposta do N8N não é um objeto JSON")
    return dados


def mostrar_resposta(dados: dict) -> None:
    """Imprime o resumo e as mensagens devolvidas pelo workflow."""
    resumo = dados.get("resumo")
    print("\n=== Resumo ===")
    if isinstance(resumo, dict):
        for chave, valor in resumo.items():
            print(f"  {chave}: {valor}")
    for mensagem in (m for m in _lista(dados.get("mensagens")) if isinstance(m, dict)):
        print(f"\n--- {mensagem.get('nome', '?')} <{mensagem.get('email', '?')}> [{mensagem.get('perfil', '?')}] ---")
        print(mensagem.get("mensagem", "(sem mensagem)"))
    for ignorado in (i for i in _lista(dados.get("ignorados")) if isinstance(i, dict)):
        motivos = ", ".join(map(str, _lista(ignorado.get("motivos"))))
        print(f"\n[ignorado] {ignorado.get('nome') or '(sem nome)'}: {motivos}")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="RPA: extrai clientes da página e envia ao N8N.")
    parser.add_argument("--url", default=os.environ.get("URL_PAGINA", URL_PAGINA_PADRAO),
                        help="página com a tabela de clientes (env: URL_PAGINA)")
    parser.add_argument("--webhook", default=os.environ.get("N8N_WEBHOOK"),
                        help="URL do Webhook do N8N (env: N8N_WEBHOOK)")
    parser.add_argument("--dry-run", action="store_true",
                        help="só extrai e mostra os clientes; não envia ao N8N")
    parser.add_argument("--saida", metavar="ARQUIVO",
                        help="salva a resposta do N8N (JSON) neste arquivo")
    args = parser.parse_args(argv)
    if args.dry_run and args.saida:
        print("[aviso] --saida é ignorado em --dry-run (não há resposta do N8N para salvar).", file=sys.stderr)

    try:
        clientes = extrair_clientes(baixar_pagina(args.url))
    except requests.RequestException as erro:
        print(f"[erro] não foi possível ler a página {args.url}: {erro}", file=sys.stderr)
        return 1

    print(f"Clientes encontrados: {len(clientes)}")
    for cliente in clientes:
        print(" ", cliente)
    if not clientes:
        print("[erro] nenhum cliente extraído — a estrutura da página mudou?", file=sys.stderr)
        return 1

    if args.dry_run:
        return 0
    if not args.webhook:
        print("[erro] informe o Webhook com --webhook ou N8N_WEBHOOK (ou use --dry-run).", file=sys.stderr)
        return 2

    try:
        dados = enviar_para_n8n(clientes, args.webhook)
    except (requests.RequestException, ValueError) as erro:
        print(f"[erro] falha ao enviar ao N8N: {erro}", file=sys.stderr)
        return 1

    mostrar_resposta(dados)
    if args.saida:
        try:
            with open(args.saida, "w", encoding="utf-8") as arquivo:
                json.dump(dados, arquivo, ensure_ascii=False, indent=2)
        except OSError as erro:
            print(f"[erro] o N8N respondeu normalmente, mas não foi possível gravar {args.saida}: {erro}",
                  file=sys.stderr)
            return 1
        print(f"\nResposta salva em {args.saida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
