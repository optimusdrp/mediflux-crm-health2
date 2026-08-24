<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# MediFlux CRM Health

CRM para clínicas de saúde — Next.js 15 + React 19, com Firebase/Firestore
para autenticação e persistência, e um store em memória (`lib/db/store.ts`)
para o restante dos dados de operação (pacientes, chat, jornadas, etc.).

## Rodando localmente

**Pré-requisitos:** Node.js.

1. Instalar dependências:
   ```bash
   npm install
   ```

2. Copiar `.env.example` para `.env` e preencher as variáveis:
   ```bash
   cp .env.example .env
   ```

   | Variável | Obrigatória? | Para que serve |
   |---|---|---|
   | `GEMINI_API_KEY` | Sim, para as funcionalidades de IA | Chave da API do Gemini, usada pelo roteador de triagem clínica, classificação e qualificação de lead. |
   | `JWT_SECRET` | **Sim, sempre** | Chave de assinatura dos tokens de sessão (`lib/security/jwt.ts`). O servidor recusa iniciar — inclusive `npm run build` — sem essa variável definida. Gere um valor aleatório longo e único por ambiente; nunca reaproveite o mesmo valor entre desenvolvimento e produção. |
   | `APP_URL` | Recomendado | URL onde a aplicação está hospedada — usada para links próprios e callbacks. Em desenvolvimento local, `http://localhost:3000` é suficiente. |
   | `WHATSAPP_WEBHOOK_SECRET` | Sim, para o webhook de WhatsApp | Valida a origem de requisições recebidas em `app/api/chat/webhook-wpp` (assinatura HMAC formato Meta, ou segredo compartilhado para bridges customizadas). |
   | `FIREBASE_SERVICE_ACCOUNT_KEY` | Recomendado | Credencial do Firebase Admin SDK — habilita a proteção reforçada das `firestore.rules` via Custom Tokens. Sem ela, o login continua funcionando normalmente, só essa camada extra fica indisponível. |
   | `PUPPETEER_EXECUTABLE_PATH` | Opcional | Caminho de um Chrome/Chromium já instalado no sistema, para a conexão real de WhatsApp — ver seção "Conexão real com WhatsApp" abaixo. |

3. Rodar o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Build de produção

```bash
npm run build
npm start
```

`JWT_SECRET` precisa estar definido no ambiente também durante o `build`
(não só em runtime) — o Next.js executa as rotas de API durante a etapa
de "Collecting page data" para determinar quais são estáticas ou
dinâmicas, e isso importa o módulo de autenticação. Sem a variável, o
build falha de propósito (a mesma validação que protege o runtime),
então garanta que ela esteja disponível no ambiente onde o build roda
(pipeline de CI/CD, ou o próprio `.env` local).

### Erro conhecido e já corrigido: `ERR_REQUIRE_ESM`

Versões anteriores deste projeto podiam apresentar este erro ao acessar
qualquer rota que use o Firebase Admin SDK (login, cadastro de trial,
`/api/auth/me`):

```
[Error: require() of ES Module .../node_modules/jose/dist/webapi/index.js
from .../node_modules/jwks-rsa/src/utils.js not supported.]
```

**Causa raiz:** `firebase-admin/auth` importa internamente `jwks-rsa`
(usado só para validar tokens via JWKS, uma funcionalidade que este
projeto não usa — `lib/security/firebaseAdmin.ts` só *gera* Custom
Tokens, nunca valida tokens externos). `jwks-rsa` faz `require('jose')`
de forma síncrona, mas a versão 6 do `jose` é publicada como ESM puro,
sem nenhum fallback CommonJS — o que é estruturalmente incompatível com
esse `require()`, por design da própria linguagem, independente de
qualquer configuração do Next.js. Isso é uma limitação real do
`jwks-rsa`/`firebase-admin`, não um bug deste projeto.

**Uma armadilha adicional que já foi corrigida:** `jwks-rsa` declara no
seu próprio `package.json` uma exigência de `"jose": "^6.1.3"` — ou
seja, ele *recusa* aceitar a v5. Simplesmente rodar `npm install
jose@^5` no projeto não é suficiente: o npm detecta esse conflito de
versão e instala uma **segunda cópia aninhada** da v6 dentro de
`node_modules/jwks-rsa/node_modules/jose`, só para satisfazer essa
exigência — enquanto o resto do projeto usa a v5 compartilhada na
raiz. Dependendo de detalhes de como cada máquina resolve a árvore de
módulos, é essa cópia aninhada (não a da raiz) que acaba sendo
carregada, trazendo o erro de volta mesmo com a "correção" aplicada.

