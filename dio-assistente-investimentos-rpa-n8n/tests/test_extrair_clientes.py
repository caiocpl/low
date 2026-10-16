"""Testes do robô de RPA (src/extrair_clientes.py) e do notebook equivalente.

Somente stdlib + requests/bs4 (dependências do próprio robô). Nenhum acesso à
internet: páginas e webhooks são simulados por um servidor HTTP local em thread.

Executar:
    python3 -m unittest discover -s tests -v
"""
import contextlib
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

import requests

RAIZ = Path(__file__).resolve().parent.parent
CAMINHO_MODULO = RAIZ / "src" / "extrair_clientes.py"
CAMINHO_NOTEBOOK = RAIZ / "src" / "extrair_clientes.ipynb"
CAMINHO_HTML = RAIZ / "docs" / "index.html"

# Garante que 127.0.0.1 nunca passe por proxy corporativo/sandbox.
os.environ["NO_PROXY"] = "127.0.0.1,localhost"
os.environ["no_proxy"] = "127.0.0.1,localhost"


def carregar_modulo():
    spec = importlib.util.spec_from_file_location("extrair_clientes_sob_teste", CAMINHO_MODULO)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


ec = carregar_modulo()

HTML_REAL = CAMINHO_HTML.read_text(encoding="utf-8")

CLIENTES_ESPERADOS = [
    ("Ana Silva", "ana@email.com", "R$ 12.500,00", "Conservador"),
    ("Bruno Lima", "bruno@email.com", "R$ 3.200,00", "Moderado"),
    ("Carla Souza", "carla@email.com", "R$ 28.900,00", "Arrojado"),
    ("Daniel Oliveira", "daniel@email.com", "R$ 850,00", "Conservador"),
    ("Elena Rodrigues", "elena@email.com", "R$ 45.000,00", "Arrojado"),
    ("Felipe Santos", "felipe@email.com", "R$ 7.800,00", "Moderado"),
    ("Gabriela Costa", "gabriela@email.com", "R$ 1.500,00", "Conservador"),
    ("Henrique Alves", "henrique@email.com", "R$ 22.300,00", "Moderado"),
    ("Isabela Martins", "isabela@email.com", "R$ 500,00", "Conservador"),
    ("João Pereira", "joao@email.com", "R$ 15.000,00", "Arrojado"),
]
CLIENTES_REAIS = [dict(zip(ec.CAMPOS, t)) for t in CLIENTES_ESPERADOS]

RESPOSTA_N8N = {
    "resumo": {"recebidos": 1, "processados": 1, "ignorados": 0},
    "mensagens": [{
        "nome": "Ana Silva", "email": "ana@email.com", "perfil": "Conservador",
        "mensagem": "Olá, Ana! Aviso: não é recomendação de investimento.",
    }],
    "ignorados": [],
}


def html_tabela(linhas_html: str, tabela_id: str = "clientes", com_tbody: bool = True) -> str:
    corpo = f"<tbody>{linhas_html}</tbody>" if com_tbody else linhas_html
    return (f'<html><body><table id="{tabela_id}"><thead><tr><th>Nome</th><th>Email</th>'
            f'<th>Saldo</th><th>Perfil</th></tr></thead>{corpo}</table></body></html>')


# --------------------------------------------------------------------------- #
# Servidor HTTP local
# --------------------------------------------------------------------------- #
class _Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):  # silencia o log
        pass

    def _responder(self, status, corpo: bytes, content_type=None):
        self.send_response(status)
        if content_type:
            self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        srv = self.server
        srv.requisicoes.append({"metodo": "GET", "path": self.path})
        if self.path == "/index":  # HTML real, UTF-8, SEM charset no Content-Type
            self._responder(200, HTML_REAL.encode("utf-8"), "text/html")
        elif self.path == "/index-charset-latin1":  # cabeçalho mente: diz latin-1, corpo é UTF-8
            self._responder(200, HTML_REAL.encode("utf-8"), "text/html; charset=ISO-8859-1")
        elif self.path == "/index-sem-content-type":
            self._responder(200, HTML_REAL.encode("utf-8"))
        elif self.path == "/vazia":
            self._responder(200, b"<html><body><p>sem tabela</p></body></html>", "text/html; charset=utf-8")
        elif self.path == "/500":
            self._responder(500, b"erro interno", "text/plain")
        elif self.path == "/404":
            self._responder(404, b"nao achei", "text/plain")
        elif self.path == "/lenta":
            time.sleep(2)
            try:
                self._responder(200, b"tarde demais", "text/html")
            except OSError:
                pass
        else:
            self._responder(404, b"?", "text/plain")

    def do_POST(self):
        srv = self.server
        tamanho = int(self.headers.get("Content-Length") or 0)
        corpo = self.rfile.read(tamanho)
        srv.requisicoes.append({
            "metodo": "POST", "path": self.path, "corpo": corpo,
            "content_type": self.headers.get("Content-Type"),
        })
        if self.path == "/webhook":
            self._responder(200, json.dumps(RESPOSTA_N8N, ensure_ascii=False).encode("utf-8"),
                            "application/json; charset=utf-8")
        elif self.path == "/webhook-texto":
            self._responder(200, b"Workflow was started", "text/plain")
        elif self.path == "/webhook-html":
            self._responder(200, b"<html>login</html>", "text/html")
        elif self.path == "/webhook-vazio":
            self._responder(200, b"", "application/json")
        elif self.path == "/webhook-lista":
            self._responder(200, b"[1, 2, 3]", "application/json")
        elif self.path == "/webhook-null":
            self._responder(200, b"null", "application/json")
        elif self.path == "/webhook-422-ignorados":
            corpo = {"erro": "Nenhum cliente válido no payload.", "recebidos": 2, "ignorados": [
                {"indice": 0, "nome": "Zé", "motivos": ["e-mail inválido", "saldo inválido"]},
                {"indice": 1, "nome": None, "motivos": ["nome ausente"]}]}
            self._responder(422, json.dumps(corpo, ensure_ascii=False).encode("utf-8"), "application/json")
        elif self.path == "/webhook-502":
            corpo = {"erro": "Não foi possível carregar a base de produtos (data.csv)", "detalhe": "connect ECONNREFUSED"}
            self._responder(502, json.dumps(corpo, ensure_ascii=False).encode("utf-8"), "application/json")
        elif self.path == "/webhook-malformado":  # JSON objeto, mas com tipos errados
            self._responder(200, b'{"resumo": 5, "mensagens": [1, {"nome": "so nome"}, null], "ignorados": "x"}',
                            "application/json")
        elif self.path == "/webhook-422":
            self._responder(422, b'{"erro":"nenhum cliente valido"}', "application/json")
        elif self.path == "/webhook-500":
            self._responder(500, b'{"message":"Error in workflow"}', "application/json")
        elif self.path == "/webhook-404":
            self._responder(404, b'{"message":"not registered"}', "application/json")
        elif self.path == "/webhook-lento":
            time.sleep(2)
            try:
                self._responder(200, b"{}", "application/json")
            except OSError:
                pass
        else:
            self._responder(404, b"?", "text/plain")


