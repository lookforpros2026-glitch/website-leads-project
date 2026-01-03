import { redirect } from "next/navigation";

export default function NewPage() {
  redirect("/admin/pages/generate");
}
