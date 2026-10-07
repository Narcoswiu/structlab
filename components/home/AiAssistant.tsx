import { Check } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const modes = [
  "Обясни по-просто",
  "Сократов режим – води с въпроси",
  "Провери снимка на решението ми",
  "Дай ми подобна задача",
];

export function AiAssistant() {
  return (
    <section
      id="ai"
      className="flex scroll-mt-6 flex-wrap items-center gap-10 pt-16 lg:gap-12 lg:pt-[104px]"
    >
      <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-4">
        <SectionHeading
          eyebrow="AI АСИСТЕНТ"
          title="Учи те, а не преписва вместо теб"
        >
          Отговаря само по съдържанието на платформата и посочва урока, от който
          е взел отговора.
        </SectionHeading>
        <ul className="flex flex-col gap-2.5 pt-1">
          {modes.map((mode) => (
            <li key={mode} className="flex items-center gap-2.5 font-semibold">
              <Check
                aria-hidden="true"
                className="size-5 flex-none text-success"
                strokeWidth={2.5}
              />
              {mode}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
        <div className="max-w-[80%] self-end rounded-[14px_14px_4px_14px] bg-chat-user px-4 py-3 leading-normal">
          Защо армировката на балкона е горе?
        </div>
        <div className="max-w-[88%] self-start rounded-[14px_14px_14px_4px] bg-surface-2 px-4 py-3.5 leading-[1.6] text-chat-text">
          Балконът е конзола. При стената моментът опъва горните нишки, а
          бетонът не понася опън – затова стоманата е горе.
          <span className="mt-2 block text-[13px] text-link">
            Източник: Глава 3 · В реалния живот
          </span>
        </div>
        <div className="max-w-[88%] self-start rounded-[14px] border border-dashed border-chat-dash px-4 py-3 text-[15px] text-warn-fg">
          А къде е опънът при проста греда?
        </div>
      </div>
    </section>
  );
}