class ServidorLocal:
    def __init__(self):
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self.httpd.daemon_threads = True
        self.httpd.requisicoes = []
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    @property
    def base(self):
        return f"http://127.0.0.1:{self.httpd.server_address[1]}"

    @property
    def requisicoes(self):
        return self.httpd.requisicoes

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=5)


class BaseComServidor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.servidor = ServidorLocal().__enter__()
        cls.base = cls.servidor.base

    @classmethod
    def tearDownClass(cls):
        cls.servidor.__exit__(None, None, None)

    def setUp(self):
        self.servidor.requisicoes.clear()


def rodar_main(argv, env=None):
    """Roda main() capturando stdout/stderr. Retorna (codigo, stdout, stderr)."""
    out, err = io.StringIO(), io.StringIO()
    base_env = {k: v for k, v in os.environ.items() if k not in ("N8N_WEBHOOK", "URL_PAGINA")}
    base_env.update(env or {})
    with mock.patch.dict(os.environ, base_env, clear=True), \
            contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        codigo = ec.main(argv)
    return codigo, out.getvalue(), err.getvalue()


# --------------------------------------------------------------------------- #
# extrair_clientes()
# --------------------------------------------------------------------------- #
class TestExtrairClientes(unittest.TestCase):
    def test_pagina_real_tem_10_clientes_com_campos_exatos(self):
        clientes = ec.extrair_clientes(HTML_REAL)
        self.assertEqual(len(clientes), 10)
        self.assertEqual(clientes, CLIENTES_REAIS)

    def test_cada_cliente_tem_exatamente_as_4_chaves_em_ordem(self):
        for c in ec.extrair_clientes(HTML_REAL):
            self.assertEqual(list(c.keys()), ["nome", "email", "saldo", "perfil"])
            self.assertTrue(all(isinstance(v, str) and v == v.strip() and v for v in c.values()))

    def test_acentos_de_joao_preservados(self):
        nomes = [c["nome"] for c in ec.extrair_clientes(HTML_REAL)]
        self.assertIn("João Pereira", nomes)
        self.assertNotIn("JoÃ£o Pereira", nomes)

    def test_saldo_vem_como_texto_original_nao_convertido(self):
        ana = ec.extrair_clientes(HTML_REAL)[0]
        self.assertEqual(ana["saldo"], "R$ 12.500,00")

    def test_fallback_por_posicao_quando_faltam_classes(self):
        html = html_tabela(
            "<tr><td>Zeca Teste</td><td>zeca@email.com</td><td>R$ 100,00</td><td>Moderado</td></tr>")
        self.assertEqual(ec.extrair_clientes(html), [
            {"nome": "Zeca Teste", "email": "zeca@email.com", "saldo": "R$ 100,00", "perfil": "Moderado"}])

    def test_classes_tem_prioridade_sobre_posicao(self):
        # colunas fora de ordem: as classes devem vencer a posição
        html = html_tabela(
            '<tr><td class="perfil">Arrojado</td><td class="saldo">R$ 1,00</td>'
            '<td class="email">a@b.com</td><td class="nome">Ordem Trocada</td></tr>')
        self.assertEqual(ec.extrair_clientes(html), [
            {"nome": "Ordem Trocada", "email": "a@b.com", "saldo": "R$ 1,00", "perfil": "Arrojado"}])

    def test_fallback_misto_algumas_classes_faltando(self):
        html = html_tabela(
            '<tr><td class="nome">Mista</td><td>mista@email.com</td>'
            '<td class="saldo">R$ 5,00</td><td>Conservador</td></tr>')
        self.assertEqual(ec.extrair_clientes(html)[0],
                         {"nome": "Mista", "email": "mista@email.com", "saldo": "R$ 5,00", "perfil": "Conservador"})

    def test_espacos_e_quebras_de_linha_nas_pontas_sao_removidos(self):
        html = html_tabela(
            '<tr><td class="nome">\n   Ana  \n</td><td class="email"> a@b.com </td>'
            '<td class="saldo">\tR$ 1,00\n</td><td class="perfil"> Moderado </td></tr>')
        self.assertEqual(ec.extrair_clientes(html)[0]["nome"], "Ana")
        self.assertEqual(ec.extrair_clientes(html)[0]["perfil"], "Moderado")

    def test_linha_incompleta_ignorada_com_aviso_em_stderr(self):
        html = html_tabela(
            '<tr><td class="nome">Boa</td><td class="email">boa@x.com</td>'
            '<td class="saldo">R$ 10,00</td><td class="perfil">Moderado</td></tr>'
            '<tr><td class="nome">Sem Email</td><td class="email"></td>'
            '<td class="saldo">R$ 10,00</td><td class="perfil">Moderado</td></tr>'
            '<tr><td>So</td><td>Duas</td></tr>')
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            clientes = ec.extrair_clientes(html)
        self.assertEqual([c["nome"] for c in clientes], ["Boa"])
        avisos = [l for l in err.getvalue().splitlines() if l.startswith("[aviso]")]
        self.assertEqual(len(avisos), 2, err.getvalue())
        self.assertIn("linha 2", avisos[0])
        self.assertIn("linha 3", avisos[1])
        self.assertEqual(out.getvalue(), "", "o aviso deve ir para stderr, nunca para stdout")

    def test_linha_de_cabecalho_dentro_do_tbody_e_pulada_sem_aviso(self):
        # linha só com <th> é cabeçalho, não cliente: é pulada em silêncio (sem ruído em stderr)
        html = html_tabela('<tr><th>Nome</th><th>Email</th><th>Saldo</th><th>Perfil</th></tr>'
                           '<tr><td>A</td><td>a@a.com</td><td>R$ 1,00</td><td>Moderado</td></tr>')
        with contextlib.redirect_stderr(io.StringIO()) as err:
            clientes = ec.extrair_clientes(html)
        self.assertEqual(len(clientes), 1)
        self.assertEqual(err.getvalue(), "")

    def test_tabela_ausente_devolve_lista_vazia(self):
        self.assertEqual(ec.extrair_clientes("<html><body><p>nada</p></body></html>"), [])

    def test_html_vazio_devolve_lista_vazia(self):
        self.assertEqual(ec.extrair_clientes(""), [])

    def test_tabela_com_id_diferente_devolve_lista_vazia(self):
        html = html_tabela('<tr><td>A</td><td>a@a.com</td><td>R$ 1,00</td><td>Moderado</td></tr>',
                           tabela_id="outra")
        self.assertEqual(ec.extrair_clientes(html), [])

    def test_tabela_sem_linhas_devolve_lista_vazia(self):
        self.assertEqual(ec.extrair_clientes(html_tabela("")), [])

    def test_colunas_extras_sao_ignoradas(self):
        html = html_tabela('<tr><td>A</td><td>a@a.com</td><td>R$ 1,00</td><td>Moderado</td><td>extra</td></tr>')
        self.assertEqual(ec.extrair_clientes(html)[0],
                         {"nome": "A", "email": "a@a.com", "saldo": "R$ 1,00", "perfil": "Moderado"})

    def test_tabela_sem_tbody_explicito(self):
        """<tbody> é opcional em HTML; navegadores o inserem, html.parser não.

        Uma página válida sem <tbody> não deveria resultar em zero clientes.
        """
        html = html_tabela('<tr><td class="nome">Sem Tbody</td><td class="email">s@t.com</td>'
                           '<td class="saldo">R$ 1,00</td><td class="perfil">Moderado</td></tr>',
                           com_tbody=False)
        with contextlib.redirect_stderr(io.StringIO()):
            clientes = ec.extrair_clientes(html)
        self.assertEqual([c["nome"] for c in clientes], ["Sem Tbody"])

    def test_nome_com_tag_interna_e_entidade_html(self):
        html = html_tabela('<tr><td class="nome"><b>Jos&eacute;</b> D&#39;Ávila</td><td class="email">j@x.com</td>'
                           '<td class="saldo">R$ 1,00</td><td class="perfil">Arrojado</td></tr>')
        self.assertEqual(ec.extrair_clientes(html)[0]["nome"], "José D'Ávila")

    def test_resultado_e_json_serializavel(self):
        json.dumps({"clientes": ec.extrair_clientes(HTML_REAL)}, ensure_ascii=False)


