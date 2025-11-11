import Header from '@/components/Header';
import { VesselDetailSkeleton } from '@/components/LoadingSkeletons';

export default function Loading() {
  return (
    <>
      <Header />
      <VesselDetailSkeleton />
    </>
  );
}
