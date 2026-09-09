import { notFound } from "next/navigation";

import { PagesList } from "@/components/pages/pages-list";
import { getProjectPages } from "@/db/queries/pages";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ProjectPagesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  const readable = await assertCan(user, { kind: "project.read", projectId });
  if (!readable.ok) notFound();

  const [pages, manageable] = await Promise.all([
    getProjectPages(projectId, user.id),
    assertCan(user, { kind: "project.manage", projectId }),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <PagesList
        projectId={projectId}
        pages={pages}
        currentUserId={user.id}
        canModerate={manageable.ok}
      />
    </div>
  );
}
