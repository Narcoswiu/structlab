import { getCurrentUser } from "@/lib/auth";
import { getMyData, myDataFileName } from "@/lib/my-data";
import { createClient } from "@/lib/supabase/server";

const noStore = { "cache-control": "no-store" };

// „Изтегли моите данни“: JSON файл само с данните на влезлия потребител.
// Чете се с неговия клиент (RLS), никога със служебния ключ.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Влез в профила си, за да изтеглиш данните си.", {
      status: 401,
      headers: { ...noStore, "content-type": "text/plain; charset=utf-8" },
    });
  }

  const now = new Date();
  let body: string;
  try {
    const data = await getMyData(await createClient(), user, now);
    body = JSON.stringify(data, null, 2);
  } catch {
    return new Response(
      "Файлът не можа да се изготви. Опитай отново след малко.",
      {
        status: 500,
        headers: { ...noStore, "content-type": "text/plain; charset=utf-8" },
      },
    );
  }

  return new Response(body, {
    headers: {
      ...noStore,
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${myDataFileName(now)}"`,
    },
  });
}
