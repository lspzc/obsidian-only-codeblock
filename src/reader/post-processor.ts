/**
 * 阅读视图 MarkdownPostProcessor
 *
 * 注册到 plugin.registerMarkdownPostProcessor，扫描渲染后的 <pre> 元素，
 * 替换为带装饰条与行号的代码块 wrapper。
 *
 * 关键点：
 * - 使用 ctx.getSectionInfo() 获取 fence 源文本以提取 title 属性
 * - 自动跳过 mermaid/math/flow/dot 等已被 Obsidian 特殊渲染的代码块
 * - 自动跳过用户在 excludeLanguages 中配置的语言
 * - 已包裹的 <pre>（重渲染场景）会被跳过，避免重复处理
 * - 主题完全跟随 Obsidian 当前主题（亮/暗）
 */

import { Notice, type Plugin } from 'obsidian';
import { ALWAYS_EXCLUDED_LANGUAGES, CSS_CLASS } from '../constants';
import type { OnlyCodeblockSettings } from '../types';
import { parseFenceFirstLine, type ParsedFence } from '../utils/code-fence-parser';
import { buildCodeBlockWrapper } from './codeblock-builder';

/** 插件实例的最小依赖形状 */
interface PluginLike extends Plugin {
    settings: OnlyCodeblockSettings;
}

/** 从 <pre> 元素的 class 中提取语言标识 */
function getLanguageFromPre(pre: HTMLElement): string {
    const preClass = pre.className || '';
    let m = /language-([\w-]+)/.exec(preClass);
    if (m && m[1]) {
        return m[1].toLowerCase();
    }
    const code = pre.querySelector('code');
    if (code) {
        m = /language-([\w-]+)/.exec(code.className || '');
        if (m && m[1]) {
            return m[1].toLowerCase();
        }
    }
    return 'text';
}

/** 判断语言是否应跳过强化 */
function shouldSkipLanguage(
    lang: string,
    settings: OnlyCodeblockSettings,
): boolean {
    const l = lang.toLowerCase();
    if (ALWAYS_EXCLUDED_LANGUAGES.has(l)) {
        return true;
    }
    if (settings.excludeLanguages.includes(l)) {
        return true;
    }
    return false;
}

/** 直接读取 Obsidian 当前主题（亮/暗） */
export function isObsidianDark(): boolean {
    return activeDocument.body.classList.contains('theme-dark');
}

interface FenceInfo {
    meta: ParsedFence;
    source: string;
}

/**
 * 在 section 的源文本中查找所有 fence 代码块。
 * 返回的数组顺序即 fence 在源文本中的出现顺序，用于与渲染出的 <pre> 一一对应。
 */
function findFencesInSection(
    sectionText: string,
): Array<{ meta: ParsedFence; source: string }> {
    const lines = sectionText.split('\n');
    const results: Array<{ meta: ParsedFence; source: string }> = [];
    let i = 0;
    while (i < lines.length) {
        const currentLine = lines[i];
        if (currentLine === undefined) {
            break;
        }
        const parsed = parseFenceFirstLine(currentLine);
        if (parsed) {
            // 确定闭合标记（``` 或 ~~~，长度 >= 开标记）
            const markerMatch = /^(`{3,}|~{3,})/.exec(currentLine.trim());
            const marker = markerMatch?.[1] ?? '```';
            const markerChar = marker[0] ?? '`';
            const markerLen = marker.length;
            const closeRegex = new RegExp(
                `^${markerChar}{${markerLen},}\\s*$`,
            );
            let endLine = -1;
            for (let j = i + 1; j < lines.length; j++) {
                const candidate = lines[j];
                if (candidate !== undefined && closeRegex.test(candidate.trim())) {
                    endLine = j;
                    break;
                }
            }
            if (endLine > 0) {
                const source = lines.slice(i + 1, endLine).join('\n');
                results.push({ meta: parsed, source });
                i = endLine + 1;
                continue;
            }
        }
        i++;
    }
    return results;
}

/** 注册代码块后处理器 */
export function registerCodeBlockPostProcessor(plugin: PluginLike): void {
    plugin.registerMarkdownPostProcessor((el, ctx) => {
        const pres = el.querySelectorAll<HTMLPreElement>('pre');
        if (pres.length === 0) {
            return;
        }

        // 获取 section 源文本以解析 title
        const sectionInfo = ctx.getSectionInfo(el);
        const fenceInfos: FenceInfo[] = sectionInfo
            ? findFencesInSection(sectionInfo.text)
            : [];

        const settings = plugin.settings;
        const isDark = isObsidianDark();

        pres.forEach((pre, idx) => {
            // 已包裹（重渲染）则跳过
            if (pre.closest('.' + CSS_CLASS.wrapper)) {
                return;
            }

            const langFromDom = getLanguageFromPre(pre);
            if (shouldSkipLanguage(langFromDom, settings)) {
                return;
            }

            // 与 fence 信息匹配
            let lang = langFromDom;
            let title = '';
            let source = pre.textContent || '';

            const info = fenceInfos[idx];
            if (info) {
                // 优先使用 fence 中的语言（更准确，包含未识别的语言）
                if (info.meta.lang) {
                    lang = info.meta.lang;
                }
                title = info.meta.title;
                source = info.source;
            }

            // 二次校验：fence 中的语言可能也是排除项
            if (shouldSkipLanguage(lang, settings)) {
                return;
            }

            const wrapper = buildCodeBlockWrapper({
                source,
                lang,
                title,
                settings,
                isDark,
                onCopy: settings.showCopyNotice
                    ? () => new Notice('已复制代码')
                    : undefined,
            });

            pre.replaceWith(wrapper);
        });
    });
}
