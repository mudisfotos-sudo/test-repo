import { notFound, redirect } from "next/navigation";

import { PostEditor } from "@/components/post-editor";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface PostPageProps {
  params: { id: string };
}

export default async function PostPage({ params }: PostPageProps) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect("/login");
  }

  const post = await prisma.post.findUnique({
    where: { id: params.id }
  });

  if (!post || post.userId !== session.user.id) {
    notFound();
  }

  const keywords = post.keywords ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">{post.title}</h1>
        <p className="text-sm text-zinc-400">
          Tone: {post.tone} · Audience: {post.audience} · Length: {post.length.toLowerCase()}
        </p>
      </header>
      <PostEditor
        initialPost={{
          id: post.id,
          title: post.title,
          introduction: post.introduction,
          body: post.body,
          conclusion: post.conclusion,
          keywords,
          tone: post.tone,
          audience: post.audience,
          length: post.length.toLowerCase() as "short" | "medium" | "long",
          seo: post.seo as any
        }}
      />
    </div>
  );
}
