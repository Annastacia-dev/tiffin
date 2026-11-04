import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Planner from "@/components/Planner";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return <Planner name={(user.name || "").split(" ")[0]} />;
}
