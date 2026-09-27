import { redirect } from "next/navigation";
import { DEMO_JOB_ID, jobPath } from "@/lib/jobCatalog";

export default function DemoPage() {
  redirect(jobPath(DEMO_JOB_ID));
}
