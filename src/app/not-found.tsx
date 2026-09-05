import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="error-page">
      <span className="wordmark">MONZA</span>
      <h1>A little off track.</h1>
      <p>This page does not exist, or this feature is not enabled.</p>
      <Link className="button primary" href="/">
        Back to workspace
      </Link>
    </main>
  );
}