# --------------------------------------------------------------------------- #
# baixar_pagina()
# --------------------------------------------------------------------------- #
class TestBaixarPagina(BaseComServidor):
    def test_utf8_mesmo_sem_charset_no_content_type(self):
        html = ec.baixar_pagina(self.base + "/index")
        self.assertIn("João Pereira", html)
        self.assertNotIn("Ã£", html)
        self.assertEqual(ec.extrair_clientes(html), CLIENTES_REAIS)

    def test_utf8_mesmo_sem_nenhum_content_type(self):
        self.assertIn("João Pereira", ec.baixar_pagina(self.base + "/index-sem-content-type"))

    def test_utf8_forcado_mesmo_com_charset_latin1_no_cabecalho(self):
        self.assertIn("João Pereira", ec.baixar_pagina(self.base + "/index-charset-latin1"))

    def test_sem_a_correcao_o_requests_decodificaria_errado(self):
        """Prova de que o teste de encoding é significativo: o padrão do requests quebra o acento."""
        bruto = requests.get(self.base + "/index", timeout=5)
        self.assertEqual(bruto.encoding, "ISO-8859-1")
        self.assertIn("JoÃ£o", bruto.text)

    def test_status_500_levanta_http_error(self):
        with self.assertRaises(requests.HTTPError) as ctx:
            ec.baixar_pagina(self.base + "/500")
        self.assertEqual(ctx.exception.response.status_code, 500)

    def test_status_404_levanta_http_error(self):
        with self.assertRaises(requests.HTTPError) as ctx:
            ec.baixar_pagina(self.base + "/404")
        self.assertEqual(ctx.exception.response.status_code, 404)

    def test_servidor_inacessivel_levanta_connection_error(self):
        with self.assertRaises(requests.ConnectionError):
            ec.baixar_pagina("http://127.0.0.1:1/", timeout=2)

    def test_url_sem_esquema_levanta_request_exception(self):
        with self.assertRaises(requests.RequestException):
            ec.baixar_pagina("sem-esquema")

    def test_timeout_e_respeitado(self):
        inicio = time.monotonic()
        with self.assertRaises(requests.Timeout):
            ec.baixar_pagina(self.base + "/lenta", timeout=0.3)
        self.assertLess(time.monotonic() - inicio, 1.5)

    def test_timeout_padrao_enviado_ao_requests(self):
        with mock.patch.object(ec.requests, "get") as get:
            get.return_value.text = ""
            ec.baixar_pagina("http://x")
        self.assertEqual(get.call_args.kwargs.get("timeout"), 15)

    def test_faz_um_unico_get(self):
        ec.baixar_pagina(self.base + "/index")
        self.assertEqual([r["metodo"] for r in self.servidor.requisicoes], ["GET"])


