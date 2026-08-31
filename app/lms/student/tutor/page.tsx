import { AiTutorClient } from "@/lms/components/student/AiTutorClient";
import { loadManifest } from "@/lms/server/tutor-pack";

export const runtime = "nodejs";

export default async function StudentTutorPage() {
  const manifest = await loadManifest();

  return (
    <AiTutorClient
      subject={manifest.subject}
      blockTitle={manifest.title}
      topics={manifest.topics}
    />
  );
}
