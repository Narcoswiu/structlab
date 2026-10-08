import { PageSkeleton } from "@/components/app/PageSkeleton";

// Само тук и в „Повторение“: тези страници не връщат 404 и не пренасочват,
// затова поточното зареждане не променя кода на отговора.
export default function DashboardLoading() {
  return <PageSkeleton cards={3} />;
}
