# Only Codeblock

> 增强 Obsidian 代码块的样式与功能（参考语雀风格，仅在阅读视图生效）

## 功能特性

### 阅读视图强化

- **顶部装饰条**：左侧折叠按钮（三角图标）、代码块名称、语言标签；右侧复制按钮、三点菜单按钮
- **折叠/展开**：点击折叠按钮可收起代码区，仅保留装饰条；支持全部折叠/全部展开
- **代码区结构**：左侧行号、中间代码、右侧/底部滚动条
- **语法高亮**：复用 Obsidian 内置 Prism 实现高亮
- **选中样式**：点击代码区时显示主题色边框高亮（同一时间仅一个代码块高亮，互斥）
- **复制功能**：一键复制代码，复制成功后按钮反馈
- **三点菜单**：全部折叠、全部展开、在新窗口中查看代码、导出为文件、复制代码
- **名称省略**：长名称自动显示省略号
- **主题跟随**：代码块主题完全跟随 Obsidian 当前主题（亮色/暗色），自动响应主题切换
- **Material Design 3 风格**：圆角卡片、柔和阴影、状态层交互反馈

### 编辑模式辅助

- **插入代码块**：通过命令、快捷键或侧边栏 ribbon 按钮在当前光标行触发模态框
- **编辑代码块**：光标位于既有代码块内时，可打开模态框修改其名称、语言、内容
- **标准 Markdown 格式**：使用 ` ```js title="名称" ` 扩展属性语法，不破坏原生兼容性；插件卸载后代码块仍是合法的 markdown

### 自动跳过的特殊代码块

以下语言会被 Obsidian 原生渲染，本插件自动跳过：

- `mermaid`、`math`、`katex`、`tex`
- `flow`、`flowchart`
- `dot`、`graphviz`
- `chart`、`chartjs`
- `plantuml`

## 安装

### 手动安装

1. 下载 `main.js`、`manifest.json`、`styles.css` 三个文件
2. 将文件复制到 vault 的 `.obsidian/plugins/obsidian-only-codeblock/` 目录
3. 在 Obsidian 中打开 **设置 → 社区插件**，找到 "Only Codeblock" 并启用
4. 重新加载 Obsidian 使插件生效

## 使用方法

### 创建代码块

- **侧边栏按钮**：点击左侧栏的代码图标
- **命令面板**：搜索"插入代码块"并执行
- **快捷键**：在 **设置 → 热键** 中为 "Only Codeblock: 插入代码块" 绑定快捷键

在弹出的模态框中输入：

- **代码块名称**：可选，留空时使用设置中的默认名称
- **代码块类型**：从下拉列表选择，或自定义输入
- **代码内容**：在文本框中输入，支持 `Tab` 键插入空格，`Ctrl/Cmd + Enter` 提交

### 编辑代码块

将光标置于既有代码块内，执行命令"编辑当前代码块"即可打开模态框修改。

### 三点菜单

点击代码块装饰条右侧的三点按钮，可执行以下操作：

- **全部折叠**：折叠当前笔记内所有代码块
- **全部展开**：展开当前笔记内所有代码块
- **在新窗口中查看**：弹出大窗口展示完整代码，便于长代码阅读
- **导出为文件**：将代码保存为文件到 vault（根据语言自动建议扩展名）
- **复制代码**：复制代码到剪贴板

### 名称存储格式

代码块名称使用标准 markdown fence 属性语法存储：

````markdown
```js title="示例代码"
const x = 1;
```
````

Obsidian 不识别 `title` 属性但会保留它，因此插件卸载后代码块仍是合法的 markdown，不会造成兼容性问题。

## 设置项

> 每项设置都配有重置按钮（旋转箭头图标），点击可重置为默认值。所有设置变更后实时生效，无需重新打开文件。

### 命名与折叠

| 设置 | 说明 | 默认值 |
| --- | --- | --- |
| 默认代码块名称 | 代码块未设置 title 时显示的占位名称 | `Code` |
| 阅读模式默认折叠 | 打开阅读视图时代码块默认折叠为装饰条 | 关闭 |

### 语言

| 设置 | 说明 | 默认值 |
| --- | --- | --- |
| 可选语言列表 | 模态框中可选择的语言，每行一个（也允许逗号分隔），顺序即显示顺序 | javascript、typescript、java 等 20 种 |
| 排除语言列表 | 这些语言保留 Obsidian 原生渲染（除 mermaid/math 等已自动跳过外） | 空 |

### 外观

| 设置 | 说明 | 默认值 |
| --- | --- | --- |
| 字号 | 跟随正文 / 自定义 px（Obsidian 默认正文 16px） | 自定义 14px |
| 显示行号 | 是否在代码区左侧显示行号 | 开启 |
| 装饰条显示语言标签 | 是否在装饰条显示语言标签 | 开启 |
| 装饰条背景色（亮色） | Obsidian 亮色主题下装饰条的背景色（十六进制） | `#f6f8fa` |
| 装饰条背景色（暗色） | Obsidian 暗色主题下装饰条的背景色（十六进制） | `#1e2227` |
| 代码区背景色（亮色） | Obsidian 亮色主题下代码区的背景色（十六进制） | `#ffffff` |
| 代码区背景色（暗色） | Obsidian 暗色主题下代码区的背景色（十六进制） | `#16181c` |
| 选中边框颜色 | 点击代码区时显示的边框颜色，关闭时使用 Obsidian 主题色（十六进制） | 关闭（使用主题色） |

