import { AiTutorClient } from "@/lms/components/student/AiTutorClient";
import { loadManifest } from "@/lms/server/tutor-pack";

export const runtime = "nodejs";

// Teachers use the tutor without any Assignment entitlement; /api/ai/tutor
// only checks that for STUDENT.
export default async function TeacherTutorPage() {
  const manifest = await loadManifest();

  return <AiTutorClient subject={manifest.subject} blockTitle={manifest.title} topics={manifest.topics} />;
}