# --------------------------------------------------------------------------- #
# enviar_para_n8n()
# --------------------------------------------------------------------------- #
class TestEnviarParaN8n(BaseComServidor):
    def test_corpo_exatamente_clientes_e_content_type_json(self):
        dados = ec.enviar_para_n8n(CLIENTES_REAIS, self.base + "/webhook")
        self.assertEqual(dados, RESPOSTA_N8N)
        req = self.servidor.requisicoes[-1]
        self.assertEqual(req["metodo"], "POST")
        self.assertTrue(req["content_type"].startswith("application/json"), req["content_type"])
        corpo = json.loads(req["corpo"].decode("utf-8"))
        self.assertEqual(list(corpo.keys()), ["clientes"])
        self.assertEqual(corpo, {"clientes": CLIENTES_REAIS})
        for c in corpo["clientes"]:
            self.assertEqual(set(c), {"nome", "email", "saldo", "perfil"})

    def test_corpo_preserva_joao_apos_roundtrip(self):
        ec.enviar_para_n8n(CLIENTES_REAIS, self.base + "/webhook")
        corpo = json.loads(self.servidor.requisicoes[-1]["corpo"].decode("utf-8"))
        self.assertEqual(corpo["clientes"][-1]["nome"], "João Pereira")

    def test_lista_vazia_ainda_envia_clientes_vazio(self):
        ec.enviar_para_n8n([], self.base + "/webhook")
        self.assertEqual(json.loads(self.servidor.requisicoes[-1]["corpo"]), {"clientes": []})

    def test_um_unico_post(self):
        ec.enviar_para_n8n(CLIENTES_REAIS, self.base + "/webhook")
        self.assertEqual(len(self.servidor.requisicoes), 1)

    def test_resposta_utf8_decodificada(self):
        # resposta com acentos
        dados = ec.enviar_para_n8n(CLIENTES_REAIS, self.base + "/webhook")
        self.assertIn("Olá", dados["mensagens"][0]["mensagem"])

    def test_status_500_levanta_http_error(self):
        with self.assertRaises(requests.HTTPError):
            ec.enviar_para_n8n(CLIENTES_REAIS, self.base + "/webhook-500")

    def test_status_404_levanta_http_error(self):
        with self.assertRaises(requests.HTTPError):
            ec.enviar_para_n8n(CLIENTES_REAIS, self.base + "/webhook-404")

    def test_status_422_levanta_http_error(self):
        with self.assertRaises(requests.HTTPError):
            ec.enviar_para_n8n(CLIENTES_REAIS, self.base + "/webhook-422")

    def test_resposta_nao_json_levanta_valueerror(self):
        with self.assertRaises(ValueError):
            ec.enviar_para_n8n(CLIENTES_REAIS, self.base + "/webhook-texto")

    def test_resposta_vazia_levanta_valueerror(self):
        with self.assertRaises(ValueError):
            ec.enviar_para_n8n(CLIENTES_REAIS, self.base + "/webhook-vazio")

    def test_servidor_inacessivel_levanta_connection_error(self):
        with self.assertRaises(requests.ConnectionError):
            ec.enviar_para_n8n(CLIENTES_REAIS, "http://127.0.0.1:1/webhook", timeout=2)

    def test_timeout_e_respeitado(self):
        inicio = time.monotonic()
        with self.assertRaises(requests.Timeout):
            ec.enviar_para_n8n(CLIENTES_REAIS, self.base + "/webhook-lento", timeout=0.3)
        self.assertLess(time.monotonic() - inicio, 1.5)

    def test_timeout_padrao_120s_enviado_ao_requests(self):
        with mock.patch.object(ec.requests, "post") as post:
            post.return_value.json.return_value = {}
            ec.enviar_para_n8n([], "http://x")
        self.assertEqual(post.call_args.kwargs.get("timeout"), 120)


# --------------------------------------------------------------------------- #
# mostrar_resposta()
# --------------------------------------------------------------------------- #
class TestMostrarResposta(unittest.TestCase):
    def _capturar(self, dados):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            ec.mostrar_resposta(dados)
        return out.getvalue()

    def test_imprime_resumo_mensagens_e_ignorados(self):
        saida = self._capturar({
            "resumo": {"recebidos": 3, "processados": 1, "ignorados": 2},
            "mensagens": RESPOSTA_N8N["mensagens"],
            "ignorados": [{"indice": 1, "nome": None, "motivos": ["nome ausente", "e-mail inválido"]},
                          {"indice": 2, "nome": "Zé", "motivos": ["perfil inválido"]}],
        })
        self.assertIn("recebidos: 3", saida)
        self.assertIn("--- Ana Silva <ana@email.com> [Conservador] ---", saida)
        self.assertIn("não é recomendação de investimento", saida)
        self.assertIn("[ignorado] (sem nome): nome ausente, e-mail inválido", saida)
        self.assertIn("[ignorado] Zé: perfil inválido", saida)

    def test_cada_mensagem_impressa_uma_unica_vez(self):
        saida = self._capturar(RESPOSTA_N8N)
        self.assertEqual(saida.count("--- Ana Silva"), 1)
        self.assertEqual(saida.count("=== Resumo ==="), 1)

    def test_resposta_vazia_nao_quebra(self):
        self.assertIn("=== Resumo ===", self._capturar({}))


