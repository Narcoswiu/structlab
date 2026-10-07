import { SiteFooter } from "@/components/layout/SiteFooter";

// (marketing) е „route group“: скобите групират публичните страници под общ
// layout, без да добавят нищо към адреса.
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