**Correção definitiva:** o `package.json` deste projeto já declara um
campo `"overrides"` forçando `jose` para a v5 em **toda** a árvore de
dependências, inclusive dentro de `jwks-rsa` — isso elimina a
possibilidade de existir qualquer cópia aninhada da v6:

```json
"overrides": {
  "jose": "^5.10.0"
}
```

Se este erro aparecer mesmo assim, confirme que não existe nenhuma
cópia aninhada de `jose` na v6 em nenhum lugar do `node_modules`:

```bash
# não deve retornar nada
find node_modules -path "*/node_modules/jose" -type d
```

Se retornar algo, apague `node_modules` e `package-lock.json` por
completo e rode `npm install` de novo — o `package-lock.json` guarda a
resolução de dependências já calculada, então uma instalação anterior
(de antes do `overrides` existir) pode continuar sendo reaproveitada
até que o lockfile seja recriado do zero.

## Conexão real com WhatsApp

Em Configurações → Canais & Omnichannel API, o painel **"Conexão real
com WhatsApp"** (com o selo "Sessão de verdade") conecta ao WhatsApp
real da clínica via [`whatsapp-web.js`](https://wwebjs.dev/) — separado
do painel de demonstração logo abaixo, que é uma simulação sem sessão
real nenhuma.

**Como testar localmente:**

```bash
npm install                       # não baixa o Chromium (ver nota abaixo)
npm run whatsapp:install-browser  # baixa o Chromium usado pela conexão de WhatsApp
npm run dev
```

O segundo passo só é necessário uma vez. Sem ele, tudo o resto do
sistema funciona normalmente — só a conexão de WhatsApp falha ao clicar
em "Conectar", com uma mensagem de erro clara em vez de travar o
servidor.

**Por que o `npm install` não baixa o Chromium automaticamente:** este
projeto usa `ignore-scripts=true` no `.npmrc` — o `postinstall` do
Puppeteer carrega uma cadeia de dependências transitivas só para
checar se deve pular o próprio download, e essa cadeia pode ficar
incompleta em ambientes com qualquer instabilidade de instalação
(Windows com antivírus, OneDrive sincronizando a pasta do projeto),
quebrando o `npm install` inteiro com um erro sem relação nenhuma com o
código do projeto. Rodar a instalação do navegador como um passo
explícito evita essa classe de falha.

**Sincronização do histórico de conversas:** ao conectar, antes de
ficar disponível para uso (`status: "connected"`), a sessão passa por
`status: "syncing_history"` — varre todos os contatos com mensagens não
lidas (ignorando grupos) e importa o histórico recente de cada um para
a Caixa de Entrada de Atendimentos, não só as mensagens que chegarem
dali em diante. Ver `lib/whatsapp/messageSync.ts`,
`syncHistoricalUnreadChats()`.

**Arquitetura:** diferente das rotas de API (sem estado), uma conexão
de WhatsApp é um processo de longa duração — um Chromium headless por
clínica conectada, mantido em memória do processo Node.js que hospeda o
servidor Next.js. A autenticação da sessão fica salva em disco
(`.wwebjs_auth/`, nunca no Firestore nem versionado — equivale à senha
do WhatsApp real da clínica). Rota:
`app/api/settings/whatsapp-connection` (GET consulta status, POST
inicia conexão, DELETE desconecta), protegida pela mesma permissão de
acesso à tela de Configurações.

A tela de Atendimentos detecta contatos e mensagens sincronizados via
polling (a cada 5s a lista de pacientes, a cada 3s o chat da conversa
aberta) — como a sincronização grava diretamente no store em memória
pelo processo do WhatsApp, fora do ciclo normal de requisição de um
usuário, a interface precisa perguntar de novo periodicamente para
saber que algo novo chegou.

### Enviando mensagens de volta ao paciente

Responder pela tela de Atendimentos (canal WhatsApp, sem marcar como
nota interna) envia a mensagem de verdade pelo número conectado, além
de gravá-la no MediFlux — ver `lib/whatsapp/messageSender.ts`. A
mensagem é sempre salva primeiro; se o envio real falhar (WhatsApp
desconectado, número sem WhatsApp ativo, ou qualquer outro erro), o
atendente não perde o texto digitado, mas recebe um aviso claro de que
a entrega real não aconteceu.

### Duas formas de autenticar uma conexão nova

Ao clicar em "Conectar" (painel de conexão real, Configurações →
Canais & Omnichannel API), é possível escolher entre:

- **QR code** (padrão) — escaneado pela câmera do WhatsApp no celular,
  em Aparelhos conectados → Conectar um aparelho.
- **Código de pareamento por telefone** — a clínica informa o número
  de WhatsApp (com código do país e DDD), recebe um código de 8
  dígitos diretamente no aplicativo, e digita esse código no celular
  em Aparelhos conectados → Conectar um aparelho → Conectar com
  número de telefone. Útil quando não há como usar a câmera do
  celular, ou quando o operador prefere não escanear nada.

Ambos os modos levam ao mesmo resultado — uma sessão conectada, com a
mesma sincronização de histórico e mensagens em tempo real. A escolha
é só sobre como o WhatsApp confirma que é de fato o dono do número
autorizando a conexão. Ver `lib/whatsapp/sessionManager.ts`,
`startSession(clinicId, { authMethod, phoneNumber })`.

### Onde a sessão fica salva — local ou remota

Por padrão (`WHATSAPP_SESSION_STRATEGY=local` ou variável ausente), a
sessão é salva em disco, em `.wwebjs_auth/` — simples e rápido, mas
exige que o disco seja persistente entre reinicializações do
processo. Em ambientes serverless com contêiner efêmero (cada deploy
nasce sem o disco anterior), isso exigiria reconectar (escanear QR
code ou gerar um novo código de pareamento) toda vez que o processo
reiniciar.

Definindo `WHATSAPP_SESSION_STRATEGY="remote"`, a sessão passa a ser
salva no Firebase Storage (o arquivo comprimido da sessão) com
metadados no Firestore (`lib/security/whatsappRemoteAuthStore.ts`) —
funciona mesmo sem disco persistente. Esse modo exige
`FIREBASE_SERVICE_ACCOUNT_KEY` configurada (a mesma variável já usada
pela integração de Firebase Authentication — ver seção de variáveis
de ambiente); sem ela, o sistema cai automaticamente para o modo
local, com um aviso no log do servidor, em vez de falhar.

### Alternativa quando a sincronização de histórico e mensagens não funciona

Em alguns ambientes, mesmo depois das correções abaixo, `getChats()`
(usado para importar o histórico) e o evento `client.on("message",
...)` (usado para detectar mensagens novas em tempo real) continuam
falhando de forma persistente:

```
[WhatsApp] getChats() falhou na tentativa 4/4 ... — desistindo. r: r
    at async getChatsWithRetry (lib/whatsapp/messageSync.ts:...)
```

**Causa:** instabilidade confirmada da própria biblioteca
`whatsapp-web.js` em determinados ambientes — não algo que este
projeto consiga corrigir na raiz, já que o problema está no código
interno que a biblioteca injeta no navegador (ver
[issue #201845](https://github.com/wwebjs/whatsapp-web.js/issues/201845),
[issue #201838](https://github.com/wwebjs/whatsapp-web.js/issues/201838)
e [issue #5765](https://github.com/wwebjs/whatsapp-web.js/issues/5765),
esta última especificamente sobre o evento `message` não disparar de
forma confiável). Duas tentativas de correção foram feitas na raiz
(retry com espera, e usar uma versão atualizada do WhatsApp Web — ver
abaixo) — quando elas não são suficientes, a causa é específica do
ambiente (SO, versão do Chromium, rede) e não algo que dê para
garantir de forma remota.

**Solução definitiva: polling contínuo, com retry em cada etapa.** Em
vez de depender de `getChats()` (instável) ou do evento `message`
(também instável em alguns ambientes), o sistema roda em segundo
plano, a cada 15 segundos por padrão, uma verificação ativa via
`client.getContacts()`. Para cada contato (que inclui tanto contatos
já salvos quanto qualquer pessoa que já tenha mandado mensagem, mesmo
sem estar salva), busca as mensagens recentes da conversa e importa as
que ainda não estavam no MediFlux — a mesma checagem de deduplicação
usada na sincronização de histórico evita importar a mesma mensagem
duas vezes, mesmo rodando repetidamente. Ver
`lib/whatsapp/messageSync.ts`, `syncViaContactPolling()`, e
`lib/whatsapp/sessionManager.ts`, `startContactPolling()`.

Testado e confirmado em uso real que a instabilidade **não é exclusiva
de `getChats()`** — o mesmo erro genérico já apareceu também em
`contact.getChat()` (chamado dentro do polling, para obter a conversa
de um contato específico). A causa parece ser o mecanismo de executar
código dentro do Chromium em si (`pupPage.evaluate()` do Puppeteer),
não uma função isolada — por isso cada chamada individual dentro do
polling (`getContacts()`, `getChat()`, `fetchMessages()`) agora tem seu
próprio retry (`withPuppeteerRetry()`), e uma falha persistente num
contato específico (mesmo depois do retry) não impede os demais
contatos de serem processados na mesma rodada, nem a próxima rodada de
rodar normalmente 15 segundos depois.

Esse polling roda **em paralelo** ao mecanismo baseado em evento (não
o substitui) — em ambientes onde o evento `message` funciona
normalmente, as mensagens aparecem quase instantaneamente por ele; o
polling é a garantia de que, mesmo se o evento falhar silenciosamente,
a mensagem ainda chega à Caixa de Entrada em até
`WHATSAPP_POLLING_INTERVAL_MS` (15s por padrão). O polling começa
automaticamente assim que a sessão fica conectada, e para
automaticamente ao desconectar — não exige nenhuma ação manual.

### Erro conhecido e corrigido: versão do WhatsApp Web desatualizada

Ocasionalmente, logo depois de escanear o QR code (ou completar o
pareamento por telefone) com sucesso, o log do servidor podia mostrar
o mesmo erro genérico `r: r` (ver acima).

**Causa raiz real:** a versão do WhatsApp Web que vem fixada por
padrão dentro do `whatsapp-web.js`
(`node_modules/whatsapp-web.js/src/util/Constants.js`,
`DefaultOptions.webVersion`) fica desatualizada com o tempo — o
WhatsApp Web de verdade (o que roda nos servidores da Meta) segue
evoluindo, e uma versão antiga fixada localmente deixa de ser
totalmente compatível com o código que a biblioteca injeta no
navegador.

**Correção aplicada:** `lib/whatsapp/sessionManager.ts` agora busca,
em runtime, a versão atual e estável do WhatsApp Web no índice mantido
pela comunidade
([wppconnect-team/wa-version](https://github.com/wppconnect-team/wa-version))
em vez de usar a versão fixa e cada vez mais antiga embutida no
pacote. A versão é resolvida uma vez por processo (cacheada em
memória) e usada em toda conexão nova. Como esse índice expira
versões antigas periodicamente, a versão nunca é fixada como um número
no código — é sempre buscada dinamicamente. Se preferir um espelho
próprio (ou o domínio padrão estiver bloqueado na sua rede), aponte
`WHATSAPP_WEB_VERSION_REMOTE_PATH` no `.env`.

Como mitigação adicional (para instabilidades pontuais que não são de
versão), `syncHistoricalUnreadChats()` também espera 1,5s antes da
primeira tentativa de `getChats()` e tenta novamente até 3 vezes mais
com espera progressiva antes de desistir.

**Se, mesmo com essas duas correções, o histórico ou as mensagens em
tempo real continuarem falhando:** o polling contínuo descrito acima é
a garantia final — a conexão em si nunca é afetada por essas falhas
(o WhatsApp continua conectado e você consegue enviar mensagens
normalmente); o polling assume a sincronização de mensagens recebidas
como caminho de reserva, funcionando de forma independente dos dois
mecanismos que apresentaram problema.



Este projeto passou por uma auditoria de segurança completa que
encontrou e corrigiu: bypass de autenticação sem token, senha universal
hardcoded, segredo JWT hardcoded, regras do Firestore excessivamente
abertas (com integração de Firebase Authentication via Custom Tokens
para viabilizar regras reais — ver `lib/security/firebaseAdmin.ts` e
`firestore.rules`), webhook de WhatsApp sem validação de assinatura, e
uma dependência (`zod`) ausente do `package.json`. Uma segunda
varredura de consistência de dados também corrigiu um `clinicId`
desalinhado entre os usuários de demonstração do Firestore e os dados
de exemplo do store em memória, que fazia contas de demonstração reais
verem a Caixa de Entrada vazia.

