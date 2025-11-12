import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Header from '@/components/Header';
import { serverFetchVessel } from '@/utils/serverFetch';
import VesselDetailClient from './VesselDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VesselDetailPage({ params }: PageProps) {
  // Check auth on server-side
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  
  if (!token) {
    redirect('/login');
  }

  const vesselId = Number((await params).id);

  if (!Number.isFinite(vesselId)) {
    notFound();
  }

  let vessel = null;
  try {
    vessel = await serverFetchVessel(vesselId);
  } catch (error) {
    console.error('[VesselDetailPage SSR] Failed to fetch vessel:', error);
    notFound();
  }

  if (!vessel) {
    notFound();
  }

  return (
    <>
      <Header />
      <VesselDetailClient initialVessel={vessel} />
    </>
  );
}
