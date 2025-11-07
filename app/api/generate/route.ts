import { NextResponse } from "next/server";

import { FREE_GENERATION_LIMIT, getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incrementUsage, getUsageForUser } from "@/lib/usage";
import { BlogSection, generateBlog, regenerateSection } from "@/server/openai";

const lengthMap = {
  short: "SHORT",
  medium: "MEDIUM",
  long: "LONG"
} as const;

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, keywords, tone, audience, length, section, postId } = body as {
    title: string;
    keywords?: string;
    tone: string;
    audience: string;
    length: "short" | "medium" | "long";
    section?: BlogSection;
    postId?: string;
  };

  if (!title || !tone || !audience || !length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (section) {
    if (!postId) {
      return NextResponse.json({ error: "Missing post ID" }, { status: 400 });
    }
    const existing = await prisma.post.findUnique({
      where: { id: postId }
    });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    try {
      const text = await regenerateSection(section, {
        title,
        keywords,
        tone,
        audience,
        length,
        currentContent: existing[section],
        otherSections: {
          introduction: existing.introduction,
          body: existing.body,
          conclusion: existing.conclusion
        }
      });

      const updateData: Record<string, unknown> = { [section]: text };
      await prisma.post.update({
        where: { id: existing.id },
        data: updateData
      });

      return NextResponse.json({ [section]: text });
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: "Unable to regenerate section" }, { status: 500 });
    }
  }

  if (session.user.role !== "PRO") {
    const usage = await getUsageForUser(session.user.id);
    if (usage.count >= FREE_GENERATION_LIMIT) {
      return NextResponse.json({ error: "Free plan limit reached. Upgrade to Pro for unlimited generations." }, { status: 403 });
    }
  }

  try {
    const result = await generateBlog({ title, keywords, tone, audience, length });
    const created = await prisma.post.create({
      data: {
        title,
        keywords: keywords
          ? keywords
              .split(",")
              .map((keyword: string) => keyword.trim())
              .filter(Boolean)
          : [],
        tone,
        audience,
        length: lengthMap[length],
        introduction: result.introduction,
        body: result.body,
        conclusion: result.conclusion,
        seo: result.seo,
        userId: session.user.id
      }
    });

    if (session.user.role !== "PRO") {
      await incrementUsage(session.user.id);
    }

    return NextResponse.json({
      postId: created.id,
      introduction: result.introduction,
      body: result.body,
      conclusion: result.conclusion,
      seo: result.seo
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to generate blog" }, { status: 500 });
  }
}
