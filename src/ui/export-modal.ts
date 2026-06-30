/**
 * 代码导出功能
 *
 * 桌面端：弹出操作系统原生"另存为"对话框，用户可选择任意路径保存。
 * 移动端：回退到 vault 内导出模态框（文件夹路径 + 文件名）。
 */

import { App, Modal, Notice, Platform, Setting } from 'obsidian';
import type { ButtonComponent } from 'obsidian';
import type { OnlyCodeblockSettings } from '../types';

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

/** 安全化文件夹路径：移除非法字符，统一分隔符 */
function sanitizeFolderPath(path: string): string {
    // eslint-disable-next-line no-control-regex -- 需要移除控制字符以保证路径安全
    let p = path.replace(/[<>:"|?*\x00-\x1f]/g, '_').trim();
    p = p.replace(/^\/+/, '');
    p = p.replace(/\/+$/, '');
    return p;
}

/** Electron showSaveDialog 返回类型 */
interface SaveDialogResult {
    canceled: boolean;
    filePath?: string;
}

/** 尝试获取 Electron 的 dialog 对象（桌面端） */
function getElectronDialog(): {
    showSaveDialog: (opts: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
    }) => Promise<SaveDialogResult>;
} | null {
    if (!Platform.isDesktopApp) return null;

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- 桌面端 Electron 模块通过 require 访问
        const electron = require('electron') as {
            remote?: { dialog?: unknown };
            dialog?: unknown;
        };
        const remoteDialog = electron.remote?.dialog as {
            showSaveDialog: (opts: unknown) => Promise<SaveDialogResult>;
        } | undefined;
        if (remoteDialog && typeof remoteDialog.showSaveDialog === 'function') {
            return remoteDialog;
        }
        const directDialog = electron.dialog as {
            showSaveDialog: (opts: unknown) => Promise<SaveDialogResult>;
        } | undefined;
        if (directDialog && typeof directDialog.showSaveDialog === 'function') {
            return directDialog;
        }
    } catch {
        // ignore
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- 桌面端 @electron/remote 通过 require 访问
        const remote = require('@electron/remote') as { dialog?: unknown };
        const dialog = remote.dialog as {
            showSaveDialog: (opts: unknown) => Promise<SaveDialogResult>;
        } | undefined;
        if (dialog && typeof dialog.showSaveDialog === 'function') {
            return dialog;
        }
    } catch {
        // ignore
    }

    return null;
}

/** 尝试用 Node.js fs 写入文件到系统路径 */
function writeToFileSystemPath(filePath: string, content: string): boolean {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef, import/no-nodejs-modules -- 桌面端通过 Node.js fs 写入文件系统
        const fs = require('fs') as {
            writeFileSync: (path: string, data: string, encoding?: string) => void;
        };
        fs.writeFileSync(filePath, content, 'utf-8');
        return true;
    } catch {
        return false;
    }
}

/**
 * 显示导出 UI。
 * 桌面端优先使用系统另存为对话框；移动端或 Electron 不可用时回退到 vault 模态框。
 * @param source 代码原文
 * @param title 代码块名称（作为默认文件名建议）
 * @param lang 语言标识（决定扩展名）
 * @param settings 插件设置（vault 导出时使用 exportPath）
 */
export async function showExportModal(
    source: string,
    title: string,
    lang: string,
    settings: OnlyCodeblockSettings,
): Promise<void> {
    const normalizedLang = (lang || 'text').toLowerCase();
    const baseName = sanitizeFileName(title || 'code') || 'code';
    const ext = getExtensionForLang(normalizedLang);
    const defaultFileName = `${baseName}.${ext}`;

    // 桌面端：尝试系统另存为对话框
    const dialog = getElectronDialog();
    if (dialog) {
        try {
            const result = await dialog.showSaveDialog({
                title: '导出代码',
                defaultPath: defaultFileName,
            });
            if (result.canceled) {
                return; // 用户取消
            }
            const filePath = result.filePath;
            if (!filePath) {
                new Notice('未选择保存位置');
                return;
            }
            const ok = writeToFileSystemPath(filePath, source);
            if (ok) {
                new Notice(`已保存到：${filePath}`);
            } else {
                new Notice('保存失败：无法写入文件');
            }
            return;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            new Notice(`系统对话框出错：${msg}，回退到 vault 导出`);
        }
    }

    // 移动端或 Electron 不可用：回退到 vault 模态框
    const w = window as unknown as { app: App };
    new VaultExportModal(w.app, source, defaultFileName, normalizedLang, settings).open();
}

/**
 * Vault 内导出模态框（移动端回退方案）。
 * 文件夹路径（必填）+ 文件名（必填），最终路径 = 文件夹 + 文件名。
 */
class VaultExportModal extends Modal {
    private readonly source: string;
    private readonly lang: string;
    private folderPath = '';
    private fileName = '';
    private pathPreviewEl: HTMLElement | null = null;

    constructor(
        app: App,
        source: string,
        defaultFileName: string,
        lang: string,
        settings: OnlyCodeblockSettings,
    ) {
        super(app);
        this.source = source;
        this.lang = lang;
        this.folderPath = settings.exportPath || '';
        this.fileName = defaultFileName;
    }

    onOpen(): void {
        const { contentEl, titleEl } = this;
        titleEl.setText('导出到 vault');
        contentEl.empty();
        contentEl.addClass('ocbe-export-modal');

        new Setting(contentEl)
            .setName('文件夹路径')
            .setDesc(
                // eslint-disable-next-line obsidianmd/ui/sentence-case -- 中文描述
                'vault 内的相对路径（如 code-exports/）。必填，不可为空。',
            )
            .addText((text) => {
                // eslint-disable-next-line obsidianmd/ui/sentence-case -- 文件夹路径示例
                text.setPlaceholder('code-exports')
                    .setValue(this.folderPath)
                    .onChange((value) => {
                        this.folderPath = value;
                        this.updatePreview();
                    });
            });

        new Setting(contentEl)
            .setName('文件名')
            .setDesc(`扩展名根据语言（${this.lang}）自动建议。必填。`)
            .addText((text) => {
                text.setPlaceholder('code.js')
                    .setValue(this.fileName)
                    .onChange((value) => {
                        this.fileName = value;
                        this.updatePreview();
                    });
            });

        const previewSetting = new Setting(contentEl)
            .setName('最终路径')
            .setDesc('文件将保存到此位置。');
        this.pathPreviewEl = previewSetting.descEl;
        this.updatePreview();

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

    private updatePreview(): void {
        if (!this.pathPreviewEl) return;
        const folder = sanitizeFolderPath(this.folderPath);
        const name = sanitizeFileName(this.fileName);
        const path = folder && name ? `${folder}/${name}` : '';
        this.pathPreviewEl.setText(
            path
                ? `文件将保存到：${path}`
                : '（请填写文件夹路径和文件名）',
        );
    }

    private async save(): Promise<void> {
        const folder = sanitizeFolderPath(this.folderPath);
        const name = sanitizeFileName(this.fileName);
        if (!folder) {
            new Notice('文件夹路径不能为空');
            return;
        }
        if (!name) {
            new Notice('文件名不能为空');
            return;
        }
        const path = `${folder}/${name}`;
        try {
            const existing = this.app.vault.getAbstractFileByPath(path);
            if (existing) {
                new Notice(`文件已存在：${path}，请更换文件名或路径`);
                return;
            }
            const folderExists = this.app.vault.getAbstractFileByPath(folder);
            if (!folderExists) {
                await this.app.vault.createFolder(folder);
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
