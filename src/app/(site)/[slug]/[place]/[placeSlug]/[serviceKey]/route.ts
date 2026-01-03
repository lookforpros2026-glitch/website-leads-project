import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; place: string; placeSlug: string; serviceKey: string }> }
) {
  const { slug, place, placeSlug, serviceKey } = await params;
  const url = new URL(`/${slug}/${place}/n/${placeSlug}/${serviceKey}`, req.url);
  return NextResponse.redirect(url, 301);
}
