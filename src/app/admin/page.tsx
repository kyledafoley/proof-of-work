import type { Metadata } from "next";
import AdminClient from "@/components/admin/AdminClient";

export const metadata: Metadata = {
  title: "Add an application",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminClient />;
}
