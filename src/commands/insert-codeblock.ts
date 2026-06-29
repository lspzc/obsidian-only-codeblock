/**
 * 编辑模式命令：插入/编辑代码块
 *
 * - `insert-codeblock`：在当前光标行触发模态框，提交后在光标处插入 fence
 * - `edit-current-codeblock`：若光标位于既有代码块内，提取其元信息并打开模态框编辑
 */

import { type Editor } from 'obsidian';
import type OnlyCodeblock from '../main';
import { CodeBlockModal, type CodeBlockModalResult } from '../ui/codeblock-modal';
import {
    buildFenceFirstLine,
    parseFenceFirstLine,
} from '../utils/code-fence-parser';

/**
 * 将模态框结果转为 markdown fence 文本。
 * 内容末尾保证有换行，避免与闭合 fence 粘连。
 */
function resultToFence(result: CodeBlockModalResult): string {
    const firstLine = buildFenceFirstLine(result.lang, result.name);
    const body = result.content.endsWith('\n')
        ? result.content
        : result.content + '\n';
    return `${firstLine}\n${body}\`\`\`\n`;
}

/** 在编辑器中插入 fence 文本，处理行边界 */
function insertFenceAtCursor(editor: Editor, fenceText: string): void {
    if (editor.somethingSelected()) {
        editor.replaceSelection(fenceText);
        return;
    }
    const cursor = editor.getCursor();
    const lineText = editor.getLine(cursor.line);
    if (lineText.length === 0) {
        // 空行：直接插入
        editor.replaceRange(fenceText, { line: cursor.line, ch: 0 });
    } else {
        // 非空行：在行尾另起一行插入
        const endOfLine = { line: cursor.line, ch: lineText.length };
        editor.replaceRange('\n' + fenceText, endOfLine);
    }
}

/** 找到光标所在代码块的 fence 起止行；不在代码块内返回 null */
function findCurrentFenceRange(
    editor: Editor,
): {
    startLine: number;
    endLine: number;
    lang: string;
    title: string;
    source: string;
} | null {
    const cursor = editor.getCursor();
    const totalLines = editor.lineCount();
    // 向上查找 fence 开标记
    let startLine = -1;
    let fenceMarker = '```';
    let parsedLang = '';
    let parsedTitle = '';
    for (let i = cursor.line; i >= 0; i--) {
        const line = editor.getLine(i);
        const parsed = parseFenceFirstLine(line);
        if (parsed) {
            const m = /^(`{3,}|~{3,})/.exec(line.trim());
            if (m && m[1]) {
                startLine = i;
                fenceMarker = m[1];
                parsedLang = parsed.lang;
                parsedTitle = parsed.title;
                break;
            }
        }
    }
    if (startLine < 0) {
        return null;
    }
    // 向下查找匹配的闭合 fence
    const markerChar = fenceMarker[0] ?? '`';
    const markerLen = fenceMarker.length;
    const closeRegex = new RegExp(`^${markerChar}{${markerLen},}\\s*$`);
    let endLine = -1;
    for (let j = startLine + 1; j < totalLines; j++) {
        if (closeRegex.test(editor.getLine(j).trim())) {
            endLine = j;
            break;
        }
    }
    if (endLine < 0) {
        return null;
    }
    // 光标必须在 fence 内部（不含 fence 行本身）
    if (cursor.line <= startLine || cursor.line >= endLine) {
        return null;
    }
    const source = editor.getRange(
        { line: startLine + 1, ch: 0 },
        { line: endLine, ch: 0 },
    );
    // 去掉末尾换行
    const trimmedSource = source.endsWith('\n') ? source.slice(0, -1) : source;
    return {
        startLine,
        endLine,
        lang: parsedLang,
        title: parsedTitle,
        source: trimmedSource,
    };
}

/** 打开"创建代码块"模态框（供命令与 ribbon 共用） */
export function openInsertCodeBlockModal(plugin: OnlyCodeblock, editor: Editor): void {
    const initialContent = editor.getSelection() || '';
    new CodeBlockModal(plugin.app, {
        title: '创建代码块',
        initialContent,
        languageList: plugin.settings.languageList,
        onSubmit: (result) => {
            insertFenceAtCursor(editor, resultToFence(result));
        },
    }).open();
}

/** 打开"编辑当前代码块"模态框；光标不在代码块内时无操作 */
export function openEditCurrentCodeBlockModal(
    plugin: OnlyCodeblock,
    editor: Editor,
): void {
    const range = findCurrentFenceRange(editor);
    if (!range) {
        return;
    }
    new CodeBlockModal(plugin.app, {
        title: '编辑代码块',
        initialName: range.title,
        initialLang: range.lang,
        initialContent: range.source,
        languageList: plugin.settings.languageList,
        onSubmit: (result) => {
            const newFence = resultToFence(result);
            editor.replaceRange(
                newFence,
                { line: range.startLine, ch: 0 },
                { line: range.endLine + 1, ch: 0 },
            );
        },
    }).open();
}

/** 注册编辑模式命令 */
export function registerInsertCodeBlockCommands(plugin: OnlyCodeblock): void {
    // 插入新代码块
    plugin.addCommand({
        id: 'insert-codeblock',
        name: '插入代码块',
        editorCallback: (editor: Editor) => {
            openInsertCodeBlockModal(plugin, editor);
        },
    });

    // 编辑当前代码块
    plugin.addCommand({
        id: 'edit-current-codeblock',
        name: '编辑当前代码块',
        editorCallback: (editor: Editor) => {
            openEditCurrentCodeBlockModal(plugin, editor);
        },
    });
}
