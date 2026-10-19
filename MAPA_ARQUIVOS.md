# 🗺️ Mapa Completo de Arquivos e Funções do Projeto

Este documento detalha **todos os arquivos principais** que compõem o sistema de pesquisa e inteligência em Big Data (34.2M+ de registros), mapeando a função de cada arquivo, seus objetivos técnicos e a correlação com a arquitetura do projeto.

> [!CAUTION]
> **AVISO DE SANITIZAÇÃO & CASO DE ESTUDO REAL:** Este projeto é um estudo de caso derivado de um servidor em VPS configurado para um cliente privado (taxa horária de **$20/h**, total faturado de **$1.250 USD**). Todas as configurações em produção já foram atualizadas e todos os dados sensíveis, credenciais reais, portas, IPs e chaves de API foram completamente removidos ou mockados.

---

## 1. ⚙️ Data Engine & Pipeline de Auto-Cura (`data_engine/`)

O diretório `data_engine/` abriga o motor de normalização, higienização e classificação onomástica dos dados brutos legados.

| Arquivo | Função Técnica | Decisão de Design / Impacto |
|---|---|---|
| `clean_reference_tables.py` | Higienização e purga de anomalias em tabelas de referência (`comuni`, `onomastic_mapping`). | Elimina números de telefone, endereços de rua ("Via", "Corso") e códigos fiscais acidentalmente importados em colunas geográficas, preservando municípios válidos que contêm substrings similares (ex: Pavia, Piazza Armerina). |
| `comune_standardizer.py` | Padronizador fonético e semântico de municípios e localidades. | Utiliza expressões regulares avançadas e `difflib.get_close_matches` para converter nomes grafados incorretamente em suas formas canônicas ISTAT, limpando sufixos de províncias e prefixos espúrios. |
| `expand_provinces_db.py` | Expansão e normalização de siglas e nomes por extenso de províncias. | Garante que pesquisas por siglas (ex: "RM") ou nomes completos ("ROMA") encontrem registros uniformemente em bases onde províncias foram armazenadas em formatos divergentes. |
| `onomastic_classifier.py` | Classificador de origem étnica e demográfica baseado em sobrenomes. | Dicionários internacionais abrangentes (Árabe, Chinês, Eslavo, Germânico, Hispânico, Luso-Brasileiro) e heurísticas fonéticas para segmentação demográfica em conformidade analítica. |
| `populate_surname_mapping.py` | Gerador e indexador da tabela de busca rápida `surname_onomastic_mapping`. | Cria índices de alta velocidade para permitir que consultas demográficas identifiquem a origem étnica de milhões de pessoas sem sobrecarregar a CPU em tempo de pesquisa. |
| `normalize_database.py` | Script mestre de normalização e cura de dados em lote no banco. | Itera sobre todas as tabelas principais, aplicando as tabelas de mapeamento canônico diretamente via comandos SQL em lote, corrigindo anomalias de caracteres e inconsistências geográficas. |
| `create_indexes.sql` | Criação de índices concorrentes B-Tree (`CREATE INDEX CONCURRENTLY`). | Constrói índices em colunas de alta frequência (província, município, CEP, ano de nascimento, categoria) sem travar a escrita ou leitura da base de 34.2M registros em produção. |
| `run_pipeline.sh` | Orquestrador bash do pipeline de cura de dados. | Executa os estágios de limpeza, padronização, expansão e indexação na ordem correta, validando pré-requisitos do ambiente Python e drivers `asyncpg`. |

---

## 2. 🚀 Backend API (`backend/`)

Construído com **FastAPI** e **AsyncPG**, focado em I/O não-bloqueante e alta concorrência.

| Arquivo | Função Técnica | Decisão de Design / Impacto |
|---|---|---|
| `main.py` | Aplicação principal FastAPI, endpoints REST, Server-Sent Events e gerador de queries. | - **Connection Pool Assíncrono**: `asyncpg.create_pool(min_size=5, max_size=25)` para suportar centenas de requisições concorrentes.<br>- **Compilador Dinâmico de Queries (`build_query`)**: Converte filtros complexos da UI em SQL parametrizado nativo com projeções canônicas unificadas.<br>- **Trava Anti-Exaustão de Paginação**: Bloqueia visualizações online acima de 5.000 registros (`page * pageSize > 5000`), direcionando volumes massivos para o motor de exportação.<br>- **Motor de Exportação em Streaming (`run_export_background`)**: Cursors com `prefetch=20000` gravam arquivos XLSX e CSV em modo de memória constante sem sobrecarregar a memória RAM da VPS.<br>- **GDPR Blacklist**: Filtro com checagem rigorosa (exato) e fuzzy (similaridade de sufixo e domínio).<br>- **Proxy de IA Seguro**: Endpoint `/api/ai-chat` para consultas assistidas por LLM mantendo as chaves de API restritas ao lado do servidor. |
| `requirements.txt` | Lista de dependências Python. | Especifica `fastapi`, `uvicorn`, `asyncpg`, `pydantic`, `xlsxwriter` e `httpx`. |
| `.env.example` | Template de configuração de variáveis de ambiente. | Fornece placeholders seguros para string de conexão com o PostgreSQL, diretório de exports e chaves de IA. |
| `create_indexes.sql` | Cópia sincronizada dos índices para manutenção e deploy. | Permite aplicar otimizações em novos nós de banco de dados. |

---

## 3. 🖥️ Frontend Moderno (`frontend/`)

Interface moderna desenvolvida em **React 19**, **TanStack Start**, **Vite** e **Tailwind CSS**.