# --------------------------------------------------------------------------- #
# main()
# --------------------------------------------------------------------------- #
class TestMain(BaseComServidor):
    def test_dry_run_exit_0_imprime_clientes_e_nao_envia(self):
        codigo, out, err = rodar_main(["--url", self.base + "/index", "--dry-run"])
        self.assertEqual(codigo, 0, err)
        self.assertIn("Clientes encontrados: 10", out)
        self.assertIn("João Pereira", out)
        self.assertEqual([r["metodo"] for r in self.servidor.requisicoes], ["GET"])
        self.assertEqual(err, "")

    def test_dry_run_imprime_cada_cliente_uma_vez_sem_duplicar_saida(self):
        _, out, _ = rodar_main(["--url", self.base + "/index", "--dry-run"])
        self.assertEqual(out.count("Clientes encontrados:"), 1)
        for nome in ("Ana Silva", "Bruno Lima", "João Pereira"):
            self.assertEqual(out.count(nome), 1, f"{nome} impresso {out.count(nome)}x")

    def test_dry_run_ignora_webhook_mesmo_informado(self):
        codigo, _, _ = rodar_main(["--url", self.base + "/index", "--dry-run", "--webhook", self.base + "/webhook"])
        self.assertEqual(codigo, 0)
        self.assertNotIn("POST", [r["metodo"] for r in self.servidor.requisicoes])

    def test_sem_webhook_exit_2(self):
        codigo, out, err = rodar_main(["--url", self.base + "/index"])
        self.assertEqual(codigo, 2)
        self.assertIn("--webhook", err)
        self.assertIn("N8N_WEBHOOK", err)
        self.assertNotIn("POST", [r["metodo"] for r in self.servidor.requisicoes])

    def test_webhook_vazio_no_ambiente_conta_como_ausente(self):
        codigo, _, _ = rodar_main(["--url", self.base + "/index"], env={"N8N_WEBHOOK": ""})
        self.assertEqual(codigo, 2)

    def test_pagina_inacessivel_exit_1(self):
        codigo, out, err = rodar_main(["--url", "http://127.0.0.1:1/", "--dry-run"])
        self.assertEqual(codigo, 1)
        self.assertIn("[erro] não foi possível ler a página", err)

    def test_pagina_500_exit_1(self):
        codigo, _, err = rodar_main(["--url", self.base + "/500", "--dry-run"])
        self.assertEqual(codigo, 1)
        self.assertIn("[erro]", err)

    def test_pagina_404_exit_1(self):
        codigo, _, err = rodar_main(["--url", self.base + "/404", "--dry-run"])
        self.assertEqual(codigo, 1)

    def test_url_invalida_exit_1_sem_traceback(self):
        codigo, _, err = rodar_main(["--url", "isto-nao-e-url", "--dry-run"])
        self.assertEqual(codigo, 1)
        self.assertNotIn("Traceback", err)

    def test_pagina_sem_tabela_exit_1_com_erro(self):
        codigo, out, err = rodar_main(["--url", self.base + "/vazia", "--dry-run"])
        self.assertEqual(codigo, 1)
        self.assertIn("nenhum cliente extraído", err)

    def test_envio_ok_exit_0_e_imprime_mensagens(self):
        codigo, out, err = rodar_main(["--url", self.base + "/index", "--webhook", self.base + "/webhook"])
        self.assertEqual(codigo, 0, err)
        self.assertIn("=== Resumo ===", out)
        self.assertEqual(out.count("--- Ana Silva"), 1)
        posts = [r for r in self.servidor.requisicoes if r["metodo"] == "POST"]
        self.assertEqual(len(posts), 1)
        self.assertEqual(json.loads(posts[0]["corpo"]), {"clientes": CLIENTES_REAIS})

    def test_webhook_devolvendo_500_exit_1(self):
        codigo, _, err = rodar_main(["--url", self.base + "/index", "--webhook", self.base + "/webhook-500"])
        self.assertEqual(codigo, 1)
        self.assertIn("[erro] falha ao enviar ao N8N", err)

    def test_webhook_devolvendo_404_exit_1(self):
        codigo, _, err = rodar_main(["--url", self.base + "/index", "--webhook", self.base + "/webhook-404"])
        self.assertEqual(codigo, 1)

    def test_webhook_devolvendo_422_exit_1(self):
        codigo, _, err = rodar_main(["--url", self.base + "/index", "--webhook", self.base + "/webhook-422"])
        self.assertEqual(codigo, 1)

    def test_webhook_inacessivel_exit_1(self):
        codigo, _, err = rodar_main(["--url", self.base + "/index", "--webhook", "http://127.0.0.1:1/x"])
        self.assertEqual(codigo, 1)
        self.assertIn("[erro]", err)

    def test_webhook_com_resposta_nao_json_tratada_exit_1(self):
        for rota in ("/webhook-texto", "/webhook-html", "/webhook-vazio"):
            with self.subTest(rota=rota):
                codigo, _, err = rodar_main(["--url", self.base + "/index", "--webhook", self.base + rota])
                self.assertEqual(codigo, 1)
                self.assertIn("[erro] falha ao enviar ao N8N", err)
                self.assertNotIn("Traceback", err)

    def test_webhook_com_json_que_nao_e_objeto_nao_deveria_estourar_traceback(self):
        """200 + JSON válido porém não-objeto ([1,2,3] / null): main deve tratar e devolver código != 0."""
        for rota in ("/webhook-lista", "/webhook-null"):
            with self.subTest(rota=rota):
                try:
                    codigo, _, err = rodar_main(["--url", self.base + "/index", "--webhook", self.base + rota])
                except Exception as exc:  # noqa: BLE001 - queremos registrar qualquer exceção vazando
                    self.fail(f"main() deixou vazar {type(exc).__name__}: {exc}")
                self.assertNotEqual(codigo, 0)

    def test_saida_grava_json_valido_utf8(self):
        with tempfile.TemporaryDirectory() as tmp:
            arquivo = Path(tmp) / "resposta.json"
            codigo, out, err = rodar_main(["--url", self.base + "/index", "--webhook", self.base + "/webhook",
                                           "--saida", str(arquivo)])
            self.assertEqual(codigo, 0, err)
            bruto = arquivo.read_text(encoding="utf-8")
            self.assertEqual(json.loads(bruto), RESPOSTA_N8N)
            self.assertIn("Olá", bruto, "ensure_ascii=False: acentos devem ficar legíveis no arquivo")
            self.assertIn(f"Resposta salva em {arquivo}", out)

    def test_saida_nao_e_gravada_quando_webhook_falha(self):
        with tempfile.TemporaryDirectory() as tmp:
            arquivo = Path(tmp) / "resposta.json"
            codigo, _, _ = rodar_main(["--url", self.base + "/index", "--webhook", self.base + "/webhook-500",
                                       "--saida", str(arquivo)])
            self.assertEqual(codigo, 1)
            self.assertFalse(arquivo.exists())

    def test_saida_em_diretorio_inexistente_nao_deveria_estourar_traceback(self):
        """O robô já fez o POST com sucesso; falha ao gravar o arquivo deve virar erro tratado (exit != 0)."""
        with tempfile.TemporaryDirectory() as tmp:
            arquivo = Path(tmp) / "nao_existe" / "resposta.json"
            try:
                codigo, _, err = rodar_main(["--url", self.base + "/index", "--webhook", self.base + "/webhook",
                                             "--saida", str(arquivo)])
            except OSError as exc:
                self.fail(f"main() deixou vazar {type(exc).__name__}: {exc}")
            self.assertNotEqual(codigo, 0)
            self.assertIn("[erro]", err)

    def test_dry_run_com_saida_nao_cria_arquivo(self):
        with tempfile.TemporaryDirectory() as tmp:
            arquivo = Path(tmp) / "resposta.json"
            codigo, _, _ = rodar_main(["--url", self.base + "/index", "--dry-run", "--saida", str(arquivo)])
            self.assertEqual(codigo, 0)
            self.assertFalse(arquivo.exists())

    def test_ambiente_n8n_webhook_e_url_pagina(self):
        codigo, out, err = rodar_main([], env={"URL_PAGINA": self.base + "/index",
                                                "N8N_WEBHOOK": self.base + "/webhook"})
        self.assertEqual(codigo, 0, err)
        posts = [r for r in self.servidor.requisicoes if r["metodo"] == "POST"]
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]["path"], "/webhook")
        self.assertEqual(self.servidor.requisicoes[0]["path"], "/index")

    def test_flags_tem_precedencia_sobre_ambiente(self):
        codigo, _, err = rodar_main(
            ["--url", self.base + "/index", "--webhook", self.base + "/webhook"],
            env={"URL_PAGINA": self.base + "/500", "N8N_WEBHOOK": self.base + "/webhook-500"})
        self.assertEqual(codigo, 0, err)

    def test_url_pagina_do_ambiente_sozinha_com_dry_run(self):
        codigo, out, _ = rodar_main(["--dry-run"], env={"URL_PAGINA": self.base + "/index"})
        self.assertEqual(codigo, 0)
        self.assertIn("Clientes encontrados: 10", out)

    def test_url_padrao_aponta_para_pagina_https_do_projeto(self):
        self.assertTrue(ec.URL_PAGINA_PADRAO.startswith("https://"))
        self.assertTrue(ec.URL_PAGINA_PADRAO.endswith("/"))

    def test_argumento_desconhecido_sai_com_2_do_argparse(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as ctx:
            ec.main(["--nao-existe"])
        self.assertEqual(ctx.exception.code, 2)


# --------------------------------------------------------------------------- #
# Execução como script (processo separado): garante o guard __main__,
# códigos de saída reais e ausência de saída duplicada.
# --------------------------------------------------------------------------- #
class TestScriptSubprocesso(BaseComServidor):
    def _rodar(self, args, env_extra=None):
        env = {k: v for k, v in os.environ.items() if k not in ("N8N_WEBHOOK", "URL_PAGINA")}
        env["PYTHONIOENCODING"] = "utf-8"
        env.update(env_extra or {})
        return subprocess.run([sys.executable, "-I", str(CAMINHO_MODULO), *args],
                              capture_output=True, text=True, encoding="utf-8", timeout=60, env=env)

    def test_dry_run(self):
        r = self._rodar(["--url", self.base + "/index", "--dry-run"])
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.count("Clientes encontrados: 10"), 1)
        self.assertEqual(r.stdout.count("João Pereira"), 1)

    def test_sem_webhook_exit_2(self):
        r = self._rodar(["--url", self.base + "/index"])
        self.assertEqual(r.returncode, 2)

    def test_pagina_inacessivel_exit_1(self):
        r = self._rodar(["--url", "http://127.0.0.1:1/", "--dry-run"])
        self.assertEqual(r.returncode, 1)

    def test_variaveis_de_ambiente(self):
        r = self._rodar([], {"URL_PAGINA": self.base + "/index", "N8N_WEBHOOK": self.base + "/webhook"})
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(r.stdout.count("=== Resumo ==="), 1)

    def test_help_documenta_variaveis(self):
        r = self._rodar(["--help"])
        self.assertEqual(r.returncode, 0)
        for trecho in ("--url", "--webhook", "--dry-run", "--saida", "N8N_WEBHOOK", "URL_PAGINA"):
            self.assertIn(trecho, r.stdout)

    def test_importar_o_modulo_nao_executa_o_robo(self):
        r = subprocess.run(
            [sys.executable, "-I", "-c",
             "import importlib.util as u,sys;"
             f"s=u.spec_from_file_location('m',{str(CAMINHO_MODULO)!r});m=u.module_from_spec(s);s.loader.exec_module(m);"
             "print('ok')"],
            capture_output=True, text=True, timeout=30)
        self.assertEqual(r.stdout.strip(), "ok")


