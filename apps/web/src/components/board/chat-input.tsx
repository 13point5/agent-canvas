import { AtIcon, FileUploadIcon, SentIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { type MentionToken, useChatComposerStore } from "@/stores/chat-composer-store";

const mentionChipClass =
  "inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900";

function insertMention(editor: NonNullable<ReturnType<typeof useEditor>>, mention: MentionToken) {
  editor
    .chain()
    .focus()
    .insertContent([
      {
        type: "mention",
        attrs: {
          id: mention.id,
          label: mention.label,
          type: mention.type,
          ref: mention.ref,
        },
      },
      { type: "text", text: " " },
    ])
    .run();
}

export function ChatInput() {
  const { pendingMentions, clearMentions, pushMention } = useChatComposerStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mention = useMemo(
    () =>
      Mention.configure({
        HTMLAttributes: { class: mentionChipClass },
        renderText: ({ node }) => `@${node.attrs.label}`,
        renderHTML: ({ node }) => [
          "span",
          {
            class: mentionChipClass,
            "data-mention-id": node.attrs.id,
            "data-mention-type": node.attrs.type,
            "data-mention-ref": node.attrs.ref,
          },
          `@${node.attrs.label}`,
        ],
      }),
    [],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: { HTMLAttributes: { class: "m-0" } },
      }),
      mention,
      Placeholder.configure({
        placeholder: 'Ask the agent… try "make these @shapes look like this @image"',
      }),
    ],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring/60",
      },
    },
  });

  useEffect(() => {
    if (!editor || pendingMentions.length === 0) return;

    for (const mentionToken of pendingMentions) {
      insertMention(editor, mentionToken);
    }

    clearMentions();
  }, [editor, pendingMentions, clearMentions]);

  return (
    <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-2 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <HugeiconsIcon icon={AtIcon} className="size-3.5" />
        Mentions are text refs so CLI agents can resolve board context.
      </div>
      <EditorContent editor={editor} />
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <HugeiconsIcon icon={FileUploadIcon} className="mr-1 size-4" />
          Add file reference
        </Button>
        <Button type="button" size="sm">
          <HugeiconsIcon icon={SentIcon} className="mr-1 size-4" />
          Compose
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const files = event.target.files;
          if (!files?.length) return;

          for (const file of Array.from(files)) {
            const fileRef = file.webkitRelativePath || file.name;
            pushMention({
              id: `file:${fileRef}`,
              type: "file",
              label: file.name,
              ref: fileRef,
            });
          }

          event.target.value = "";
        }}
      />
    </div>
  );
}
