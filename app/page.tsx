import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, currentUserId } from "@/lib/auth";
import Planner from "@/components/Planner";

export const dynamic = "force-dynamic";

export default async function Home() {
  const uid = await currentUserId();
  if (!uid) redirect("/signin");
  const session = await getServerSession(authOptions);
  const first = (session?.user?.name || "").split(" ")[0];
  return <Planner name={first} />;
}