# --------------------------------------------------------------------------- #
# Notebook
# --------------------------------------------------------------------------- #
class TestNotebook(BaseComServidor):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.nb = json.loads(CAMINHO_NOTEBOOK.read_text(encoding="utf-8"))
        cls.celulas_codigo = [c for c in cls.nb["cells"] if c["cell_type"] == "code"]

    @staticmethod
    def _fonte(celula):
        return "".join(celula["source"]) if isinstance(celula["source"], list) else celula["source"]

    def test_json_valido_nbformat_4(self):
        self.assertEqual(self.nb["nbformat"], 4)
        self.assertIsInstance(self.nb["nbformat_minor"], int)
        self.assertIn("metadata", self.nb)
        self.assertIsInstance(self.nb["cells"], list)
        self.assertGreater(len(self.nb["cells"]), 0)

    def test_estrutura_das_celulas_segue_o_schema_nbformat4(self):
        for i, c in enumerate(self.nb["cells"]):
            with self.subTest(celula=i):
                self.assertIn(c["cell_type"], {"markdown", "code", "raw"})
                self.assertIn("metadata", c)
                self.assertIn("source", c)
                self.assertTrue(isinstance(c["source"], (str, list)))
                if c["cell_type"] == "code":
                    self.assertIn("outputs", c)
                    self.assertIn("execution_count", c)
                    self.assertIsInstance(c["outputs"], list)

    def test_metadata_de_kernel_python(self):
        md = self.nb["metadata"]
        self.assertEqual(md["kernelspec"]["language"], "python")
        self.assertEqual(md["language_info"]["name"], "python")

    def test_nbformat_validate_se_disponivel(self):
        try:
            import nbformat
        except ImportError:
            self.skipTest("pacote nbformat não instalado")
        nbformat.validate(nbformat.reads(CAMINHO_NOTEBOOK.read_text(encoding="utf-8"), as_version=4))

    def test_todas_as_celulas_de_codigo_compilam_sem_magics(self):
        for i, c in enumerate(self.celulas_codigo):
            fonte = "\n".join(l for l in self._fonte(c).splitlines() if not l.lstrip().startswith(("!", "%")))
            with self.subTest(celula_codigo=i):
                compile(fonte, f"<celula {i}>", "exec")

    def test_notebook_nao_guarda_saidas_nem_credenciais(self):
        texto = CAMINHO_NOTEBOOK.read_text(encoding="utf-8")
        for c in self.celulas_codigo:
            self.assertEqual(c["outputs"], [])
        self.assertNotRegex(texto, r"https://[^\"\s]*\.app\.n8n\.cloud/webhook/[A-Za-z0-9-]{10,}")

    def _executar(self, webhook: str):
        """Executa as células de código, trocando a URL da página e (opcionalmente) o webhook."""
        ns = {"__name__": "__notebook__"}
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            for c in self.celulas_codigo:
                fonte = self._fonte(c)
                if fonte.lstrip().startswith("!pip"):
                    continue
                exec(compile(fonte, "<celula>", "exec"), ns)
                if "URL_PAGINA" in fonte and "N8N_WEBHOOK" in fonte:  # célula de configuração
                    ns["URL_PAGINA"] = self.base + "/index"
                    ns["N8N_WEBHOOK"] = webhook
        return ns, out.getvalue()

    def test_celulas_executam_em_modo_dry_run(self):
        ns, saida = self._executar("")
        self.assertIn("Clientes encontrados: 10", saida)
        self.assertIn("dry-run", saida)
        self.assertEqual(ns["clientes"], CLIENTES_REAIS)
        self.assertEqual([r["metodo"] for r in self.servidor.requisicoes], ["GET"])

    def test_celulas_executam_com_envio_ao_webhook(self):
        ns, saida = self._executar(self.base + "/webhook")
        self.assertEqual(ns["clientes"], CLIENTES_REAIS)
        self.assertIn("Resumo:", saida)
        self.assertIn("--- Ana Silva <ana@email.com> [Conservador] ---", saida)
        post = [r for r in self.servidor.requisicoes if r["metodo"] == "POST"][0]
        self.assertEqual(json.loads(post["corpo"]), {"clientes": CLIENTES_REAIS})
        self.assertTrue(post["content_type"].startswith("application/json"))

    def test_notebook_e_script_extraem_o_mesmo(self):
        ns, _ = self._executar("")
        self.assertEqual(ns["clientes"], ec.extrair_clientes(HTML_REAL))

    def test_notebook_webhook_com_ignorado_de_nome_nulo_nao_quebra(self):
        """Formato real do nó 'Validar clientes': {indice, nome: null, motivos: [...]}."""
        celula_envio = self._fonte(self.celulas_codigo[-1])
        dados = {"resumo": {}, "mensagens": [],
                 "ignorados": [{"indice": 1, "nome": None, "motivos": ["nome ausente", "e-mail inválido"]}]}
        resposta = mock.Mock()
        resposta.json.return_value = dados
        ns = {"N8N_WEBHOOK": "http://x", "clientes": [],
              "requests": mock.Mock(post=mock.Mock(return_value=resposta))}
        saida = io.StringIO()
        with contextlib.redirect_stdout(saida):
            exec(compile(celula_envio, "<celula-envio>", "exec"), ns)
        self.assertIn("nome ausente, e-mail inválido", saida.getvalue())


