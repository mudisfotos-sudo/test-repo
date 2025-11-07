import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const lengthMap = {
  short: "SHORT",
  medium: "MEDIUM",
  long: "LONG"
} as const;

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { introduction, body: contentBody, conclusion, keywords, seo, tone, audience, length } = body;

  try {
    const existing = await prisma.post.findUnique({
      where: { id: params.id }
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const updated = await prisma.post.update({
      where: { id: params.id },
      data: {
        introduction,
        body: contentBody,
        conclusion,
        keywords,
        seo,
        tone,
        audience,
        length: length ? lengthMap[length as keyof typeof lengthMap] ?? undefined : undefined
      }
    });

    return NextResponse.json({ success: true, updatedAt: updated.updatedAt });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to update post" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await prisma.post.deleteMany({
      where: { id: params.id, userId: session.user.id }
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to delete post" }, { status: 500 });
  }
}
