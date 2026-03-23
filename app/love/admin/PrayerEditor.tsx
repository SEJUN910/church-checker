'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';

interface Props {
  content: string;
  onChange: (html: string) => void;
}

const BTN = 'px-2 py-1 rounded text-xs font-bold transition-colors';
const ACTIVE = 'bg-purple-600 text-white';
const INACTIVE = 'bg-gray-100 text-gray-700 hover:bg-gray-200';

export default function PrayerEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[140px] px-3 py-2.5 text-sm text-gray-800 focus:outline-none',
      },
    },
    immediatelyRender: false,
  });

  if (!editor) return null;

  const btn = (active: boolean) => `${BTN} ${active ? ACTIVE : INACTIVE}`;

  return (
    <div className="rounded-xl border-2 border-gray-200 focus-within:border-purple-400 overflow-hidden min-h-[60vh]">
      {/* 툴바 */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))}><i>I</i></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive('underline'))}><u>U</u></button>
        <div className="w-px bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive('heading', { level: 2 }))}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive('heading', { level: 3 }))}>H3</button>
        <div className="w-px bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))}>• 목록</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))}>1. 목록</button>
        <div className="w-px bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btn(editor.isActive({ textAlign: 'left' }))}>←</button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btn(editor.isActive({ textAlign: 'center' }))}>↔</button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btn(editor.isActive({ textAlign: 'right' }))}>→</button>
        <div className="w-px bg-gray-200 mx-0.5" />
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive('blockquote'))}>❝</button>
        <button type="button" onClick={() => editor.chain().focus().setHardBreak().run()} className={INACTIVE + ' ' + BTN}>줄바꿈</button>
      </div>

      {/* 에디터 본문 */}
      <EditorContent editor={editor} />
    </div>
  );
}
