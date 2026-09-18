// Harness: drive the real Tabs UI with an in-memory fs + watcher.
import "./global-mocks-harness.ts";

type FileEnt = { name: string; isDir: boolean };

function makeFs() {
  const files = new Map<string, string>([
    ["/proj", "__DIR__"],
    ["/proj/hello.txt", "hello world\n"],
  ]);
  const listeners: ((ev: { eventType: string; filename: string }) => void)[] = [];
  const emit = (eventType: string, filename: string) => {
    for (const l of [...listeners]) l({ eventType, filename });
  };

  const fs = {
    async readdir(path: string, opts?: { withFileTypes: true }): Promise<any> {
      const prefix = path.endsWith("/") ? path : path + "/";
      const names = new Set<string>();
      for (const p of files.keys()) {
        if (p === path) continue;
        if (p.startsWith(prefix)) {
          const rest = p.slice(prefix.length);
          names.add(rest.split("/")[0]);
        }
      }
      if (opts?.withFileTypes) {
        return [...names].map((name): FileEnt => ({
          name,
          isDir: files.has(prefix + name + "/") || files.get(prefix + name) === "__DIR__",
        }));
      }
      return [...names];
    },
    async readFile(path: string, enc?: string): Promise<any> {
      const c = files.get(path);
      if (c === undefined || c === "__DIR__") throw new Error("ENOENT " + path);
      return enc === "utf-8" ? c : new TextEncoder().encode(c);
    },
    async writeFile(path: string, data: string) {
      files.set(path, data);
      emit("change", path);
    },
    async unlink(p: string) {
      files.delete(p);
      emit("rename", p);
    },
    async rename(o: string, n: string) {
      files.set(n, files.get(o)!);
      files.delete(o);
      emit("rename", n);
      emit("rename", o);
    },
    async copyFile(s: string, d: string) {
      files.set(d, files.get(s)!);
      emit("rename", d);
    },
    async rm(p: string, _o?: any) {
      for (const k of [...files.keys()]) if (k.startsWith(p)) files.delete(k);
      emit("rename", p);
    },
    async mkdir(p: string, _o?: any) {
      files.set(p, "__DIR__");
      emit("rename", p);
    },
    async *watch(_path: string, options?: { signal?: AbortSignal }) {
      const signal = options?.signal;
      const queue: { eventType: string; filename: string }[] = [];
      let wake: (() => void) | null = null;
      const l = (ev: { eventType: string; filename: string }) => {
        queue.push(ev);
        wake?.();
        wake = null;
      };
      listeners.push(l);
      try {
        while (!signal?.aborted) {
          if (queue.length === 0) {
            await new Promise<void>((r) => (wake = r));
            continue;
          }
          yield queue.shift()!;
        }
      } finally {
        const i = listeners.indexOf(l);
        if (i >= 0) listeners.splice(i, 1);
      }
    },
  };
  return { fs, files, emit };
}

const tick = () => new Promise((r) => setTimeout(r, 5));
const flush = async () => {
  for (let i = 0; i < 10; i++) await tick();
};

const dotState = (label: string) => {
  const dots = [...document.querySelectorAll(".tab-dot")] as any[];
  console.log(
    label,
    dots.map((d) => ({ classes: d.getAttribute("class"), visible: d.classList.contains("dirty") })),
  );
};

async function main() {
  const { MiniCodeContext } = await import("./src/context.ts");
  const { Tabs } = await import("./src/modules/tabs/components/tabs.tsx");
  const { Path } = await import("./src/utils/path.ts");

  const { fs, files, emit } = makeFs();
  const storage = new Map<string, string>();
  const ctx = new MiniCodeContext({
    root: "/proj",
    filesystem: fs as any,
    storage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
    },
  });

  ctx.logs.debug = () => {};
  ctx.logs.info = () => {};
  (ctx.logs as any).error = (...a: any[]) => console.log("LOG.ERROR:", ...a);

  // start the fs watcher like ctx.load() does, without the full workspace load
  const abort = new AbortController();
  (ctx as any).abort = abort;
  (async () => {
    for await (const event of fs.watch("/proj", { recursive: true, signal: abort.signal })) {
      if (!event.filename) continue;
      const fullPath = Path.from("/proj").join(event.filename.replace("/proj/", ""));
      if (event.eventType === "rename") {
        ctx.tabs.checkDeletedFile(fullPath.toString());
      } else if (event.eventType === "change") {
        await ctx.tabs.refreshFile(fullPath.toString());
      }
    }
  })().catch((e) => console.log("watcher died", e));

  document.body.append(Tabs({ ctx }) as any);
  await flush();

  const file = new (await import("./src/files.ts")).File("/proj/hello.txt", false);
  const tab = await ctx.tabs.open(file);
  if (!tab) throw new Error("tab is null");
  await flush();

  console.log("tab count:", ctx.tabs.data.get().length);
  dotState("after open:      ");

  // user types
  tab.view.dispatch({ changes: { from: 0, to: 5, insert: "HELLO" } });
  await flush();
  dotState("after type:      ");
  console.log("dirty:", tab.dirty.get());

  // save
  await ctx.tabs.save(tab.file);
  await flush();
  dotState("after save:      ");
  console.log("dirty:", tab.dirty.get(), "doc:", JSON.stringify(tab.view.state.doc.toString()));

  // close check
  console.log("close would prompt:", tab.dirty.get());
}

main().catch((e) => {
  console.error("HARNESS FAIL:", e);
  process.exit(1);
});
