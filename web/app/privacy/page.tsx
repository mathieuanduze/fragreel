import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Privacy Policy — FragReel",
  description:
    "FragReel não coleta dados pessoais. Demos parsed localmente, vídeos nunca uploadados. Política de privacidade transparente e auditável.",
};

// Design tokens alinhados com landing (app/page.tsx)
const colors = {
  bg: "#0D0D1A",
  surface: "#16213E",
  surfaceLight: "rgba(255,255,255,0.03)",
  text: "#E8E8F0",
  textMuted: "rgba(255,255,255,0.65)",
  textDim: "rgba(255,255,255,0.4)",
  accent: "#FF6B35",
  accent2: "#a78bfa",
  green: "#34d399",
  border: "rgba(255,255,255,0.08)",
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text }}>
      <Nav />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section
        style={{
          paddingTop: 130,
          paddingBottom: 60,
          paddingLeft: 24,
          paddingRight: 24,
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            width: 700,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 760, margin: "0 auto", position: "relative" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 20,
              padding: "6px 14px",
              background: "rgba(52,211,153,0.08)",
              border: "1px solid rgba(52,211,153,0.2)",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              color: colors.green,
              letterSpacing: "0.03em",
            }}
          >
            🔒 Transparência total
          </div>

          <h1
            style={{
              fontSize: 56,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              margin: 0,
              marginBottom: 20,
            }}
          >
            Privacy Policy
          </h1>

          <p
            style={{
              fontSize: 19,
              color: colors.textMuted,
              maxWidth: 600,
              margin: "0 auto",
              lineHeight: 1.5,
            }}
          >
            Não rastreamos, não vendemos nada sobre você, e seus vídeos nunca
            saem do seu computador a menos que você decida compartilhar.
          </p>

          <p
            style={{
              fontSize: 13,
              color: colors.textDim,
              marginTop: 24,
              fontFamily: "monospace",
            }}
          >
            Última atualização: 2026-04-27
          </p>
        </div>
      </section>

      {/* ── Conteúdo ───────────────────────────────────────────────── */}
      <article
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "20px 24px 80px",
          fontSize: 16,
          lineHeight: 1.7,
          color: colors.text,
        }}
      >
        {/* TL;DR */}
        <Callout
          icon="✨"
          title="TL;DR"
          color={colors.green}
          body="Não rastreamos você. Não vendemos nada sobre você. Seus vídeos de gameplay nunca saem do seu computador a menos que você decida compartilhar."
        />

        {/* O que processamos */}
        <Section title="O que nós processamos">
          <SubSection title="1. Login Steam (apenas autenticação)">
            Quando você faz login via Steam, recebemos seu{" "}
            <strong>Steam ID público</strong> e seu nome de exibição da Steam.
            É isso. Sem email, sem lista de amigos, sem biblioteca de jogos,
            sem dados de pagamento. Usamos o Steam ID pra associar suas
            seleções de partida com sua conta — quando você volta, vê suas
            próprias demos.
          </SubSection>

          <SubSection title="2. Metadados de partida (numéricos, anônimos)">
            Após o cliente FragReel parsear localmente um arquivo{" "}
            <code style={codeInline}>.dem</code>, ele envia ao nosso servidor
            um <strong>JSON</strong> contendo:
            <ul style={listStyle}>
              <li>nome do mapa (ex: <code style={codeInline}>de_inferno</code>)</li>
              <li>placar da partida (ex: <code style={codeInline}>15-5</code>)</li>
              <li>
                timing de eventos por round (kill ticks, nomes de armas,
                flags de headshot, ticks de plant/defuse)
              </li>
              <li>stats agregadas (K/D, headshot %, ADR, rating)</li>
              <li>
                nome in-game extraído da demo (necessário pra travar a câmera
                spectator no momento do render)
              </li>
            </ul>
            Esse metadata permite o servidor pontuar os rounds mais
            cinematográficos e dizer ao cliente quais segmentos capturar.{" "}
            <strong>Não inclui</strong> vídeo, áudio, voice chat, ou qualquer
            coisa que identifique pessoas reais além do que Steam IDs já fazem.
          </SubSection>

          <SubSection title="3. Seleção de render">
            Quando você escolhe quais highlights renderizar, sua seleção
            (ranks, mood, toggles de música/x-ray/scoreboard, orientação) é
            enviada ao seu cliente local pra gerar o vídeo. Nada disso vira
            dado de marketing.
          </SubSection>
        </Section>

        {/* O que NÃO fazemos — split client vs website */}
        <Section title="Cliente desktop (.exe) — zero tracking">
          <p style={{ marginTop: 0, marginBottom: 16, color: colors.textMuted }}>
            O cliente desktop FragReel que você instala no seu PC{" "}
            <strong>não coleta nem envia dados pessoais</strong>. Você
            pode auditar no código aberto.
          </p>
          <DontItem
            title="Sem analytics no cliente"
            body="Zero analytics third-party no .exe. Sem Google Analytics, Mixpanel, Amplitude, Sentry, Hotjar, Facebook Pixel — nada. Verificável no código fonte aberto."
          />
          <DontItem
            title="Sem upload de vídeo"
            body="Seu vídeo de gameplay — o MP4 que seu computador renderiza — nunca é uploadado pros nossos servidores nem pra qualquer outro lugar. Fica no seu disco local. Você decide se e onde compartilhar."
          />
          <DontItem
            title="Sem upload de demo (.dem)"
            body="Os arquivos de demo na sua pasta CS2 são parseados localmente na sua máquina. Apenas o metadata numérico descrito acima sai do seu computador. O .dem em si nunca viaja pros nossos servidores."
          />
          <DontItem
            title="Sem venda ou compartilhamento dos seus dados"
            body="Não vendemos seu Steam ID nem metadata de partida. Não compartilhamos com brokers de dados. Não usamos seus dados pra treinar nenhum modelo de IA."
          />
        </Section>

        {/* Site ad-supported — transparência */}
        <Section title="Website fragreel.gg — ad-supported, com transparência">
          <Callout
            icon="📢"
            title="O site é gratuito porque é sustentado por anúncios"
            color={colors.accent}
            body={
              <>
                FragReel é grátis pra usar. O custo de servidor + manutenção
                vem de <strong>anúncios exibidos no website</strong>{" "}
                (não no cliente desktop). Pra servir e medir esses anúncios,
                o site usa tags de plataformas de publicidade — isso é
                padrão da indústria mas é honesto declarar.
              </>
            }
          />

          <SubSection title="O que as plataformas de ads fazem">
            <ul style={listStyle}>
              <li>
                Podem definir <strong>cookies de terceiros</strong> no seu
                browser pra medir impressões, cliques e relevância dos anúncios
              </li>
              <li>
                Podem coletar dados anônimos de navegação (página visitada,
                referrer, tempo de sessão) seguindo políticas próprias da
                plataforma
              </li>
              <li>
                <strong>Não recebem</strong> seu Steam ID, seu nome in-game,
                seu metadata de partida nem qualquer info que você gerou no
                FragReel — apenas o que qualquer site com ads coletaria
              </li>
            </ul>
          </SubSection>

          <SubSection title="Seus controles">
            <ul style={listStyle}>
              <li>
                Você pode usar <strong>adblock</strong> — o produto continua
                funcionando 100%. Não bloqueamos o site pra quem usa adblock,
                não pedimos pra desabilitar
              </li>
              <li>
                Pode opt-out de ads personalizados nos painéis das próprias
                plataformas (ex:{" "}
                <a
                  href="https://adssettings.google.com"
                  target="_blank"
                  rel="noopener"
                  style={linkStyle}
                >
                  Google Ad Settings
                </a>
                )
              </li>
              <li>
                Se quiser experiência sem ads externas no futuro, planejamos
                tier Premium pago (sem ads) — opt-in
              </li>
            </ul>
          </SubSection>

          <SubSection title="Cookie de autenticação">
            <p style={{ margin: 0 }}>
              Além das tags de ads, o site usa <strong>1 cookie próprio</strong>{" "}
              (JWT assinado, expiração curta) pra manter você logado via
              Steam. Esse cookie não é compartilhado com terceiros.
            </p>
          </SubSection>
        </Section>

        {/* Onde os dados ficam */}
        <Section title="Onde os dados ficam armazenados">
          <ul style={listStyleSpaced}>
            <li>
              <strong>Metadados de partida</strong>: armazenados em backend{" "}
              <a href="https://railway.app" target="_blank" rel="noopener" style={linkStyle}>
                Railway
              </a>
              , criptografados em trânsito (HTTPS) e em repouso. Vinculados
              ao seu Steam ID.
            </li>
            <li>
              <strong>Tokens de autenticação Steam</strong>: armazenados em
              cookie JWT no seu browser (assinado, expiração curta). Nunca
              enviados pra terceiros.
            </li>
            <li>
              <strong>Seus vídeos gerados</strong>: apenas no seu computador
              local. Nós nunca vemos.
            </li>
          </ul>
        </Section>

        {/* Verificação open source */}
        <Callout
          icon="🔍"
          title="Verificação open source"
          color={colors.accent2}
          body={
            <>
              Qualquer pessoa pode auditar exatamente o que processamos:
              <div style={{ marginTop: 12 }}>
                <RepoLink
                  url="https://github.com/mathieuanduze/fragreel"
                  label="Web · API · Editor"
                />
                <RepoLink
                  url="https://github.com/mathieuanduze/fragreel-client"
                  label="Cliente Desktop"
                />
              </div>
              <div style={{ marginTop: 12, fontSize: 14, color: colors.textMuted }}>
                Ambos sob licença MIT. Se encontrar alguma afirmação acima
                que não bate com o código, abra uma issue — vamos corrigir
                o código ou o documento, qual estiver errado.
              </div>
            </>
          }
        />

        {/* Deletion */}
        <Section title="Exclusão de dados">
          <p style={{ margin: 0 }}>
            Você pode solicitar a exclusão de todos os dados da sua conta a
            qualquer momento enviando um email para{" "}
            <a href="mailto:mathieuanduze@me.com" style={linkStyle}>
              mathieuanduze@me.com
            </a>{" "}
            usando o email associado à sua conta Steam, ou abrindo uma issue
            no GitHub. Em até <strong>30 dias</strong> removemos seu Steam ID
            e qualquer metadata associada do nosso banco.
          </p>
          <p style={{ marginTop: 12, color: colors.textMuted, fontSize: 14 }}>
            A exclusão de dados de conta <strong>não afeta</strong> vídeos
            que você já gerou — eles vivem apenas no seu computador.
          </p>
        </Section>

        {/* Children */}
        <Section title="Crianças">
          <p style={{ margin: 0 }}>
            FragReel não é direcionado a menores de 13 anos. Se você é
            pai/mãe ou responsável e acredita que seu filho fez login com
            uma conta Steam, contate{" "}
            <a href="mailto:mathieuanduze@me.com" style={linkStyle}>
              mathieuanduze@me.com
            </a>{" "}
            que removemos os dados.
          </p>
        </Section>

        {/* Changes */}
        <Section title="Mudanças nesta política">
          <p style={{ margin: 0 }}>
            Se mudarmos o que coletamos, atualizaremos esta página e a data
            de "Última atualização" no topo. Mudanças significativas também
            serão anunciadas nos GitHub releases do projeto.
          </p>
        </Section>

        {/* Contact */}
        <Section title="Contato">
          <ul style={listStyleSpaced}>
            <li>
              <strong>Email</strong>:{" "}
              <a href="mailto:mathieuanduze@me.com" style={linkStyle}>
                mathieuanduze@me.com
              </a>
            </li>
            <li>
              <strong>GitHub</strong>:{" "}
              <a
                href="https://github.com/mathieuanduze"
                target="_blank"
                rel="noopener"
                style={linkStyle}
              >
                @mathieuanduze
              </a>
            </li>
            <li>
              <strong>Issues</strong>:{" "}
              <a
                href="https://github.com/mathieuanduze/fragreel/issues"
                target="_blank"
                rel="noopener"
                style={linkStyle}
              >
                github.com/mathieuanduze/fragreel/issues
              </a>
            </li>
          </ul>
        </Section>

        {/* Back to home */}
        <div
          style={{
            marginTop: 60,
            paddingTop: 32,
            borderTop: `1px solid ${colors.border}`,
            textAlign: "center",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 24px",
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.text,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Voltar para fragreel.gg
          </Link>
        </div>
      </article>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function Callout({
  icon,
  title,
  body,
  color,
}: {
  icon: string;
  title: string;
  body: React.ReactNode;
  color: string;
}) {
  return (
    <div
      style={{
        margin: "32px 0",
        padding: "24px 28px",
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${color}30`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color,
        }}
      >
        <span style={{ fontSize: 18 }}>{icon}</span>
        {title}
      </div>
      <div style={{ fontSize: 16, color: colors.text, lineHeight: 1.65 }}>
        {body}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 48 }}>
      <h2
        style={{
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          margin: 0,
          marginBottom: 16,
          color: colors.text,
        }}
      >
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3
        style={{
          fontSize: 17,
          fontWeight: 700,
          margin: 0,
          marginBottom: 8,
          color: colors.accent,
        }}
      >
        {title}
      </h3>
      <div style={{ color: colors.textMuted, fontSize: 16 }}>{children}</div>
    </div>
  );
}

function DontItem({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        marginBottom: 16,
        padding: "16px 20px",
        background: colors.surfaceLight,
        borderRadius: 8,
        borderLeft: `3px solid ${colors.green}`,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          marginBottom: 4,
          color: colors.text,
        }}
      >
        ✓ {title}
      </div>
      <div style={{ color: colors.textMuted, fontSize: 15 }}>{body}</div>
    </div>
  );
}

function RepoLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        marginRight: 8,
        marginBottom: 8,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 6,
        color: colors.text,
        textDecoration: "none",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "monospace",
      }}
    >
      <span>📦</span> {label}
    </a>
  );
}

const listStyle: React.CSSProperties = {
  marginTop: 12,
  paddingLeft: 22,
  color: colors.textMuted,
};

const listStyleSpaced: React.CSSProperties = {
  margin: 0,
  paddingLeft: 22,
  color: colors.text,
  lineHeight: 2,
};

const codeInline: React.CSSProperties = {
  background: "rgba(255,107,53,0.1)",
  color: colors.accent,
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 14,
  fontFamily: "monospace",
};

const linkStyle: React.CSSProperties = {
  color: colors.accent,
  textDecoration: "none",
  borderBottom: `1px dotted ${colors.accent}`,
};
