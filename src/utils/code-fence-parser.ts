/**
 * 代码块 fence 解析与构造工具
 *
 * 支持的 fence 首行格式：
 *   ```js
 *   ```js title="名称"
 *   ```js title='名称'
 *   ```js title=名称
 *   ``` title="名称"
 *
 * 不破坏 Obsidian 原生语法：Obsidian 不识别 title 属性，但会保留它，
 * 即使插件卸载，代码块仍是合法的 markdown。
 */

import type { CodeFenceMeta } from '../types';

export interface ParsedFence {
    /** 语言标识（小写，空时为空字符串） */
    lang: string;
    /** 代码块名称（来自 title 属性） */
    title: string;
    /** 全部属性 */
    attributes: Record<string, string>;
    /** 原始首行 */
    rawFirstLine: string;
}

/**
 * 解析 fence 首行（如 ```js title="demo"）。
 * 若不是 fence 行，返回 null。
 */
export function parseFenceFirstLine(line: string): ParsedFence | null {
    const trimmed = line.trim();
    const match = /^(`{3,}|~{3,})(.*)$/.exec(trimmed);
    if (!match || match[2] === undefined) {
        return null;
    }
    const rest = match[2].trim();
    // 首个 token 为语言（无空格），其余为属性
    const spaceIdx = rest.search(/\s/);
    let lang = '';
    let attrStr = '';
    if (spaceIdx < 0) {
        lang = rest;
    } else {
        lang = rest.slice(0, spaceIdx);
        attrStr = rest.slice(spaceIdx + 1).trim();
    }
    lang = lang.toLowerCase();
    const attributes = parseAttributes(attrStr);
    return {
        lang,
        title: attributes.title ?? '',
        attributes,
        rawFirstLine: line,
    };
}

/**
 * 构造 fence 首行。
 * 例如：buildFenceFirstLine('js', 'demo') -> '```js title="demo"'
 */
export function buildFenceFirstLine(lang: string, title: string): string {
    const safeLang = (lang || '').trim().toLowerCase();
    if (!title) {
        return '```' + safeLang;
    }
    const safeTitle = title.replace(/"/g, '\\"');
    return '```' + safeLang + ` title="${safeTitle}"`;
}

/**
 * 解析属性字符串，如：title="xxx" lang="js" foo=bar
 * 支持 key="value"、key='value'、key=value（不含空格）
 */
function parseAttributes(s: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!s) {
        return result;
    }
    const regex = /(\w[\w-]*)\s*=\s*("([^"]*)"|'([^']*)'|(\S+))/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(s)) !== null) {
        const key = m[1];
        if (!key) {
            continue;
        }
        const value = m[3] ?? m[4] ?? m[5] ?? '';
        result[key] = value;
    }
    return result;
}

/**
 * 从代码块源文本构建 CodeFenceMeta。
 * 通常在编辑模式插入代码块时使用。
 */
export function buildCodeFenceMeta(
    lang: string,
    title: string,
    source: string,
): CodeFenceMeta {
    return {
        lang: (lang || 'text').toLowerCase(),
        title,
        rawFirstLine: buildFenceFirstLine(lang, title),
        source,
    };
}

/**
 * 将代码块元信息序列化为完整的 markdown 文本。
 */
export function serializeCodeFence(meta: CodeFenceMeta): string {
    const firstLine = buildFenceFirstLine(meta.lang, meta.title);
    const lastLine = '```';
    // 确保源码末尾有换行，避免与闭合 fence 粘连
    const source = meta.source.endsWith('\n') ? meta.source : meta.source + '\n';
    return `${firstLine}\n${source}${lastLine}`;
}
