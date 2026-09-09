import styles from "./Applications.module.css";

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
          Release notes & installation <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className={styles.grid}>
        <article className={styles.card}>
          <span className={styles.badge}>Android preview</span>
          <h3>Take Ursly with you.</h3>
          <p>
            Download the signed APK for Android 7.0 or later. Installation
            requires allowing apps from your browser.
          </p>
          <a
            className={`primary ${styles.action}`}
            href={`${download}/ursly-v0.1.0-demo.2-android.apk`}
          >
            Download Android APK <span aria-hidden="true">↓</span>
          </a>
          <span className={styles.note}>Preview v0.1.0-demo.2 · APK</span>
        </article>
        <article className={`${styles.card} ${styles.ios}`}>
          <span className={styles.badge}>iOS Simulator preview</span>
          <h3>Explore the iOS experience.</h3>
          <p>
            For the iOS Simulator in Xcode on an Apple silicon Mac. This archive
            cannot be installed on an iPhone.
          </p>
          <a
            className={`secondary ${styles.action}`}
            href={`${download}/ursly-v0.1.0-demo.2-ios-simulator-arm64.tar.gz`}
          >
            Download iOS Simulator build <span aria-hidden="true">↓</span>
          </a>
          <span className={styles.note}>
            Preview v0.1.0-demo.2 · ARM64 archive
          </span>
        </article>
        <article className={`${styles.card} ${styles.code}`}>
          <span className={styles.badge}>Public repository</span>
          <h3>See how it’s made.</h3>
          <p>
            Explore the source, architecture, development setup, and tests.
            Contributions and thoughtful feedback are welcome.
          </p>
          <a className={`secondary ${styles.action}`} href={repository}>
            View on GitHub <span aria-hidden="true">↗</span>
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
