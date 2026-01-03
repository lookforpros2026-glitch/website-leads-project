import PageHealthList from "@/components/admin/PageHealthList";

export default function PageHealthIndex() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Page health</h1>
        <p className="text-sm text-slate-600">Review QA failures, duplicates, and missing sections.</p>
      </div>
      <PageHealthList />
    </div>
  );
}
