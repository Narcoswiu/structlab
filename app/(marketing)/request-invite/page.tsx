import type { Metadata } from "next";
import { PublicHeading, PublicPage } from "@/components/public/PublicPage";
import { RequestInviteForm } from "@/components/public/RequestInviteForm";
import { listPublicSpecialties } from "@/lib/demo";

// Съдържанието идва от базата: страницата се обновява най-много на 5 минути.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Поискай покана",
  description:
    "Запиши се в списъка на чакащите за StructLab – учебна платформа за студенти по строителство.",
};

export default async function RequestInvitePage() {
  const options = await listPublicSpecialties();
  return (
    <PublicPage>
      <PublicHeading title="Поискай покана">
        Платформата е в бета версия и приема потребители с покана. Остави имейла
        си и ще ти пишем, когато има място. Не пращаме реклама.
      </PublicHeading>
      <RequestInviteForm options={options} />
    </PublicPage>
  );
}
