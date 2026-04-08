import { useActor as useCoreActor } from "@caffeineai/core-infrastructure";
import { createActor } from "../backend";

// Bind the app's createActor to the library's useActor hook
export function useActor() {
  return useCoreActor(createActor);
}
