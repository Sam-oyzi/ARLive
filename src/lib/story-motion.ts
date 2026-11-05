// Call from the page action's tap, before navigation: iPhone requires a user gesture.
type MotionPermission = { requestPermission?: () => Promise<string> };
let permission: Promise<boolean> | null = null;

export function requestStoryMotion(): Promise<boolean> {
  const motion = globalThis.DeviceMotionEvent as unknown as MotionPermission | undefined;
  const orientation = globalThis.DeviceOrientationEvent as unknown as MotionPermission | undefined;
  permission = Promise.all([motion, orientation].map((event) => {
    try {
      return event?.requestPermission?.().catch(() => "denied");
    } catch {
      return "denied";
    }
  })).then((results) => !results.includes("denied"));
  return permission;
}

export function storyMotionReady(): Promise<boolean> {
  return permission ?? requestStoryMotion();
}
