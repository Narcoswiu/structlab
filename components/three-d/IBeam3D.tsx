const LAYERS = 64;
const LAYER_GAP_PX = 2.6;

function layerColor(index: number): string {
  if (index === 0 || index === LAYERS - 1) return "var(--sl-blue)";
  return index % 2 ? "var(--sl-beam-a)" : "var(--sl-beam-b)";
}

/**
 * Въртяща се греда „I“. Няма 3D библиотека: 64 плоски сечения „I“ са
 * наредени едно зад друго по оста Z и така изглеждат като плътно тяло.
 */
export function IBeam3D() {
  return (
    <div
      aria-hidden="true"
      className="flex h-[260px] items-center justify-center overflow-hidden perspective-[900px] sm:h-[320px]"
    >
      <div className="spin3d relative size-px scale-75 sm:scale-100">
        {Array.from({ length: LAYERS }, (_, i) => {
          const background = layerColor(i);
          const z = ((i - (LAYERS - 1) / 2) * LAYER_GAP_PX).toFixed(1);
          return (
            <div
              key={i}
              className="absolute -top-[75px] -left-[95px] h-[150px] w-[190px]"
              style={{ transform: `translateZ(${z}px)` }}
            >
              <div
                className="absolute top-0 left-0 h-6 w-[190px]"
                style={{ background }}
              />
              <div
                className="absolute top-6 left-[85px] h-[102px] w-5"
                style={{ background }}
              />
              <div
                className="absolute top-[126px] left-0 h-6 w-[190px]"
                style={{ background }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
