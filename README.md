# git-keeper

管理 Git 仓库文件的 CLI 工具。安全删除跟踪文件、列出未跟踪文件、递归扫描多仓库工作区。

## 安装

```bash
pnpm install
pnpm build
```

## 使用方式

### 非交互模式（适合 Agent/自动化）

```bash
# 列出未跟踪文件
node dist/index.js list --path /my/repo
node dist/index.js list --current-path --include-ignored
node dist/index.js list -p /my/repo --output untracked.txt -n

# 删除所有跟踪文件（保留未跟踪文件）
node dist/index.js delete --path /my/repo
node dist/index.js delete -p /my/repo --delete-dir -n

# 递归扫描目录下所有仓库的未跟踪文件
node dist/index.js scan --path /workspace
node dist/index.js scan -p /workspace --include-ignored --output report.txt -n
```

### 交互模式

```bash
# 不带参数启动交互界面
node dist/index.js

# 带子命令启动，进入交互界面
node dist/index.js list
node dist/index.js delete
node dist/index.js scan
```

交互模式下程序会提示输入目标路径，并以 TUI 显示进度和结果。

## 命令参考

### `list`

列出 Git 仓库中未被跟踪的文件（只读）。

| 选项 | 说明 |
|------|------|
| `-p, --path <dir>` | 目标仓库目录 |
| `--current-path` | 使用当前目录 |
| `--include-ignored` | 同时列出被 `.gitignore` 忽略的文件 |
| `--output <file>` | 将文件列表导出到文件 |
| `-n, --non-interactive` | 非交互模式 |

### `delete`

安全删除 Git 仓库中所有被跟踪的文件，保留未跟踪文件。

执行流程：
1. 检查是否有远程地址（`origin`），无则退出
2. 检查是否有未提交修改，有则退出
3. 将远程地址写入 `remote.txt`（文件冲突时自动加时间戳后缀）
4. 通过 `git ls-files` 获取跟踪文件列表并逐一删除
5. （可选）删除空目录

| 选项 | 说明 |
|------|------|
| `-p, --path <dir>` | 目标仓库目录 |
| `--current-path` | 使用当前目录 |
| `--delete-dir` | 删除空目录 |
| `-n, --non-interactive` | 非交互模式 |

### `scan`

递归扫描顶层目录下的所有 Git 仓库（含子模块），汇总未跟踪文件。

| 选项 | 说明 |
|------|------|
| `-p, --path <dir>` | 顶层扫描目录 |
| `--current-path` | 使用当前目录 |
| `--include-ignored` | 同时列出被忽略的文件 |
| `--output <file>` | 导出完整报告 |
| `-n, --non-interactive` | 非交互模式 |

## 开发

```bash
pnpm dev              # 开发运行 (tsx)
pnpm build            # 编译
pnpm typecheck        # 类型检查
pnpm lint             # Biome lint
pnpm format           # Biome 格式化
```

## 工具链

- **Node** ≥ 22（Volta 管理）
- **pnpm**（禁止 npm/yarn）
- **TypeScript** ESNext + ESM
- **Biome**（全局安装，lint + format）
- **es-toolkit** — lodash 兼容替代
