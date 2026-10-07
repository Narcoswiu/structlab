import { getActivityOverview, usersToCsv } from "@/lib/admin-activity";
import { requireAdmin } from "@/lib/auth";

// CSV с обобщение по потребители. Достъпен само за администратор.
export async function GET() {
  await requireAdmin();
  const { users } = await getActivityOverview();
  const day = new Date().toISOString().slice(0, 10);
  return new Response(usersToCsv(users), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="structlab-aktivnost-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}
