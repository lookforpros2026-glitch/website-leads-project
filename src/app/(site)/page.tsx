export default function HomePage() {
  return (
    <main className="px-6 py-16 space-y-4">
      <h1 className="text-4xl font-semibold">Website Leads Project</h1>
      <p className="text-slate-600">Programmatic SEO for LA County services.</p>
      <div className="flex gap-3">
        <a className="btn btn-primary" href="/admin">Go to Admin</a>
        <a className="btn" href="/la-county/pasadena/kitchen-remodeling">Example SEO page</a>
      </div>
    </main>
  );
}
