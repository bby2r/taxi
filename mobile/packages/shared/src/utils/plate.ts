// KG license-plate format: 01KG123ABC → 01 KG 123 ABC.
// Не парсится → возвращаем upper-cased оригинал без пробелов.
const KG_PLATE = /^(\d{2})([A-ZА-Я]{2})(\d{3})([A-ZА-Я]{2,3})$/;

export function formatPlate(plate: string): string {
  const clean = plate.replace(/\s+/g, '').toUpperCase();
  const m = clean.match(KG_PLATE);
  return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : clean;
}

export function isFullPlate(plate: string | null | undefined): boolean {
  return /^[\dA-ZА-Я]{6,}$/i.test((plate ?? '').replace(/\s+/g, ''));
}
