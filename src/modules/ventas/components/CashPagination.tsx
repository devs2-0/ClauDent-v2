import { DataPagination } from "@/shared/components/DataPagination";
import { usePagination } from "@/shared/hooks/usePagination";

export function CashPagination({ pagination, itemLabel }: { pagination: ReturnType<typeof usePagination>; itemLabel: string }) {
  return <DataPagination {...pagination} itemLabel={itemLabel} onPageSizeChange={pagination.setPageSize} onPreviousPage={pagination.previousPage} onNextPage={pagination.nextPage} />;
}
