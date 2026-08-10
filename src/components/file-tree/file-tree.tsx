import { MiniCodeContext } from "../../context";

export function FileTree(props: { ctx: MiniCodeContext }) {
  return (
    <div>
      {props.ctx.root.files().$map((f) => {
        return (
          <div>
            {f.derive((f) => {
              if (f.isDir) {
                return <FileTreeDirectory />;
              } else {
                return <FileTreeFile />;
              }
            })}
          </div>
        );
      })}
    </div>
  );
}

function FileTreeDirectory() {
  return <></>;
}

function FileTreeFile() {
  return <></>;
}
