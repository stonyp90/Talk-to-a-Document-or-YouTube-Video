"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { ModeSwitcher, type EntryMode } from "./ModeSwitcher";
import { useLanguage } from "../i18n/LanguageProvider";
import { LANGUAGES, withLanguage, type Language } from "../i18n/languages";
import { appHref } from "../content/story";
import { useVoiceSpeed } from "@/apps/web/src/lib/useVoiceSpeed";

const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  fr: "Français",
};

const THEME_KEY = "ursly-theme";
type Theme = "light" | "dark";
let activeTheme: Theme | undefined;

function readTheme(): Theme {
  if (activeTheme) return activeTheme;
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch {
      // A privacy-restricted browser can deny storage.
    }
  }
  if (typeof document !== "undefined" && document.documentElement.dataset.theme)
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  return "light";
}

function subscribeToTheme(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY) {
      activeTheme = event.newValue === "dark" ? "dark" : "light";
      notify();
    }
  };
  const onCustom = () => {
    activeTheme = undefined;
    notify();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("ursly-theme-change", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("ursly-theme-change", onCustom);
  };
}

type IntroChrome = { page: "intro"; trailing: ReactNode };

type TopNavProps =
  | IntroChrome
  | {
      page: "app";
      mode: EntryMode | "immersive";
      onModeChange: (mode: EntryMode) => void;
    }
  | { page: "landing" };

function MobileNavMenu({
  language,
  pathname,
  route,
}: {
  language: Language;
  pathname: string;
  route: { href: string; label: string };
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="nav-mobile-menu" ref={holder}>
      <button
        type="button"
        className="nav-mobile-trigger"
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label={open ? t("Close menu") : t("Open menu")}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      {open && (
        <div className="nav-mobile-panel" id="mobile-navigation">
          <div className="nav-mobile-heading">
            <span>{t("Navigate")}</span>
            <button type="button" onClick={close}>
              {t("Close")}
            </button>
          </div>
          <a
            className="nav-mobile-link nav-mobile-primary"
            href={route.href}
            onClick={close}
          >
            <span className="nav-orb" aria-hidden="true">
              <span className="nav-orb-core" />
            </span>
            {route.label}
          </a>
          <div className="nav-mobile-languages" aria-label={t("Language")}>
            {LANGUAGES.map((code) => (
              <a
                key={code}
                href={withLanguage(pathname, code)}
                hrefLang={code}
                lang={code}
                aria-current={code === language ? "true" : undefined}
                onClick={close}
              >
                {LANGUAGE_NAMES[code]}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function useThemeControls() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    readTheme,
    () => "light" as Theme,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    activeTheme = next;
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // A privacy-restricted browser can still use an in-memory preference.
    }
    window.dispatchEvent(new Event("ursly-theme-change"));
  }

  return { theme, toggleTheme };
}

function ThemeButton({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  const { t } = useLanguage();
  const label = t(theme === "dark" ? "Use light theme" : "Use dark theme");
  return (
    <button
      type="button"
      className="nav-theme"
      onClick={onToggle}
      aria-label={label}
      title={label}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}

/** App preferences live inside the single workspace settings dialog. */
export function AppPreferences() {
  const { language, t } = useLanguage();
  const pathname = usePathname();
  const { theme, toggleTheme } = useThemeControls();
  const { speed, setSpeed, min, max, step } = useVoiceSpeed();
  return (
    <div className="app-preferences">
      <div className="app-preferences-controls">
        <div className="nav-languages" aria-label={t("Language")}>
          {LANGUAGES.map((code) => (
            <a
              key={code}
              className="nav-language"
              href={withLanguage(pathname, code)}
              hrefLang={code}
              lang={code}
              aria-label={LANGUAGE_NAMES[code]}
              aria-current={code === language ? "true" : undefined}
            >
              {LANGUAGE_NAMES[code]}
            </a>
          ))}
        </div>
        <ThemeButton theme={theme} onToggle={toggleTheme} />
      </div>
      <div className="app-preferences-speed">
        <label htmlFor="voice-speed-slider">{t("Voice speed")}</label>
        <input
          id="voice-speed-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={speed}
          onChange={(e) => setSpeed(Number.parseFloat(e.target.value))}
          aria-valuetext={`${speed.toFixed(1)}×`}
        />
        <output htmlFor="voice-speed-slider">{speed.toFixed(1)}×</output>
      </div>
      <a className="nav-link" href={`/${language}`}>
        {t("Back to the story")}
      </a>
    </div>
  );
}

export function TopNav(props: TopNavProps) {
  const { page } = props;
  const { language, t } = useLanguage();
  const pathname = usePathname();
  const { theme, toggleTheme } = useThemeControls();

  const route =
    page === "landing"
      ? {
          href: appHref(language),
          full: t("Open the app"),
          short: t("App"),
          className: "primary",
        }
      : {
          href: `/${language}`,
          full: t("Back to the story"),
          short: t("Story"),
          className: "nav-link",
        };

  if (props.page === "intro")
    return (
      <nav className="nav" aria-label={t("Primary")} data-page="intro">
        <div className="nav-inner">
          <Brand />
          <span aria-hidden="true" />
          <div className="nav-actions">{props.trailing}</div>
        </div>
      </nav>
    );

  return (
    <>
      <span className="nav-scrim" aria-hidden="true" />
      <nav className="nav" aria-label={t("Primary")} data-page={page}>
        <div className="nav-inner">
          <Brand
            href={`/${language}`}
            label={t(page === "app" ? "Sense to Action home" : "Ursly home")}
            name={page === "app" ? "Sense to Action" : undefined}
            showDot={page !== "app"}
          />
          {props.page !== "app" && <span aria-hidden="true" />}
          {props.page !== "app" && (
            <MobileNavMenu
              language={language}
              pathname={pathname}
              route={{ href: route.href, label: route.full }}
            />
          )}

          {props.page === "app" && (
            <div className="nav-modes">
              <ModeSwitcher
                mode={props.mode === "immersive" ? "human" : props.mode}
                onChange={props.onModeChange}
              />
            </div>
          )}

          {props.page !== "app" && (
            <div className="nav-actions">
              <a
                className={`${route.className} nav-cta`}
                href={route.href}
                aria-label={route.full}
              >
                <span className="nav-orb" aria-hidden="true">
                  <span className="nav-orb-core" />
                </span>
                <span className="nav-cta-full">{route.full}</span>
                <span className="nav-cta-short" aria-hidden="true">
                  {route.short}
                </span>
              </a>
              <div className="nav-languages" aria-label={t("Language")}>
                {LANGUAGES.map((code) => (
                  <a
                    key={code}
                    className="nav-language"
                    href={withLanguage(pathname, code)}
                    hrefLang={code}
                    lang={code}
                    aria-label={LANGUAGE_NAMES[code]}
                    aria-current={code === language ? "true" : undefined}
                  >
                    {code.toUpperCase()}
                  </a>
                ))}
              </div>
              <ThemeButton theme={theme} onToggle={toggleTheme} />
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
