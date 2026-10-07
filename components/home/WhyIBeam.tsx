import Link from "next/link";
import { IBeam3D } from "@/components/three-d/IBeam3D";
import { Eyebrow } from "./SectionHeading";

export function WhyIBeam() {
  return (
    <section className="pt-16 lg:pt-[104px]">
      <div className="lift flex flex-wrap items-center gap-6 overflow-hidden rounded-[20px] border border-line bg-surface p-6 sm:gap-10 sm:p-10">
        <div className="min-w-0 flex-[1_1_360px]">
          <IBeam3D />
        </div>
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <Eyebrow>3D</Eyebrow>
          <h2 className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.5px] sm:text-[34px]">
            Защо стоманените греди са с форма „I“?
          </h2>
          <p className="text-[17px] leading-[1.65] text-muted-foreground">
            Същото количество стомана, но поясите са далеч от оста. Затова
            инерционният момент е многократно по-голям, отколкото при плътен
            правоъгълник със същата площ.
          </p>
          <Link
            href="/demo/uchebnik"
            className="inline-flex min-h-11 items-center self-start font-extrabold text-link hover:text-link-hover"
          >
            Прочети в учебника →
          </Link>
        </div>
      </div>
    </section>
  );
}
