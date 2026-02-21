import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth-utils";

export default async function ProfilePage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  redirect(`/profile/${userId}`);
}
