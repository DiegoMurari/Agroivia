import { PageWrapper } from "@/components/layout/PageWrapper";

export default function Loading() {
  return (
    <PageWrapper size="wide" aria-busy="true" aria-label="Carregando">
      <div className="grid gap-4">
        <div className="skeleton h-10 w-56 rounded" />
        <div className="skeleton h-4 w-80 max-w-full rounded" />
        <div className="skeleton h-40 w-full rounded-xl" />
        <div className="skeleton h-40 w-full rounded-xl" />
      </div>
    </PageWrapper>
  );
}
