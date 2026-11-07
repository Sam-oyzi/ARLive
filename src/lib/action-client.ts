import { toast } from "sonner";
import { localeFrom } from "@/lib/i18n/config";
import { localizeMessage, messages } from "@/lib/i18n/messages";
import type { ActionState } from "@/server/forms";

/** The words of the page's language (set on <html> by the root layout). */
function words() {
  return messages[localeFrom(document.documentElement.lang)];
}

/** Await a server action and surface its result as a toast. */
export async function runAction<T>(promise: Promise<ActionState<T>>): Promise<ActionState<T>> {
  try {
    const result = await promise;
    if (result?.error) toast.error(localizeMessage(result.error, words()));
    else if (result?.message) toast.success(result.message);
    return result;
  } catch (error) {
    // redirect() from an action surfaces here as a navigation; anything else is a real failure
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    toast.error(words().common.somethingWrong);
    return { error: "failed" };
  }
}
