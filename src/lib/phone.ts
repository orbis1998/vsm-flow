export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Numéro international Congo (Kinshasa) pour tel / WhatsApp. */
export function congoIntl(phone: string): string {
  const d = phoneDigits(phone);
  if (!d) return "";
  if (d.startsWith("243")) return d;
  if (d.startsWith("0") && d.length >= 9) return `243${d.slice(1)}`;
  return d;
}

export function telHref(phone: string): string | undefined {
  const intl = congoIntl(phone);
  return intl ? `tel:+${intl}` : undefined;
}

export function whatsappHref(phone: string, text?: string): string | undefined {
  const intl = congoIntl(phone);
  if (!intl) return undefined;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${intl}${q}`;
}

export function mapsHref(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
