# Kit de Limpeza e Otimização do Disco C:

Recupera espaço no disco **C:** do Windows 10/11 com segurança: remove o que é descartável
automaticamente e mostra, com dados, o que ainda ocupa espaço para você decidir.

| Situação atual | Meta recomendada |
|---|---|
| ~5 GB livres de ~111 GB (≈ 4,5%) | **≥ 20 GB livres (≈ 18%)**, folga mínima para o Windows atualizar e funcionar bem |

---

## 1. Como usar (5 minutos de atenção, o resto é automático)

1. **Baixe a pasta `limpeza-disco-C`** para o PC (GitHub → branch `claude/exciting-franklin-k6ugdb` → *Code* → *Download ZIP*).
2. **Extraia o ZIP** (botão direito → *Extrair tudo*). Não execute de dentro do ZIP.
3. **Feche navegadores e programas** e salve seus trabalhos.
4. Dê dois cliques em **`1-SIMULAR-SEM-APAGAR.bat`**: só faz o diagnóstico, **nada é apagado**.
   Confira o relatório que aparece na tela (e fica salvo na Área de Trabalho).
5. Dê dois cliques em **`2-EXECUTAR-LIMPEZA.bat`** e responda às perguntas:
   - Fase 2: responda **S** para limpar todos os itens seguros de uma vez.
   - Fase 3: cada otimização explica o impacto; decida item a item (recomendações abaixo).
6. **Reinicie o computador** ao final.

> **Aviso do Windows "O Windows protegeu o computador"?** Clique em *Mais informações* → *Executar assim mesmo*.
> Isso acontece com qualquer script baixado da internet. Alternativa: botão direito no ZIP → *Propriedades* → marque *Desbloquear* → *OK*, e só então extraia.

---

## 2. O que o script faz, fase a fase

| Fase | O que acontece | Apaga algo? |
|---|---|---|
| **1. Diagnóstico** | Mede cada categoria descartável e os grandes itens de sistema | Não |
| **2. Limpeza segura** | Remove temporários, caches e restos de atualização (lista abaixo) | Sim, só descartáveis |
| **3. Otimizações** | Hibernação, Windows.old, pontos de restauração, compactação, manutenção automática | Só com sua confirmação |
| **4. Mapa do disco** | Ranking de pastas, arquivos ≥ 500 MB, programas por tamanho, consumidores conhecidos | Não |
| **Resumo** | Espaço antes/depois, ganho por etapa, próximos passos | Não |

### 2.1 Limpeza segura (Fase 2)

| Item | O que remove | Por que é seguro |
|---|---|---|
| Temporários do usuário e do Windows | Pastas `TEMP` (preserva as últimas 24 h) | Arquivos de uso pontual de instaladores/programas |
| Cache do Windows Update | Atualizações já baixadas | O Windows baixa de novo se precisar |
| Otimização de Entrega | Cópias de atualizações compartilhadas | Comando oficial da Microsoft |
| Despejos de memória e relatórios de erro | Arquivos `.dmp` e relatórios de falhas antigas | Usados só para diagnóstico de falhas passadas |
| Logs de manutenção (CbsPersist) | Logs antigos que podem acumular GBs | Não são usados pelo sistema |
| Cache de shaders (NVIDIA/AMD/DirectX) | Shaders compilados | Recriados automaticamente |
| Instaladores de driver extraídos | `C:\AMD`, `C:\NVIDIA`, downloads do GeForce | Sobras de instalação |
| Cache de navegadores (Chrome, Edge, Brave, Opera, Firefox) | **Somente cache** | Senhas, favoritos, histórico e login são mantidos |
| Cache de apps (Discord, Teams, Slack, VS Code) | **Somente cache** | Conversas, login e configurações são mantidos |
| Lixeira | Itens já excluídos | Você já havia descartado |
| Limpeza de Disco do Windows | Restos de atualização, miniaturas, logs, drivers antigos | Ferramenta oficial (`cleanmgr`) com lista controlada |
| Componentes antigos (WinSxS) | Versões substituídas de atualizações | Comando oficial (`DISM /StartComponentCleanup`) |

### 2.2 Otimizações opcionais (Fase 3): matriz de decisão

| Otimização | Ganho típico | Contrapartida | Recomendação | Como reverter |
|---|---|---|---|---|
| **Hibernação: desativar** | ~40% da RAM (8 GB de RAM ≈ 3,2 GB) | Desliga a Inicialização Rápida | Desktop: **Sim** | `powercfg /hibernate on` |
| **Hibernação: reduzir** | ~metade do anterior | Some a opção "Hibernar" | Notebook: **Sim** | `powercfg /hibernate /type full` |
| **Remover Windows.old** | 10–30 GB (se existir) | Não dá mais para voltar à versão anterior do Windows | **Sim**, se o Windows está estável | Não reversível |
| **Limitar Restauração do Sistema a 5%** | Varia (0–10 GB) | Pontos de restauração mais antigos são apagados | **Sim** | Configurações → Proteção do Sistema |
| **DISM /ResetBase** | 0,5–3 GB | Atualizações já instaladas não podem ser desinstaladas | Sim, se não houver problemas com atualizações recentes | Não reversível |
| **CompactOS** (compactar o Windows) | 2–4 GB | Uso mínimo de CPU ao ler arquivos do sistema | **Sim** em disco pequeno | `compact /CompactOS:never` |
| **Sensor de Armazenamento** | Mantém o ganho ao longo do tempo | Nenhuma (não toca na pasta Downloads) | **Sim** | Configurações → Armazenamento |

