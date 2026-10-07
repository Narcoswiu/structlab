import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { InviteEmail } from "@/emails/InviteEmail";
import { LoginLinkEmail } from "@/emails/LoginLinkEmail";

const invite = {
  fullName: "Мария",
  inviteUrl: "https://example.test/invite/abc123",
  planName: "Безплатен достъп",
  durationDays: 14,
  inviteExpiresOn: "21.10.2026",
  contactEmail: "kontakt@example.test",
};

describe("имейл с покана", () => {
  it("съдържа поздрав, линка, плана, срока и стъпките", async () => {
    const html = await render(InviteEmail(invite));
    expect(html).toContain("Здравей, Мария!");
    expect(html).toContain('href="https://example.test/invite/abc123"');
    expect(html).toContain("Безплатен достъп");
    expect(html).toContain("14 дни");
    expect(html).toContain("21.10.2026");
    expect(html).toContain("Приеми поканата");
    expect(html).toContain("Избери си парола");
    expect(html).toContain("mailto:kontakt@example.test");
    expect(html).toContain('lang="bg"');
  });

  it("без име поздравява неутрално", async () => {
    const html = await render(InviteEmail({ ...invite, fullName: "  " }));
    expect(html).toContain("Здравей!");
    expect(html).not.toContain("Здравей, ");
  });

  it("има и чист текстов вариант с линка", async () => {
    const text = await render(InviteEmail(invite), { plainText: true });
    expect(text).toContain("https://example.test/invite/abc123");
    expect(text).not.toContain("<");
  });
});

describe("имейл с линк за вход", () => {
  it("за нова парола и за вход текстовете са различни", async () => {
    const url = "https://example.test/auth/confirm?token_hash=x";
    const recovery = await render(LoginLinkEmail({ kind: "recovery", url }));
    const magic = await render(LoginLinkEmail({ kind: "magiclink", url }));
    expect(recovery).toContain("Смени паролата");
    expect(magic).toContain("Влез");
    expect(recovery).toContain("token_hash=x");
  });
});
