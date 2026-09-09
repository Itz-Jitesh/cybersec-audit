import Link from "next/link";
import { notFound } from "next/navigation";

import { PageEditor } from "@/components/pages/page-editor";
import { getPage } from "@/db/queries/pages";
import { getProjectMembers } from "@/db/queries/project";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; pageId: string }>;
}) {
  const { pageId } = await params;
  const user = await requireUser();

  const page = await getPage(pageId);
  if (!page) notFound();

  // The project comes from the row, not the URL, so a mismatched segment
  // cannot borrow another project's permissions.
  const readable = await assertCan(user, {
    kind: "project.read",
    projectId: page.projectId,
  });
  if (!readable.ok) notFound();

  // A private page is its owner's alone. Rendering "not found" rather than
  // "forbidden" keeps the existence of someone's private notes private too.
  if (page.access === "private" && page.ownerId !== user.id) notFound();

  const members = await getProjectMembers(page.projectId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-border-subtle px-4">
        <Link
          href={`/projects/${page.projectId}/pages`}
          className="text-2xs tracking-wide text-text-400 uppercase hover:text-text-200"
        >
          Pages
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PageEditor
          pageId={page.id}
          initialTitle={page.title}
          initialContent={page.contentJson}
          initialAccess={page.access}
          members={members}
          canEdit={page.ownerId === user.id}
        />
      </div>
    </div>
  );
}
