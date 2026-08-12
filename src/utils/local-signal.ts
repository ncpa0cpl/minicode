import { sig } from "@ncpa0cpl/vanilla-jsx/signals";
import { Storage } from "../mini-code";

export function localSig<T>(store: Storage, key: string, initialVal: T) {
  let storedInitial = store.getItem(key);
  if (storedInitial != null) {
    try {
      storedInitial = JSON.parse(storedInitial);
    } catch {
      storedInitial = null;
    }
  }
  const s = sig((storedInitial as T) ?? initialVal);

  s.add((v) => {
    try {
      const str = JSON.stringify(v);
      store.setItem(key, str);
    } catch {}
  });

  return s;
}
