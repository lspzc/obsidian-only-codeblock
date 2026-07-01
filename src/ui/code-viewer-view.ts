/**
 * 代码查看页签视图
 *
 * 从代码块三点菜单触发，在 Obsidian 页签中展示完整代码，便于长代码阅读。
 * 支持语法高亮（复用 Prism）与一键复制。
 * 页签是临时的：用户关闭后即消失。
 *
 * 页签行为（viewerTabMode）：
 * - 'reuse'：复用同一个页签，多次查看会切换到已存在页签并刷新内容
 * - 'new'：每次点击都新建页签
 */

import { App, ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import type { OnlyCodeblockSettings } from '../types';

/** 页签视图类型标识 */
export const CODE_VIEWER_VIEW_TYPE = 'ocbe-code-viewer';

/** 从全局获取 App 实例（菜单触发时无 App 引用） */
function appFromWindow(): App {
    const w = window as unknown as { app: App };
    return w.app;
}

/**
 * 打开代码查看页签。
 * 根据 settings.viewerTabMode 决定复用已有页签还是新建页签。
 */
export function openCodeViewerTab(
    source: string,
    title: string,
    lang: string,
    settings: OnlyCodeblockSettings,
): void {
    const app = appFromWindow();
    const existing = app.workspace.getLeavesOfType(CODE_VIEWER_VIEW_TYPE);

    if (settings.viewerTabMode === 'reuse' && existing.length > 0) {
        const leaf = existing[0];
        if (leaf && leaf.view instanceof CodeViewerView) {
            leaf.view.updateContent(source, title, lang);
            void app.workspace.revealLeaf(leaf);
            return;
        }
    }

    const leaf = app.workspace.getLeaf('tab');
    const view = new CodeViewerView(leaf, settings);
    view.updateContent(source, title, lang);
    void leaf.open(view);
}

export class CodeViewerView extends ItemView {
    private source = '';
    private title = '';
    private lang = 'text';
    private settings: OnlyCodeblockSettings;

    constructor(leaf: WorkspaceLeaf, settings: OnlyCodeblockSettings) {
        super(leaf);
        this.settings = settings;
    }

    getViewType(): string {
        return CODE_VIEWER_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.title || '代码预览';
    }

    getIcon(): string {
        return 'code';
    }

    /** 更新页签内容（复用页签时调用） */
    updateContent(source: string, title: string, lang: string): void {
        this.source = source;
        this.title = title || '代码预览';
        this.lang = lang || 'text';
        // 更新页签标题
        const titleEl = this.containerEl.querySelector('.view-header-title');
        if (titleEl instanceof HTMLElement) {
            titleEl.textContent = this.title;
        }
        this.renderContent();
    }

    async onOpen(): Promise<void> {
        this.renderContent();
    }

    async onClose(): Promise<void> {
        this.contentEl.empty();
    }

    private renderContent(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('ocbe-viewer-view');

        // 工具栏
        const toolbar = contentEl.createDiv({ cls: 'ocbe-viewer-toolbar' });
        const langTag = toolbar.createSpan({ cls: 'ocbe-viewer-lang tag' });
        langTag.textContent = this.lang || this.settings.defaultLangLabel || 'default';
        const copyBtn = toolbar.createEl('button', { cls: 'ocbe-viewer-copy' });
        copyBtn.type = 'button';
        copyBtn.textContent = this.settings.copyButtonText || '点击复制';

        // 代码区
        const scroller = contentEl.createDiv({ cls: 'ocbe-viewer-scroller' });
        const pre = scroller.createEl('pre', { cls: 'ocbe-viewer-code' });
        const code = pre.createEl('code');
        if (this.lang) {
            code.classList.add(`language-${this.lang}`);
        }
        this.applyHighlight(code);

        // 复制按钮
        copyBtn.addEventListener('click', () => {
            void this.handleCopy(copyBtn);
        });
    }

    /** 调用 Prism 高亮，回退到纯文本 */
    private applyHighlight(code: HTMLElement): void {
        const prism = (
            window as unknown as {
                Prism?: {
                    languages: Record<string, unknown>;
                    highlight: (code: string, grammar: unknown, lang: string) => string;
                };
            }
        ).Prism;
        if (prism && typeof prism.highlight === 'function') {
            const grammar = prism.languages[this.lang] ?? prism.languages.clike;
            if (grammar) {
                try {
                    const template = activeDocument.createElement('template');
                    // eslint-disable-next-line no-unsanitized/property, @microsoft/sdl/no-inner-html -- Prism 可信输出
                    template.innerHTML = prism.highlight(this.source, grammar, this.lang);
                    code.appendChild(template.content.cloneNode(true));
                    return;
                } catch {
                    // 回退到纯文本
                }
            }
        }
        code.textContent = this.source;
    }

    private async handleCopy(copyBtn: HTMLButtonElement): Promise<void> {
        let ok = false;
        try {
            await navigator.clipboard.writeText(this.source);
            ok = true;
        } catch {
            ok = false;
        }
        if (ok) {
            const original = copyBtn.textContent;
            copyBtn.textContent = this.settings.copySuccessText || '复制成功';
            copyBtn.dataset.copied = '1';
            if (this.settings.showCopyNotice) {
                new Notice('已复制代码', (this.settings.copyNoticeDuration ?? 2) * 1000);
            }
            const durationMs = (this.settings.copyNoticeDuration ?? 2) * 1000;
            window.setTimeout(() => {
                copyBtn.textContent = original;
                delete copyBtn.dataset.copied;
            }, durationMs);
        } else {
            new Notice('复制失败');
        }
    }
}
