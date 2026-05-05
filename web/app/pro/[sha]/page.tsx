/**
 * Sprint #7 (05/05) — /pro/[sha] deprecated em favor de /demo/[sha].
 * Old links redirecionam preservando o sha.
 */
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ sha: string }>;
}

export default async function ProDemoPage({ params }: Props) {
  const { sha } = await params;
  redirect(`/demo/${sha}`);
}
