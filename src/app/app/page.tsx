import type { Metadata } from "next";
import AppClient from "@/components/app/AppClient";

export const metadata: Metadata = {
  title: "Your log",
  robots: { index: false, follow: false },
};

export default function AppPage() {
  return <AppClient />;
}
