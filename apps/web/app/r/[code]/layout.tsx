import type { ReactNode } from 'react';
import { RoomShell } from '../../../components/shell/RoomShell';

export default async function RoomLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomShell code={code}>{children}</RoomShell>;
}
