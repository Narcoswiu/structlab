/** „Плаващата“ карта в героя: статична снимка на BeamLab (проста греда, L = 6 m). */
export function BeamPreview() {
  return (
    <div className="float3d relative min-w-0 flex-[1_1_460px] py-6 pl-6">
      <div className="overflow-hidden rounded-[18px] border border-line-strong bg-surface">
        <div className="flex items-center justify-between border-b border-line px-[18px] py-3.5 text-sm">
          <span className="font-bold">BeamLab · проста греда</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-success">
            <span className="size-[7px] rounded-full bg-success" />
            на живо
          </span>
        </div>
        <div className="px-[18px] pt-[18px] pb-2">
          <svg
            viewBox="0 0 520 300"
            className="block h-auto w-full"
            role="img"
            aria-label="Проста греда със сила 30 kN и диаграма на огъващия момент с максимум 43,2 kN·m"
          >
            <line
              x1="40"
              y1="90"
              x2="480"
              y2="90"
              stroke="var(--sl-text)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <polygon
              points="40,96 28,118 52,118"
              fill="none"
              stroke="var(--sl-text-dim)"
              strokeWidth="2"
            />
            <polygon
              points="480,96 468,118 492,118"
              fill="none"
              stroke="var(--sl-text-dim)"
              strokeWidth="2"
            />
            <line
              x1="216"
              y1="18"
              x2="216"
              y2="80"
              stroke="var(--sl-orange)"
              strokeWidth="3"
            />
            <polygon points="216,86 208,70 224,70" fill="var(--sl-orange)" />
            <text
              x="228"
              y="34"
              fill="var(--sl-orange)"
              fontFamily="var(--font-mono)"
              fontSize="14"
            >
              F = 30 kN
            </text>
            <line
              x1="40"
              y1="160"
              x2="480"
              y2="160"
              stroke="var(--sl-line-strong)"
              strokeWidth="1.5"
            />
            <polygon
              points="40,160 216,262 480,160"
              fill="rgba(110,168,255,0.16)"
              stroke="var(--sl-blue)"
              strokeWidth="2.5"
            />
            <circle cx="216" cy="262" r="5" fill="var(--sl-orange)" />
            <text
              x="228"
              y="286"
              fill="var(--sl-blue-soft)"
              fontFamily="var(--font-mono)"
              fontSize="14"
            >
              M max = 43,2 kN·m
            </text>
          </svg>
        </div>
        <div className="flex gap-2.5 px-[18px] pb-[18px] font-mono text-[13px] text-muted-foreground">
          <span className="flex-1 rounded-[10px] bg-surface-2 px-3 py-2.5">
            R<sub>A</sub> = 18,00 kN
          </span>
          <span className="flex-1 rounded-[10px] bg-surface-2 px-3 py-2.5">
            R<sub>B</sub> = 12,00 kN
          </span>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 max-w-[260px] rounded-[14px] border border-line-strong bg-surface-2 px-4 py-3.5 text-sm leading-normal">
        <span className="mb-1 block text-xs font-bold text-warm">
          AI асистент
        </span>
        Q сменя знака под силата – там M е най-голям.
      </div>
    </div>
  );
}