# --------------------------------------------------------------------------- #
# Segunda rodada de correções (revisão adversarial)
# --------------------------------------------------------------------------- #
class TestExtracaoRobusta(unittest.TestCase):
    LINHA = '<tr><td class="nome">{}</td><td class="email">a@a.com</td><td class="saldo">R$ 1,00</td><td class="perfil">Moderado</td></tr>'

    def nomes(self, html):
        with contextlib.redirect_stderr(io.StringIO()):
            return [c["nome"] for c in ec.extrair_clientes(html)]

    def test_linha_de_total_no_tfoot_nao_vira_cliente(self):
        html = ('<table id="clientes"><thead><tr><th>N</th></tr></thead><tbody>' + self.LINHA.format("Ana") + "</tbody>"
                '<tfoot><tr><td>Total</td><td>-</td><td>R$ 1,00</td><td>-</td></tr></tfoot></table>')
        self.assertEqual(self.nomes(html), ["Ana"])

    def test_tfoot_antes_do_tbody_tambem_e_ignorado(self):
        html = ('<table id="clientes"><tfoot><tr><td>Total</td><td>-</td><td>R$ 1,00</td><td>-</td></tr></tfoot>'
                "<tbody>" + self.LINHA.format("Ana") + "</tbody></table>")
        self.assertEqual(self.nomes(html), ["Ana"])

    def test_thead_com_td_e_ignorado(self):
        html = ('<table id="clientes"><thead><tr><td>Nome</td><td>E</td><td>S</td><td>P</td></tr></thead>'
                "<tbody>" + self.LINHA.format("Ana") + "</tbody></table>")
        self.assertEqual(self.nomes(html), ["Ana"])

    def test_tabela_aninhada_nao_contamina_a_lista(self):
        interna = '<table><tr><td>x</td><td>y</td><td>z</td><td>w</td></tr></table>'
        html = ('<table id="clientes"><tbody><tr><td class="nome">Ana' + interna + '</td><td class="email">a@a.com</td>'
                '<td class="saldo">R$ 1,00</td><td class="perfil">Moderado</td></tr></tbody></table>')
        self.assertEqual(len(self.nomes(html)), 1)

    def test_tabela_sem_tbody_e_com_wrapper_div(self):
        sem_tbody = '<table id="clientes">' + self.LINHA.format("Ana") + "</table>"
        self.assertEqual(self.nomes(sem_tbody), ["Ana"])
        wrapper = '<div id="clientes"><table>' + self.LINHA.format("Bia") + "</table></div>"
        self.assertEqual(self.nomes(wrapper), ["Bia"])

    def test_tags_inline_nao_quebram_palavras_e_br_separa(self):
        casos = [("Jo<b>ão</b>", "João"), ("José <b>D'Ávila</b>", "José D'Ávila"),
                 ("Maria<br>Silva", "Maria Silva"), ("  Ana \n  Lima  ", "Ana Lima"), ("<span>R</span>ui", "Rui")]
        for html_nome, esperado in casos:
            self.assertEqual(self.nomes('<table id="clientes">' + self.LINHA.format(html_nome) + "</table>"), [esperado], html_nome)

    def test_saldo_com_marcacao_inline_continua_inteiro(self):
        html = ('<table id="clientes"><tr><td class="nome">A</td><td class="email">a@a.com</td>'
                '<td class="saldo">R$ <span>1.000</span>,00</td><td class="perfil">Moderado</td></tr></table>')
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(ec.extrair_clientes(html)[0]["saldo"], "R$ 1.000,00")


