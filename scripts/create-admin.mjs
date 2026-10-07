// Прави даден имейл администратор и отваря в браузъра еднократен линк за
// избор на парола. Линкът не се печата никъде.
//
//   pnpm admin:create nikolai@example.com
//
// Чете ключовете от .env.local (истинската база) – пуска се съзнателно, на ръка.
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const site = process.env.ADMIN_LINK_SITE_URL ?? "http://localhost:3000";

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !url || !secret) {
  console.error(
    "Употреба: pnpm admin:create <имейл>  (нужен е попълнен .env.local)",
  );
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: list, error: listError } = await supabase.auth.admin.listUsers({
  perPage: 1000,
});
if (listError) throw listError;
let user = list.users.find((candidate) => candidate.email === email);

if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    // случайна парола, която никой не знае – истинската се избира от линка
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user;
  console.log("Създаден е нов акаунт.");
} else {
  console.log("Акаунтът вече съществува.");
}

const { error: roleError } = await supabase
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", user.id);
if (roleError) throw roleError;
console.log(`Ролята на ${email} е admin.`);

const { data: link, error: linkError } = await supabase.auth.admin.generateLink(
  {
    type: "recovery",
    email,
  },
);
if (linkError) throw linkError;

const target = new URL("/auth/confirm", site);
target.searchParams.set("token_hash", link.properties.hashed_token);
target.searchParams.set("type", "recovery");
execFile("open", [target.toString()]);
console.log(
  `Отварям в браузъра страница за избор на парола (${target.origin}).`,
);