> As faixas de ganho são típicas e variam por computador. O script mede e mostra o ganho **real** de cada etapa.

### 2.3 O que o script NUNCA apaga

- Documentos, Imagens, Vídeos, Músicas, Área de Trabalho, **Downloads** e OneDrive.
- Programas instalados (só lista; a desinstalação é decisão sua).
- Senhas, favoritos, histórico e logins de navegadores e aplicativos.
- `pagefile.sys` (memória virtual: necessária para a estabilidade).
- `C:\Windows\Installer`, `WinSxS` "na mão" ou qualquer arquivo de sistema fora das ferramentas oficiais.
- Itens da Limpeza de Disco que apagariam dados: *Downloads*, *Histórico de Arquivos*, *arquivos de reinstalação do Windows (ESD)* e *pacotes de idioma* ficam de fora.

Proteções adicionais embutidas: não segue atalhos de pasta (junções), recusa esvaziar pastas críticas
(C:\, Windows, Usuários, Program Files, Documentos, Área de Trabalho), ignora arquivos em uso e pula
itens de atualização quando há reinicialização pendente.

---

## 3. Depois do script: checklist manual (onde costuma estar o grande volume)

Use o **mapa da Fase 4** (também no relatório da Área de Trabalho) para atacar os maiores itens primeiro (princípio de Pareto: poucos itens costumam concentrar a maior parte do espaço).

| # | Ação | Onde | Ganho potencial |
|---|---|---|---|
| 1 | Desinstalar programas e jogos que não usa | Configurações → Aplicativos → Aplicativos instalados → ordenar por **Tamanho** (lista 4.6 do relatório) | Alto |
| 2 | Apagar instaladores e ZIPs já usados | Pasta Downloads (lista 4.5) | Médio a alto |
| 3 | Revisar arquivos ≥ 500 MB | Lista 4.4: cada arquivo vem com uma sugestão do que fazer | Alto |
| 4 | Liberar o OneDrive local | Botão direito na pasta OneDrive → **Liberar espaço** (arquivos ficam só na nuvem) | Alto, se usa OneDrive |
| 5 | Mover fotos e vídeos | HD externo, pen drive ou nuvem (Google Drive/OneDrive) | Alto |
| 6 | Limpar mídias do WhatsApp Desktop | WhatsApp → Configurações → Armazenamento | Médio |
| 7 | Remover backups antigos de iPhone | iTunes / app Dispositivos Apple | Muito alto, se existir |

**Regra de ouro:** nunca apague manualmente arquivos dentro de `C:\Windows`, `C:\Program Files` ou `C:\ProgramData`. Desinstale pelo Windows.

---

## 4. Manutenção contínua (para o problema não voltar)

| Indicador | Meta | Frequência de verificação |
|---|---|---|
| Espaço livre no C: | ≥ 20 GB (≈ 18%) | Mensal |
| Pasta Downloads | Sem instaladores/ZIPs já usados | Mensal |
| Programas instalados | Só os que você usa | Trimestral |

- Deixe o **Sensor de Armazenamento** ativo (Fase 3 do script).
- Rode o `2-EXECUTAR-LIMPEZA.bat` a cada 2 ou 3 meses.
- Se o espaço continuar crítico mesmo após o checklist, a solução estrutural é **hardware**: um SSD maior
  (ou um segundo disco/HD externo para arquivos pessoais e jogos).

---

## 5. Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| A janela abre e fecha | Executou de dentro do ZIP | Extraia o ZIP antes |
| "Execução de scripts foi desabilitada" | Política do PowerShell | Use os arquivos `.bat` (já contornam isso só para este script) |
| Antivírus bloqueou | Script baixado da internet | Libere o arquivo ou use *Desbloquear* nas Propriedades do ZIP |
| Item "Ignorado: programa aberto" | Navegador/app em uso | Feche o programa e rode de novo |
| Itens "Pulado: reinicialização pendente" | Atualização aguardando reinício | Reinicie e rode de novo |
| A Limpeza de Disco demora | Restos de atualização sendo processados | Normal: pode levar até 30 minutos |
| Conta sem administrador | O script pediu a senha de outro usuário | A limpeza de temporários vale para o usuário administrador; rode logado em uma conta administradora |

---

## Arquivos do kit

| Arquivo | Função |
|---|---|
| `1-SIMULAR-SEM-APAGAR.bat` | Diagnóstico completo, sem apagar nada |
| `2-EXECUTAR-LIMPEZA.bat` | Limpeza com confirmações |
| `Limpar-DiscoC.ps1` | Script principal (PowerShell 5.1, nativo do Windows 10/11) |

Uso avançado (PowerShell como administrador):
`.\Limpar-DiscoC.ps1 -Simular` (só diagnóstico) ou `.\Limpar-DiscoC.ps1 -Automatico` (Fase 2 sem perguntas).
