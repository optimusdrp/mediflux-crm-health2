import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  // whatsapp-web.js e puppeteer adicionados por causa da conexão real de
  // WhatsApp (lib/whatsapp/): o pacote whatsapp-web.js sempre importa
  // internamente todas as suas estratégias de autenticação (incluindo
  // RemoteAuth, que não é usada — este projeto usa só LocalAuth), e
  // RemoteAuth depende opcionalmente de @aws-sdk/client-s3 via unzipper —
  // sem essa dependência instalada (nunca é usada de fato), o Webpack
  // falha ao tentar RESOLVER estaticamente esse import durante o build,
  // mesmo o código nunca chamando esse caminho em runtime. Marcar como
  // pacote externo do servidor faz o Next.js usar require() nativo do
  // Node em vez de tentar bundlar o pacote inteiro — resolve o problema
  // pela raiz, sem precisar instalar uma dependência que nunca é usada.
  // firebase-admin, jose e jwks-rsa adicionados por causa de um erro
  // real reportado em ambiente Windows: "require() of ES Module ...
  // jose/dist/webapi/index.js ... not supported" ao acessar
  // /api/auth/me. Causa raiz: firebase-admin/auth (usado em
  // lib/security/firebaseAdmin.ts para gerar Custom Tokens) importa
  // internamente jwks-rsa, que por sua vez faz require('jose') de forma
  // síncrona (padrão CommonJS) — mas jose é publicado como ESM PURO
  // ("type": "module", sem nenhum fallback CommonJS), o que torna esse
  // require() estruturalmente impossível de funcionar em Node.js puro,
  // por design da linguagem (não é um bug do jose nem do jwks-rsa,
  // ambos funcionam normalmente sozinhos — o problema só aparece
  // quando o bundler do Next.js tenta reprocessar essa cadeia de
  // dependências transitivas em vez de deixar o Node.js resolvê-la
  // nativamente em runtime). Marcar como pacotes externos do servidor
  // faz o Next.js usar require()/import() nativos do Node em vez de
  // tentar bundlar esse código — mesma classe de correção já aplicada
  // a whatsapp-web.js/puppeteer logo abaixo.
  serverExternalPackages: ['dynalite', 'leveldown', 'whatsapp-web.js', 'puppeteer', 'firebase-admin', 'jose', 'jwks-rsa'],
  transpilePackages: ['motion', 'motion-dom'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
