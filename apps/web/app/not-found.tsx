import Link from 'next/link';

export default function NotFound() {
  return <main className="shell"><div className="container">
    <Link className="brand" href="/" aria-label="Ursly home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="brand-mark" src="/brand/ursly-mark.svg" width="36" height="36" alt="" />
      ursly<span className="brand-dot">.</span>
    </Link>
    <div className="hero"><div className="eyebrow">404 · Ursly</div>
      <h1>Let’s find<br /><span>your next idea.</span></h1>
      <p className="lede">This page could not be found. Your next conversation starts at home.</p>
      <Link className="primary" href="/">Back to Ursly</Link>
    </div>
  </div></main>;
}
