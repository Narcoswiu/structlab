/** Показва се, когато планът е изтекъл или достъпът е спрян. */
export function NoAccess() {
  return (
    <section className="rounded-2xl bg-warn-bg p-5 text-warn-fg sm:p-6">
      <h2 className="text-lg font-extrabold">Нямаш активен достъп</h2>
      <p className="mt-1 leading-[1.6]">
        Срокът на плана ти е изтекъл или достъпът е спрян. Пиши ни през бутона
        „Обратна връзка“, ако смяташ, че е грешка.
      </p>
    </section>
  );
}
