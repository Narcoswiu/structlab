import type { Metadata } from "next";
import { LayoutGrid } from "lucide-react";
import { dismissIntro } from "@/app/(app)/actions";
import { Container } from "@/components/layout/Container";
import { Logo } from "@/components/layout/Logo";
import { PageIntro } from "@/components/PageIntro";
import { IBeam3D } from "@/components/three-d/IBeam3D";
import { TiltCard } from "@/components/three-d/TiltCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { formatQuantity } from "@/lib/format";
import { getDismissedIntros } from "@/lib/user-settings";

// Витрина на дизайн системата – достъпна само за роля admin.
export const metadata: Metadata = {
  title: "Дизайн система",
  robots: { index: false, follow: false },
};

const colors = [
  { name: "Фон", token: "--sl-bg" },
  { name: "Повърхност", token: "--sl-surface" },
  { name: "Повърхност 2", token: "--sl-surface-2" },
  { name: "Линия", token: "--sl-line" },
  { name: "Линия (силна)", token: "--sl-line-strong" },
  { name: "Текст", token: "--sl-text" },
  { name: "Текст (приглушен)", token: "--sl-text-muted" },
  { name: "Текст (блед)", token: "--sl-text-dim" },
  { name: "Синьо", token: "--sl-blue" },
  { name: "Оранжево", token: "--sl-orange" },
  { name: "Успех", token: "--sl-success" },
];

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export default async function DesignPage() {
  await requireAdmin();
  const dismissed = await getDismissedIntros();

  return (
    <Container className="flex flex-col gap-12 pb-20">
      <div className="py-[22px]">
        <Logo />
      </div>

      <PageIntro
        id="design"
        title="Дизайн система – всички градивни елементи"
        icon={<LayoutGrid aria-hidden="true" className="size-6" />}
        dismissed={dismissed.has("design")}
        onDismiss={dismissIntro}
      >
        Тук са цветовете, шрифтовете, бутоните и 3D ефектите на StructLab. Това
        каре ще стои на всеки вътрешен екран. Натисни „Разбрах“ и то няма да се
        появи повече за твоя акаунт.
      </PageIntro>

      <h1 className="font-display text-[clamp(26px,6vw,44px)] leading-[1.1] font-bold">
        Дизайн система
      </h1>

      <Block title="Цветове">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {colors.map((color) => (
            <div
              key={color.token}
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3"
            >
              <span
                className="h-14 rounded-lg border border-line-strong"
                style={{ background: `var(${color.token})` }}
              />
              <span className="text-sm font-bold">{color.name}</span>
              <span className="font-mono text-xs text-dim">{color.token}</span>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Шрифтове">
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
          <p className="font-display text-2xl font-bold">
            Unbounded – лого и големи заглавия
          </p>
          <p className="text-lg">
            Manrope – интерфейс: бутони, менюта, кратки текстове.
          </p>
          <p className="font-reading text-lg leading-[1.7]">
            Literata – за четене в учебника. Огъни гъба за миене като усмивка:
            горе тя се свива, долу се разтяга.
          </p>
          <p className="font-mono text-lg">
            JetBrains Mono – числа: {formatQuantity(5.4, "m", 1)} ·{" "}
            {formatQuantity(52, "kN·m")} · {formatQuantity(567.39, "cm⁴", 2)}
          </p>
        </div>
      </Block>

      <Block title="Бутони">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Основен</Button>
          <Button variant="warm">Акцент</Button>
          <Button variant="outline">Контур</Button>
          <Button variant="ghost">Без фон</Button>
          <Button size="lg">Голям</Button>
          <Button disabled>Изключен</Button>
        </div>
      </Block>

      <Block title="Етикети">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>ПРЕПОРЪЧАН</Badge>
          <Badge variant="success">АКТИВНА</Badge>
          <Badge variant="soon">СКОРО</Badge>
          <Badge variant="tag">Механика</Badge>
          <span className="rounded-lg bg-paper p-2">
            <Badge variant="easy">ЛЕКО</Badge>
          </span>
          <span className="rounded-lg bg-paper p-2">
            <Badge variant="detailed">ПОДРОБНО</Badge>
          </span>
        </div>
      </Block>

      <Block title="3D ефекти">
        <p className="text-muted-foreground">
          Посочи картата с мишката – тя се накланя. Всички движения спират, ако
          в системата е включено „Намали движението“.
        </p>
        <div className="flex flex-wrap gap-4">
          <TiltCard className="flex-[1_1_260px] gap-2.5 p-6">
            <h3 className="text-[19px] font-extrabold">Наклон при hover</h3>
            <p className="leading-[1.6] text-muted-foreground">
              Клас <code className="font-mono text-sm">.t3d</code>
            </p>
          </TiltCard>
          <div className="lift flex flex-[1_1_260px] flex-col gap-2.5 rounded-2xl border border-line bg-surface p-6">
            <h3 className="text-[19px] font-extrabold">Повдигане</h3>
            <p className="leading-[1.6] text-muted-foreground">
              Клас <code className="font-mono text-sm">.lift</code>
            </p>
          </div>
          <div className="flex-[1_1_260px] rounded-2xl border border-line bg-surface">
            <IBeam3D />
          </div>
        </div>
      </Block>
    </Container>
  );
}
