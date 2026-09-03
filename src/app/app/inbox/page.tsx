import type { Metadata } from "next";
import InboxClient from "@/components/app/InboxClient";

export const metadata: Metadata = {
  title: "Inbox scan — Proof of Work",
  robots: { index: false, follow: false },
};

export default function InboxPage() {
  return <InboxClient />;
}
