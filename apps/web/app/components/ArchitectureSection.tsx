import styles from "./ArchitectureSection.module.css";

type ArchitectureSectionProps = {
  language: string;
};

const copy = {
  en: {
    eyebrow: "Architecture",
    title: "Portable by design.",
    lede:
      "Ursly separates product logic from infrastructure. The same application can run on different cloud or self-hosted stacks by replacing adapters, not rewriting the product.",
    request: "Request path",
    realtime: "Realtime path",
    browser: "Web & mobile clients",
    edge: "HTTP / realtime gateway",
    compute: "Stateless application compute",
    source: "Source extraction service",
    storage: "Private object & session storage",
    secrets: "Server-side secrets & identity",
    model: "AI / realtime provider",
    email: "Transactional messaging",
    principle1: "Technology-agnostic core",
    principle1Body:
      "Business rules and use cases depend on ports. Infrastructure lives behind replaceable adapters.",
    principle2: "No permanent secrets in clients",
    principle2Body:
      "Clients receive only the minimum short-lived credentials they need. Provider keys remain server-side.",
    principle3: "Ephemeral by default",
    principle3Body:
      "Uploads and shared conversation state are temporary, private and lifecycle-controlled.",
    principle4: "Degrades instead of stopping",
    principle4Body:
      "Realtime paths can fall back to request/response, keeping the core experience available when a transport is unavailable.",
    footnote:
      "The public architecture describes capabilities, not a cloud vendor. The current deployment is one implementation of these boundaries.",
  },
  fr: {
    eyebrow: "Architecture",
    title: "Portable par conception.",
    lede:
      "Ursly sépare la logique du produit de l’infrastructure. La même application peut fonctionner sur différents nuages ou en auto-hébergement en remplaçant des adaptateurs, sans réécrire le produit.",
    request: "Parcours requête",
    realtime: "Parcours temps réel",
    browser: "Clients Web et mobiles",
    edge: "Passerelle HTTP / temps réel",
    compute: "Calcul applicatif sans état",
    source: "Service d’extraction de source",
    storage: "Stockage privé des objets et sessions",
    secrets: "Secrets et identité côté serveur",
    model: "Fournisseur IA / temps réel",
    email: "Messagerie transactionnelle",
    principle1: "Cœur indépendant des technologies",
    principle1Body:
      "Les règles métier et les cas d’usage dépendent de ports. L’infrastructure reste derrière des adaptateurs remplaçables.",
    principle2: "Aucun secret permanent dans les clients",
    principle2Body:
      "Les clients ne reçoivent que les autorisations temporaires minimales nécessaires. Les clés des fournisseurs restent côté serveur.",
    principle3: "Éphémère par défaut",
    principle3Body:
      "Les téléversements et l’état partagé des conversations sont temporaires, privés et régis par un cycle de vie.",
    principle4: "Dégrader sans interrompre",
    principle4Body:
      "Les parcours temps réel peuvent revenir au mode requête-réponse afin de garder l’expérience disponible si un transport ne l’est pas.",
    footnote:
      "L’architecture publique décrit des capacités, pas un fournisseur infonuagique. Le déploiement actuel n’est qu’une implémentation de ces frontières.",
  },
} as const;

export function ArchitectureSection({ language }: ArchitectureSectionProps) {
  const c = language === "fr" ? copy.fr : copy.en;

  return (
    <section className={styles.section} aria-labelledby="architecture-heading">
      <div className={styles.heading}>
        <span className="eyebrow">{c.eyebrow}</span>
        <h2 id="architecture-heading">{c.title}</h2>
        <p>{c.lede}</p>
      </div>

      <div className={styles.diagram} aria-label={c.title}>
        <div className={styles.lane}>
          <span className={styles.laneLabel}>{c.request}</span>
          <div className={styles.flow}>
            <Node label={c.browser} />
            <Arrow />
            <Node label={c.edge} />
            <Arrow />
            <Node label={c.compute} emphasis />
          </div>
        </div>

        <div className={styles.services}>
          <Node label={c.source} />
          <Node label={c.storage} />
          <Node label={c.secrets} />
          <Node label={c.email} />
        </div>

        <div className={styles.lane}>
          <span className={styles.laneLabel}>{c.realtime}</span>
          <div className={styles.flow}>
            <Node label={c.browser} />
            <Arrow />
            <Node label={c.edge} />
            <Arrow />
            <Node label={c.model} emphasis />
          </div>
        </div>
      </div>

      <div className={styles.principles}>
        <Principle title={c.principle1}>{c.principle1Body}</Principle>
        <Principle title={c.principle2}>{c.principle2Body}</Principle>
        <Principle title={c.principle3}>{c.principle3Body}</Principle>
        <Principle title={c.principle4}>{c.principle4Body}</Principle>
      </div>

      <p className={styles.footnote}>{c.footnote}</p>
    </section>
  );
}

function Node({ label, emphasis = false }: { label: string; emphasis?: boolean }) {
  return (
    <div className={styles.node} data-emphasis={emphasis ? "true" : undefined}>
      <span className={styles.nodeDot} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function Arrow() {
  return (
    <span className={styles.arrow} aria-hidden="true">
      →
    </span>
  );
}

function Principle({ title, children }: { title: string; children: string }) {
  return (
    <article className={styles.principle}>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}
