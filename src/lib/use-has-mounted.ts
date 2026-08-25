import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Client/server mount detection without a setState-in-effect: subscribing
// to a store that's always "mounted" on the client but reports
// "not mounted" for the server snapshot naturally resolves to true only
// after hydration, avoiding a hydration mismatch.
export function useHasMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
