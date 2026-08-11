import { css } from "embedcss";
import { MiniCodeContext } from "../../context";
import { File } from "../../files";

const FileTreeStyles = css`
  .file-tree {
    display: flex;
    flex-direction: column;
  }
`;

export function FileTree({ ctx }: { ctx: MiniCodeContext }) {
  return (
    <div class={FileTreeStyles}>
      {ctx.root.files().$map((f) => {
        return (
          <div>
            {f.derive((f) => {
              if (f.isDir) {
                return <FileTreeDirectory ctx={ctx} dir={f} />;
              } else {
                return <FileTreeFile ctx={ctx} file={f} />;
              }
            })}
          </div>
        );
      })}
    </div>
  );
}

const FileTreeDirStyles = css`
  .file-tree-dir {
    display: flex;
    flex-direction: column;

    & .dirfiles {
      &.expanded {
        display: none;
      }
      &:not(.expanded) {
        display: flex;
        flex-direction: column;
      }
    }
  }
`;

function FileTreeDirectory(props: { ctx: MiniCodeContext; dir: File; level?: number }) {
  const { ctx, dir, level = 0 } = props;
  const expanded = dir.expanded;

  return (
    <div class={FileTreeDirStyles}>
      <button>
        <DirIcon />
        {dir.name}
      </button>
      <div class={{ dirfiles: true, expanded }}>
        {dir.files().$map((f) => {
          return (
            <div>
              {f.derive((f) => {
                if (f.isDir) {
                  return <FileTreeDirectory ctx={ctx} dir={f} level={level + 1} />;
                } else {
                  return <FileTreeFile ctx={ctx} file={f} level={level + 1} />;
                }
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const FileTreeFileStyles = css`
  .file-tree-file {
    display: flex;
    flex-direction: row;
  }
`;

function FileTreeFile(props: { ctx: MiniCodeContext; file: File; level?: number }) {
  const { ctx, file, level = 0 } = props;
  return (
    <button class={FileTreeFileStyles} onclick={() => ctx.openFile(file)}>
      <FileIcon ext={file.ext} />
      {file.name}
    </button>
  );
}

function DirIcon() {
  return <svg>{/* TODO */}</svg>;
}

function FileIcon(props: { ext?: string }) {
  return <svg>{/* TODO */}</svg>;
}