### 滚动条与高度

| 设置 | 说明 | 默认值 |
| --- | --- | --- |
| 滚动条显示策略 | 鼠标悬停时显示 / 常显 | 鼠标悬停时显示 |
| 高度限制方案 | 按像素 (px) 限制 / 按行数限制 / 不限制（三者互斥） | 按像素 (px) 限制 |
| 最大高度 (px) | 高度限制方案为"按像素"时生效，超出后纵向滚动，0 表示不限制 | 400 |
| 最大行数 | 高度限制方案为"按行数"时生效，超出后纵向滚动，0 表示不限制 | 30 |

### 复制

| 设置 | 说明 | 默认值 |
| --- | --- | --- |
| 复制成功提示 | 复制成功后显示 Notice | 开启 |

## 兼容性说明

- **最小 Obsidian 版本**：1.4.16
- **桌面与移动端**：均支持（`isDesktopOnly: false`）
- **多窗口（Popout）**：使用 `activeDocument` / `activeWindow` 兼容 Obsidian 的多窗口特性
- **主题兼容**：代码块主题完全跟随 Obsidian 当前主题（亮色/暗色），自动响应主题切换
- **字体兼容**：代码字体族使用 Obsidian 设置中的等宽字体，不再单独配置
- **卸载安全**：仅增强阅读视图渲染，不修改 markdown 源码结构（除用户主动通过命令插入的代码块）

## 开发

### 环境要求

- Node.js 18+
- npm（包管理器）
- esbuild（打包器）

### 命令

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化自动编译）
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint
```

### 项目结构

```
src/
  main.ts                       # 插件入口，生命周期管理、设置实时生效、主题监听
  settings.ts                   # 设置接口与设置页签（每项含重置按钮）
  types.ts                      # TypeScript 类型定义
  constants.ts                  # 默认值与常量（CSS 类名、默认设置）
  commands/
    insert-codeblock.ts         # 编辑模式命令与模态框调用
  reader/
    post-processor.ts           # 阅读视图 MarkdownPostProcessor
    codeblock-builder.ts        # 代码块 DOM 构建器（含三点菜单、选中互斥）
  ui/
    codeblock-modal.ts          # 创建/编辑代码块模态框
    code-viewer-modal.ts        # 代码全屏查看模态框（三点菜单触发）
    export-modal.ts             # 导出为文件模态框（三点菜单触发）
  utils/
    code-fence-parser.ts        # fence 解析与构造工具
```

### 技术要点

- **阅读视图强化**：通过 `registerMarkdownPostProcessor` 替换渲染后的 `<pre>` 元素，避开 CodeMirror 6 block decorations 限制
- **语法高亮**：复用 Obsidian 内置 `Prism` 实例，使用 `white-space: pre` 自然渲染换行
- **名称解析**：通过 `ctx.getSectionInfo()` 获取 fence 源文本以解析 `title` 属性
- **设置实时生效**：`saveSettings()` 后调用 `previewMode.rerender(true)` 重新渲染阅读视图
- **主题切换响应**：`MutationObserver` 监听 `document.body` class 变化，自动重新渲染
- **选中互斥**：点击代码区时先清除同笔记内其他选中，再切换当前选中
- **样式隔离**：所有 CSS 类使用 `ocbe-` 前缀，通过内联 CSS 变量动态控制颜色、字号、高度等
- **Material Design 3**：圆角卡片、柔和层级阴影（elevation）、状态层交互反馈
- **类型严格**：TypeScript strict 模式 + `noUncheckedIndexedAccess`

## 发布

发布新版本时：

1. 更新 `manifest.json` 中的 `version` 字段
2. 更新 `versions.json` 中版本 → 最小 Obsidian 版本映射
3. 运行 `npm run build` 生成 `main.js`
4. 创建 GitHub Release，tag 与 `manifest.json` 的 `version` 完全一致（不要带 `v` 前缀）
5. 上传 `manifest.json`、`main.js`、`styles.css` 作为 release 资产

## API 文档

参考 [Obsidian 官方文档](https://docs.obsidian.md)。

## License

MIT
