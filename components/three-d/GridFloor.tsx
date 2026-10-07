/** 3D мрежа-под зад героя. Родителят трябва да е relative + overflow-hidden. */
export function GridFloor() {
  return (
    <div
      aria-hidden="true"
      className="grid-floor pointer-events-none absolute -right-1/4 -bottom-[60px] -left-1/4 h-[340px] opacity-50"
    />
  );
}