### Rotas e Estrutura Principal (`src/routes/` & `src/`)
| Arquivo | Função Técnica |
|---|---|
| `src/routes/__root.tsx` | Layout raiz da aplicação, incluindo ThemeProvider, AuthProvider, TopBar, rodapé e tratamento global de erros (404/500). |
| `src/routes/index.tsx` | Dashboard central de pesquisa de Big Data. Integra barra de busca, filtros demográficos, geográficos, canais de contato, tabela de resultados virtualizada e atalho de cópia de filtros para clientes. |
| `src/routes/export.tsx` | Interface dedicada para gerenciamento e download de exportações massivas geradas em segundo plano. |
| `src/router.tsx` | Configuração do roteador TanStack Router com suporte a carregamento sob demanda. |
| `src/styles.css` | Estilos globais Tailwind CSS, incluindo classes de glassmorphism, temas escuro/claro e animações de status. |

### Componentes de Filtro e Busca (`src/components/filters/`)
| Arquivo | Função Técnica |
|---|---|
| `GeoFilters.tsx` | Seletor geográfico hierárquico (Macrorregião, Região, Província, Município e CEP) com autocompleção e busca otimizada. |
| `FiscalFilters.tsx` | Filtros por identificadores fiscais (CPF/CNPJ/Partita IVA), faixa etária (idade mínima e máxima convertida em ano) e gênero. |
| `ContactFilters.tsx` | Filtro por canais de comunicação (exigência de telefone fixo, celular verificado ou e-mail com consentimento). |
| `ContactSuppressionUpload.tsx` | Módulo de Anti-Duplicidade. Permite upload de listas CSV/TXT contendo contatos prévios do cliente para exclusão em tempo real da consulta via tabelas temporárias. |
| `SearchBox.tsx` | Campo de pesquisa textual livre com alternância entre busca exata e busca fonética/fuzzy. |
| `TableSelector.tsx` | Seletor das coleções de dados disponíveis (Pessoas Físicas, Empresas, Regiões Específicas). |

### Componentes de Resultados e Exportação (`src/components/`)
| Arquivo | Função Técnica |
|---|---|
| `results/ResultsTable.tsx` | Tabela de resultados de alta performance com paginação rápida, formatação de dados sensíveis e limpeza de anomalias visuais. |
| `export/ExportPanel.tsx` | Painel de configuração de extração em lote (seleção de formato: XLSX, CSV, ZIP, XLSX Dividido por abas/arquivos). |
| `export/ExportProgressModal.tsx` | Modal de progresso em tempo real conectado via Server-Sent Events (SSE), exibindo contagem de linhas processadas, taxa de transferência (linhas/segundo) e botão de download seguro. |
| `blacklist/BlacklistManagerModal.tsx` | Módulo de governança GDPR. Permite consulta, inserção com detecção de duplicidades/similaridades e remoção de telefones e e-mails bloqueados. |
| `auth/AuthScreen.tsx` | Tela de login segura com design dark/glassmorphism, suporte bilíngue (Português/Italiano) e integração com Firebase Auth. |
| `layout/TopBar.tsx` | Barra superior com controle de sessão, alternador de temas visuais, indicador de status do sistema e atalho para o modal de Blacklist. |
| `layout/GlassCard.tsx` | Contêiner de interface com efeito de desfoque de fundo (backdrop-blur) e bordas luminescentes. |

### Camada de Serviços e Utilitários (`src/lib/` & `src/context/`)
| Arquivo | Função Técnica |
|---|---|
| `lib/api-client.ts` | Cliente HTTP tipado com injeção automática de token JWT do Firebase, tratamento de erros e construtores de URL para SSE e downloads. |
| `lib/api-types.ts` | Definições de tipos TypeScript para filtros, modelos de resposta, status de jobs e metadados de tabelas. |
| `lib/firebase.ts` | Inicialização modular do Firebase Auth consumindo variáveis de ambiente (`VITE_FIREBASE_*`). |
| `context/AuthContext.tsx` | Provedor de contexto de autenticação com timeout automático por inatividade (30 minutos) e sincronização de eventos de mouse/teclado. |
| `hooks/useSSE.ts` | Hook customizado React para consumo reativo de streams Server-Sent Events da API de exportação. |

---

## 4. 🛡️ Segurança e Infraestrutura (`security_and_infra/`)

Configurações que garantem a blindagem da VPS e conformidade operacional.

| Arquivo | Função Técnica |
|---|---|
| `nginx_security.conf` | Configuração de borda Nginx: bloqueio Camada 7 por User-Agent (bloqueia Scrapy, Python-Requests, Curl, GPTBot, ClaudeBot), limitação de taxa (`limit_req 5r/s burst=15 nodelay`), cabeçalhos `X-Robots-Tag: noindex`, terminação SSL e proxy reverso para backend e SSR. |
| `cofre_credenciais.py` | Utilitário CLI de criptografia autenticada. Utiliza PBKDF2 HMAC-SHA256 (480.000 iterações) e cifra AES-256 Fernet para criptografia e descriptografia segura de arquivos de configuração em disco. |
| `fastapi.service` | Unidade de serviço systemd para gerenciamento do ciclo de vida da API Python (auto-restart, limites de descritores de arquivos e execução sob usuário sem privilégios). |

---

## 🔒 Relatório de Sanitização e Conformidade
Todos os arquivos deste diretório foram integralmente auditados:
1. **Nenhum IP de produção** está presente.
2. **Nenhuma senha real de banco de dados** está presente (substituídas por placeholders configuráveis).
3. **Nenhum nome de banco de dados legado** está presente (convertido para `bigdata_db`).
4. **Nenhum e-mail ou nome pessoal/empresarial original** foi mantido (convertidos para identificadores genéricos de portfólio).
5. **Nenhuma chave privada de API ou Firebase** está exposta.
