import { toast } from "sonner";
import type { ActionState } from "@/server/forms";

/** Await a server action and surface its result as a toast. */
export async function runAction<T>(promise: Promise<ActionState<T>>): Promise<ActionState<T>> {
  try {
    const result = await promise;
    if (result?.error) toast.error(result.error);
    else if (result?.message) toast.success(result.message);
    return result;
  } catch (error) {
    // redirect() from an action surfaces here as a navigation; anything else is a real failure
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    toast.error("Something went wrong. Please try again.");
    return { error: "failed" };
  }
}
