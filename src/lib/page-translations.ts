import { z } from "zod";
import { TEXT_POSITION_KEYS, TEXT_SCALE } from "./story-text";

const locale = z.string().max(35).refine((value) => {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}, "Use a language tag such as fr or ar").transform((value) => Intl.getCanonicalLocales(value)[0]!);

export const pageTranslationsSchema = z.record(locale, z.object({
  title: z.string().trim().min(1).max(120),
  story: z.string().trim().max(1000).optional(),
  /** Under the page in the laptop reader (Target.note in this language). */
  note: z.string().trim().max(600).optional(),
  /** This language's own text position and size on the page; unset follows the original. */
  textPosition: z.enum(TEXT_POSITION_KEYS).optional(),
  textScale: z.number().min(TEXT_SCALE.min).max(TEXT_SCALE.max).optional(),
  imageUrl: z.string().regex(/^\/(?:book-art|files\/(?:targets|images|covers))\/(?:[\w-]+\/)*[\w-]+\.(?:jpe?g|png|webp)$/i).optional(),
}));

export type PageTranslations = z.output<typeof pageTranslationsSchema>;
