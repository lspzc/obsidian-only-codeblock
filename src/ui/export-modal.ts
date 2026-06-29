/**
 * 代码导出模态框
 *
 * 从代码块三点菜单触发，将代码块内容保存为文件到 vault。
 * 文件名可自定义，根据语言自动建议扩展名。
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import type { ButtonComponent } from 'obsidian';

/** 语言到文件扩展名映射 */
const LANG_EXTENSIONS: Record<string, string> = {
    text: 'txt',
    javascript: 'js',
    typescript: 'ts',
    java: 'java',
    python: 'py',
    sql: 'sql',
    html: 'html',
    css: 'css',
    json: 'json',
    bash: 'sh',
    shell: 'sh',
    go: 'go',
    rust: 'rs',
    cpp: 'cpp',
    c: 'c',
    csharp: 'cs',
    php: 'php',
    yaml: 'yml',
    markdown: 'md',
    xml: 'xml',
};

/** 根据语言获取建议的文件扩展名 */
function getExtensionForLang(lang: string): string {
    return LANG_EXTENSIONS[lang.toLowerCase()] ?? 'txt';
}

/** 安全化文件名：移除非法字符 */
function sanitizeFileName(name: string): string {
    // eslint-disable-next-line no-control-regex -- 需要移除控制字符以保证文件名安全
    return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
}

/**
 * 显示导出模态框。
 * @param source 代码原文
 * @param title 代码块名称（作为默认文件名建议）
 * @param lang 语言标识（决定扩展名）
 */
export function showExportModal(
    source: string,
    title: string,
    lang: string,
): void {
    const w = window as unknown as { app: App };
    new ExportModal(w.app, source, title, lang).open();
}

class ExportModal extends Modal {
    private readonly source: string;
    private readonly lang: string;
    private fileName = '';

    constructor(app: App, source: string, title: string, lang: string) {
        super(app);
        this.source = source;
        this.lang = (lang || 'text').toLowerCase();
        const baseName = sanitizeFileName(title || 'code') || 'code';
        const ext = getExtensionForLang(this.lang);
        this.fileName = `${baseName}.${ext}`;
    }

    onOpen(): void {
        const { contentEl, titleEl } = this;
        titleEl.setText('导出为文件');
        contentEl.empty();
        contentEl.addClass('ocbe-export-modal');

        new Setting(contentEl)
            .setName('文件名')
            .setDesc(`将保存到 vault 根目录。扩展名根据语言（${this.lang}）自动建议。`)
            .addText((text) => {
                text.setValue(this.fileName).onChange((value) => {
                    this.fileName = value;
                });
            });

        const actionSetting = new Setting(contentEl);
        actionSetting.controlEl.addClass('ocbe-modal-actions');
        actionSetting.addButton((btn: ButtonComponent) => {
            btn.setButtonText('取消').onClick(() => {
                this.close();
            });
        });
        actionSetting.addButton((btn: ButtonComponent) => {
            btn.setButtonText('保存')
                .setCta()
                .onClick(() => {
                    void this.save();
                });
        });
    }

    private async save(): Promise<void> {
        const name = sanitizeFileName(this.fileName);
        if (!name) {
            new Notice('文件名不能为空');
            return;
        }
        const path = name.startsWith('/') ? name.slice(1) : name;
        try {
            // 检查是否已存在
            const existing = this.app.vault.getAbstractFileByPath(path);
            if (existing) {
                new Notice(`文件已存在：${path}，请更换文件名`);
                return;
            }
            await this.app.vault.create(path, this.source);
            new Notice(`已保存：${path}`);
            this.close();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            new Notice(`保存失败：${msg}`);
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
