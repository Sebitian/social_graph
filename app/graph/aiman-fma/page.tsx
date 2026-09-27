import { redirect } from "next/navigation";
import { jobPath, catalogJobForHandle } from "@/lib/jobCatalog";

export default function AimanFmaGraphPage() {
  const job = catalogJobForHandle("aiman-fma");
  redirect(job ? jobPath(job.id) : "/");
}
