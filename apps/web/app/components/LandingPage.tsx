"use client";

import { ImmersiveStage } from "./ImmersiveStage";
import { SiteFooter } from "./SiteFooter";
import { TopNav } from "./TopNav";
import { useLanguage } from "../i18n/LanguageProvider";
import { appHref as appHrefFor } from "../content/story";

export default function LandingPage() {
  const { language } = useLanguage();
  const appHref = appHrefFor(language);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TopNav page="landing" />

      <main id="main" tabIndex={-1}>
        <ImmersiveStage appHref={appHref} />
        <SiteFooter />
      </main>
    </>
  );
}
