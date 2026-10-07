import { publicEnv } from "@/lib/env";

/** Пълен адрес към страница на сайта – за линкове в имейли и покани. */
export function absoluteUrl(path: string): string {
  return new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString();
}
