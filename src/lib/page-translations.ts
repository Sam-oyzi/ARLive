import { z } from "zod";

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
  imageUrl: z.string().regex(/^\/(?:book-art|files\/(?:targets|images|covers))\/(?:[\w-]+\/)*[\w-]+\.(?:jpe?g|png|webp)$/i).optional(),
}));

export type PageTranslations = z.output<typeof pageTranslationsSchema>;