class TestRespostasAnormais(BaseComServidor):
    def test_422_mostra_motivos_dos_clientes_ignorados(self):
        codigo, _, err = rodar_main(["--url", self.base + "/index", "--webhook", self.base + "/webhook-422-ignorados"])
        self.assertEqual(codigo, 1)
        self.assertNotIn("Traceback", err)
        for trecho in ("Nenhum cliente válido", "Zé: e-mail inválido, saldo inválido", "(sem nome): nome ausente"):
            self.assertIn(trecho, err)

    def test_502_mostra_erro_e_detalhe_do_workflow(self):
        codigo, _, err = rodar_main(["--url", self.base + "/index", "--webhook", self.base + "/webhook-502"])
        self.assertEqual(codigo, 1)
        self.assertIn("502", err)
        self.assertIn("Não foi possível carregar a base de produtos", err)
        self.assertIn("connect ECONNREFUSED", err)

    def test_enviar_mantem_httperror_com_response_anexada(self):
        with self.assertRaises(requests.HTTPError) as ctx:
            ec.enviar_para_n8n([{"nome": "A"}], self.base + "/webhook-502")
        self.assertEqual(ctx.exception.response.status_code, 502)

    def test_resposta_json_com_tipos_errados_nao_gera_traceback(self):
        codigo, out, err = rodar_main(["--url", self.base + "/index", "--webhook", self.base + "/webhook-malformado"])
        self.assertEqual(codigo, 0, err)
        self.assertNotIn("Traceback", err)
        self.assertIn("so nome", out)

    def test_mostrar_resposta_tolera_formas_inesperadas(self):
        formas = [{}, {"resumo": None}, {"resumo": []}, {"mensagens": None}, {"mensagens": "x"}, {"mensagens": [None, 1, "a", []]},
                  {"ignorados": [{"motivos": "texto"}, {"nome": 5, "motivos": [1, None]}, None]}, {"resumo": {"a": {"b": 1}}}]
        for forma in formas:
            with contextlib.redirect_stdout(io.StringIO()):
                ec.mostrar_resposta(forma)  # não pode levantar

    def test_dry_run_com_saida_avisa_em_stderr_e_nao_grava(self):
        with tempfile.TemporaryDirectory() as pasta:
            alvo = os.path.join(pasta, "resposta.json")
            codigo, _, err = rodar_main(["--url", self.base + "/index", "--dry-run", "--saida", alvo])
            self.assertEqual(codigo, 0)
            self.assertIn("--saida é ignorado em --dry-run", err)
            self.assertFalse(os.path.exists(alvo))


class TestNotebookParidade(unittest.TestCase):
    def celulas(self):
        nb = json.loads(CAMINHO_NOTEBOOK.read_text(encoding="utf-8"))
        return ["".join(c["source"]) for c in nb["cells"] if c["cell_type"] == "code" and not "".join(c["source"]).startswith("!")]

    def extrair_com_notebook(self, html):
        """Roda a célula de extração do notebook contra um HTML (requests.get simulado)."""
        celula = next(c for c in self.celulas() if "# 1) Baixar a página" in c)
        resposta = mock.Mock(text=html)
        ns = {"URL_PAGINA": "http://x", "requests": mock.Mock(get=mock.Mock(return_value=resposta))}
        with contextlib.redirect_stdout(io.StringIO()):
            exec(compile(celula.replace("import requests\n", ""), "<celula>", "exec"), ns)
        return ns["clientes"]

    def test_notebook_e_script_extraem_o_mesmo_nos_casos_de_borda(self):
        linha = '<tr><td class="nome">{}</td><td class="email">a@a.com</td><td class="saldo">R$ 1,00</td><td class="perfil">Moderado</td></tr>'
        casos = {
            "real": HTML_REAL,
            "tfoot": '<table id="clientes"><tbody>' + linha.format("Ana") + '</tbody><tfoot><tr><td>T</td><td>-</td><td>R$ 1</td><td>-</td></tr></tfoot></table>',
            "sem_tbody": '<table id="clientes">' + linha.format("Ana") + "</table>",
            "inline": '<table id="clientes">' + linha.format("Jo<b>ão</b>") + "</table>",
            "br": '<table id="clientes">' + linha.format("Maria<br>Silva") + "</table>",
            "sem_classes": '<table id="clientes"><tr><td>Ana</td><td>a@a.com</td><td>R$ 1,00</td><td>Moderado</td></tr></table>',
        }
        for nome, html in casos.items():
            with contextlib.redirect_stderr(io.StringIO()):
                esperado = ec.extrair_clientes(html)
            self.assertEqual(self.extrair_com_notebook(html), esperado, nome)


if __name__ == "__main__":
    unittest.main(verbosity=2)
