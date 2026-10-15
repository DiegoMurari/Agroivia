import { PageWrapper } from "@/components/layout/PageWrapper";

export default function Loading() {
  return (
    <PageWrapper size="wide" aria-busy="true" aria-label="Carregando">
      <div className="grid gap-4">
        <div className="skeleton h-10 w-72 max-w-full rounded" />
        <div className="skeleton h-4 w-96 max-w-full rounded" />
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="skeleton h-48 w-full rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
          <div className="skeleton h-28 rounded-xl" />
        </div>
      </div>
    </PageWrapper>
  );
}
