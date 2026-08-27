import { redirect } from "next/navigation";

/** The route was /admin back when there was exactly one writer. Keep the bookmark alive. */
export default function AdminRedirect() {
  redirect("/app");
}
