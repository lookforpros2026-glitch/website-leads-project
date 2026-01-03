import { redirect } from "next/navigation";

export default async function BulkCreatePage() {
  redirect("/admin/pages/generate");
}
