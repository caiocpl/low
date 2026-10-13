# Layout "Deck" do Claude Code no cmd (Windows)

Aplica ao Claude Code, quando usado no **cmd do Windows**, o painel abaixo como *status line*:

```
▾ Deck  Model  [✧ haiku]  [✱ sonnet]  [✦ opus]     ← modelo ativo destacado em laranja
Effort ▮▮▯▯▯ medium
No tasks running
```

| Linha | Origem da informação |
|---|---|
| Model | Modelo da sessão (enviado pelo Claude Code ao script) |
| Effort | Nível de esforço: dado da sessão → `modelSettings.<modelo>.effortLevel` ou `effortLevel` no `settings.json` → variável `CLAUDE_CODE_EFFORT_LEVEL` → `medium` |
| Tasks | Texto fixo: a status line não tem acesso às tarefas em segundo plano |

Escala da barra de esforço: `low` ▮▯▯▯▯ · `medium` ▮▮▯▯▯ · `high` ▮▮▮▯▯ · `xhigh` ▮▮▮▮▯ · `max` ▮▮▮▮▮

---

## 1. Como instalar (2 minutos)

1. **Baixe a pasta `layout-claude-cmd`** (GitHub → branch `claude/project-thread-k0dqr5` → *Code* → *Download ZIP*) e extraia.
2. Dê dois cliques em **`TESTAR.bat`**: deve aparecer o painel com **opus** destacado. Se aparecer, o script funciona no seu PC.
3. Dê dois cliques em **`INSTALAR.bat`**. Ele:
   - copia `statusline.ps1` para `%USERPROFILE%\.claude\`;
   - faz **backup** do `settings.json` (`settings.json.bak-AAAAMMDD-HHMMSS`);
   - acrescenta apenas o bloco `statusLine`, sem alterar o resto.
4. **Feche e abra o Claude Code** no cmd (`claude`). O painel aparece abaixo da caixa de prompt.

> **Aviso "O Windows protegeu o computador"?** Clique em *Mais informações* → *Executar assim mesmo*,
> ou desbloqueie o ZIP antes de extrair (botão direito → *Propriedades* → *Desbloquear*).

## 2. Configuração aplicada

Trecho gravado em `%USERPROFILE%\.claude\settings.json` (caminho absoluto com `/`, válido no cmd e no Git Bash):

```json
"statusLine": {
  "type": "command",
  "command": "powershell -NoProfile -ExecutionPolicy Bypass -File \"C:/Users/<seu-usuario>/.claude/statusline.ps1\"",
  "padding": 0
}
```

## 3. Diagnóstico rápido

| Sintoma | Causa provável | Ação |
|---|---|---|
| Painel não aparece | Claude Code aberto antes da instalação | Feche e abra o `claude` de novo |
| Símbolos viram `?` ou quadrados | Fonte do console sem esses caracteres | Use *Cascadia Mono* (Propriedades do cmd → Fonte) ou o Windows Terminal |
| Aparecem códigos como `[1;30;48;5;214m` | Console antigo sem suporte a cores ANSI | Use o Windows Terminal ou o Windows 10/11 atualizado |
| Instalador diz "JSON inválido" | `settings.json` com erro de sintaxe | Corrija o arquivo ou adicione o bloco da seção 2 manualmente |
| Effort sempre `medium` | Esforço não informado pela sessão nem no `settings.json` | Defina `"effortLevel": "high"` (por exemplo) no `settings.json` |

## 4. Como desfazer

Apague o bloco `statusLine` do `settings.json` (ou restaure o backup `.bak-…`) e reabra o Claude Code.
