import styles from "./Applications.module.css";
import { Icon } from "./Icon";

const repository =
  "https://github.com/stonyp90/Talk-to-a-Document-or-YouTube-Video";
const release = `${repository}/releases/tag/v0.1.0-demo.2`;
const download = `${repository}/releases/download/v0.1.0-demo.2`;

export function Applications() {
  return (
    <section
      className={styles.section}
      id="applications"
      aria-labelledby="applications-heading"
    >
      <div className={styles.heading}>
        <div>
          <span className="eyebrow">Applications</span>
          <h2 id="applications-heading">Your next “aha”, wherever you are.</h2>
          <p>
            Try Ursly on Android, explore the iOS Simulator build, or look
            inside the code.
          </p>
        </div>
        <a className={styles.releaseLink} href={release}>
          <Icon name="external" />
          Release notes & installation
        </a>
      </div>
      <div className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardIdentity}>
            <span
              className={`${styles.platformIcon} ${styles.androidIcon}`}
              aria-hidden="true"
            >
              <Icon name="android" />
            </span>
            <span className={styles.badge}>Android preview</span>
          </div>
          <h3>Take Ursly with you.</h3>
          <p>
            Download the signed APK for Android 7.0 or later. Installation
            requires allowing apps from your browser.
          </p>
          <a
            className={`primary ${styles.action}`}
            href={`${download}/ursly-v0.1.0-demo.2-android.apk`}
          >
            <Icon name="download" /> Download Android APK
          </a>
          <span className={styles.note}>Preview v0.1.0-demo.2 · APK</span>
        </article>
        <article className={`${styles.card} ${styles.ios}`}>
          <div className={styles.cardIdentity}>
            <span
              className={`${styles.platformIcon} ${styles.appleIcon}`}
              aria-hidden="true"
            >
              <Icon name="apple" />
            </span>
            <span className={styles.badge}>iOS Simulator preview</span>
          </div>
          <h3>Explore the iOS experience.</h3>
          <p>
            For the iOS Simulator in Xcode on an Apple silicon Mac. This archive
            cannot be installed on an iPhone.
          </p>
          <a
            className={`secondary ${styles.action}`}
            href={`${download}/ursly-v0.1.0-demo.2-ios-simulator-arm64.tar.gz`}
          >
            <Icon name="download" /> Download iOS Simulator build
          </a>
          <span className={styles.note}>
            Preview v0.1.0-demo.2 · ARM64 archive
          </span>
        </article>
        <article className={`${styles.card} ${styles.code}`}>
          <div className={styles.cardIdentity}>
            <span
              className={`${styles.platformIcon} ${styles.githubIcon}`}
              aria-hidden="true"
            >
              <Icon name="github" />
            </span>
            <span className={styles.badge}>Public repository</span>
          </div>
          <h3>See how it’s made.</h3>
          <p>
            Explore the source, architecture, development setup, and tests.
            Contributions and thoughtful feedback are welcome.
          </p>
          <a className={`secondary ${styles.action}`} href={repository}>
            <Icon name="github" /> View on GitHub
          </a>
          <span className={styles.note}>Next.js · Expo · TypeScript</span>
        </article>
      </div>
      <p className={styles.disclosure}>
        These are evaluation builds. Review the{" "}
        <a href={release}>known limitations and installation instructions</a>{" "}
        before downloading.{" "}
        <a href={`${download}/SHA256SUMS.txt`}>Verify download checksums</a>.
      </p>
    </section>
  );
}
