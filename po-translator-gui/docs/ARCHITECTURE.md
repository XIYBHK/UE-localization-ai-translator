# PO 翻译工具 - 架构文档

> **版本**: v1.0 (Tauri + Rust)  
> **更新日期**: 2025-01-06  
> **架构目标**: 构建高性能、易维护、模块化的桌面翻译工具

---

## 📐 系统架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                      用户界面层 (React)                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │  MenuBar   │  │ EntryList  │  │ EditorPane │             │
│  └────────────┘  └────────────┘  └────────────┘             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │AIWorkspace │  │  Settings  │  │  MemoryMgr │             │
│  └────────────┘  └────────────┘  └────────────┘             │
└────────────────────────┬─────────────────────────────────────┘
                         │ Tauri IPC (invoke)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    命令层 (Rust Commands)                      │
│  • parse_po_file           • save_po_file                    │
│  • translate_batch         • translate_batch_with_stats      │
│  • get_translation_memory  • save_translation_memory         │
│  • get_app_config          • update_app_config               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    服务层 (Rust Services)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  POParser    │  │ AITranslator │  │ Translation  │       │
│  │              │  │              │  │   Memory     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │    Batch     │  │    Config    │                         │
│  │  Translator  │  │   Manager    │                         │
│  └──────────────┘  └──────────────┘                         │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP (reqwest)
                         ▼
              ┌─────────────────────┐
              │   AI API Provider   │
              │  (Moonshot/OpenAI)  │
              └─────────────────────┘
```

---

## 🗂️ 项目结构

### 前端 (TypeScript + React)

```
src/
├── main.tsx                    # 应用入口
├── App.tsx                     # 根组件
├── App.css                     # 全局样式
│
├── components/                 # UI组件层
│   ├── MenuBar.tsx            # 顶部菜单栏（文件、翻译、设置、主题）
│   ├── EntryList.tsx          # 条目列表（三列：未翻译/待确认/已翻译）
│   ├── EditorPane.tsx         # 编辑器面板（原文/译文双栏）
│   ├── AIWorkspace.tsx        # AI工作区（统计、进度）
│   ├── MemoryManager.tsx      # 记忆库管理（CRUD）
│   └── SettingsModal.tsx      # 设置弹窗
│
├── hooks/                      # 自定义Hooks
│   ├── useTranslator.ts       # 翻译逻辑封装
│   └── useTheme.ts            # 主题管理
│
├── store/                      # 状态管理
│   └── useAppStore.ts         # Zustand全局状态
│
├── theme/                      # 主题配置
│   └── config.ts              # 亮色/暗色主题
│
├── i18n/                       # 国际化
│   ├── config.ts              # i18next配置
│   └── locales/
│       ├── zh-CN.json         # 中文
│       └── en-US.json         # 英文
│
└── types/                      # 类型定义
    └── tauri.ts               # Tauri类型
```

### 后端 (Rust)

```
src-tauri/src/
├── main.rs                     # 主入口，注册commands
│
├── commands/                   # Tauri命令层
│   ├── mod.rs                 # 模块导出
│   └── translator.rs          # 翻译相关命令
│       ├── parse_po_file()
│       ├── save_po_file()
│       ├── translate_batch()
│       ├── translate_batch_with_stats()
│       ├── get_translation_memory()
│       ├── save_translation_memory()
│       ├── get_app_config()
│       ├── update_app_config()
│       └── validate_config()
│
└── services/                   # 业务逻辑层
    ├── mod.rs                 # 模块导出
    ├── po_parser.rs           # PO文件解析/写入
    ├── ai_translator.rs       # AI翻译核心
    ├── translation_memory.rs  # 翻译记忆库
    ├── batch_translator.rs    # 批量翻译
    └── config_manager.rs      # 配置管理
```

---

## 🔄 数据流设计

### 1. 文件加载流程

```
用户点击"打开" 
  → MenuBar.onOpenFile()
  → invoke('parse_po_file', { filePath })
  → POParser.parse_file()
  → 返回 Vec<POEntry>
  → useAppStore.setEntries()
  → 更新UI (EntryList + EditorPane)
```

### 2. 翻译流程（带统计）

```
用户点击"批量翻译"
  → MenuBar.onTranslateAll()
  → 收集未翻译条目
  → invoke('translate_batch_with_stats', { texts, apiKey })
  
后端处理：
  1. TranslationMemory.preprocess()     # TM命中查找
  2. 文本去重 (HashMap<String, Vec<usize>>)
  3. AITranslator.translate_batch()     # 调用AI
  4. is_simple_phrase() 判断            # 决定是否学习
  5. TranslationMemory.add_translation() # 学习新短语
  6. 返回 TranslationStats
  
前端更新：
  → updateEntry(index, { msgstr, needsReview: true })
  → setTranslationStats(stats)
  → 显示统计信息
```

### 3. 记忆库管理流程

```
打开记忆库
  → invoke('get_translation_memory')
  → TranslationMemory { memory: IndexMap, stats, last_updated }
  → Object.entries(memory) → MemoryEntry[]
  → 显示列表

保存记忆库
  → 构造 { memory, stats, last_updated }
  → invoke('save_translation_memory', data)
  → TranslationMemory.save_to_file()
  → 分离内置/学习部分
  → 只保存 learned 字段（JSON格式）
```

---

## 🧩 核心模块详解

### 1. POParser (po_parser.rs)

**职责**: PO文件的解析和写入

**关键方法**:
- `parse_file(path) -> Vec<POEntry>` - 解析PO文件
- `write_file(path, entries)` - 写入PO文件
- `parse_entry()` - 解析单个条目
- `detect_encoding()` - 检测文件编码

**特性**:
- ✅ 支持多种编码（UTF-8, GBK等）
- ✅ 保留注释和格式
- ✅ 处理msgctxt上下文

---

### 2. AITranslator (ai_translator.rs)

**职责**: 调用AI进行翻译，管理对话历史

**核心字段**:
```rust
struct AITranslator {
    client: Client<OpenAIConfig>,    // OpenAI客户端
    model: String,                   // 模型名称
    conversation_history: Vec<ChatCompletionRequestMessage>,
    tm: Option<TranslationMemory>,   // 翻译记忆库
    token_stats: TokenStats,         // Token统计
    batch_stats: BatchStats,         // 批次统计
}
```

**关键流程**:
1. **预处理**: TM查找 + 去重
2. **AI翻译**: 批量调用API
3. **后处理**: 学习新短语 + 统计

**is_simple_phrase()规则** (与Python严格一致):
- 长度 ≤ 35字符
- 单词数 ≤ 5个
- 无句子标点 (`. ! ?`)
- 无占位符 (`{0}`)
- 无转义字符 (`\n`)
- 无特殊符号 (`( ) [ ]`)
- 非疑问句开头

---

### 3. TranslationMemory (translation_memory.rs)

**职责**: 管理翻译记忆库，提供TM查找和学习

**数据结构**:
```rust
struct TranslationMemory {
    memory: IndexMap<String, String>,  // 保持插入顺序
    stats: MemoryStats,
    last_updated: DateTime<Utc>,
}
```

**内置短语**: 83个UE相关术语
```rust
// XTools 命名空间
"XTools|Random" → "XTools|随机"
"XTools|Sort" → "XTools|排序"
...

// 常见术语
"Connection" → "连接"
"Ascending" → "升序"
...
```

**保存格式** (与Python一致):
```json
{
  "learned": {
    "Custom Phrase": "自定义短语",
    ...
  },
  "last_updated": "2025-01-06T10:00:00Z",
  "stats": {
    "total_entries": 95,
    "learned_entries": 12,
    "builtin_entries": 83
  }
}
```

**关键**: 只保存学习的部分，不保存内置短语

---

### 4. BatchTranslator (batch_translator.rs)

**职责**: 批量翻译整个目录

**流程**:
1. 扫描目录获取PO文件
2. 逐个文件翻译
3. 生成报告
4. 保存TM

---

### 5. ConfigManager (config_manager.rs)

**职责**: 管理应用配置

**配置项**:
```rust
struct AppConfig {
    api_key: String,
    provider: String,              // moonshot/openai
    model: String,
    base_url: Option<String>,
    use_translation_memory: bool,
    translation_memory_path: Option<String>,
    batch_size: usize,
    max_concurrent: usize,
    timeout_seconds: u64,
    auto_save: bool,
    log_level: String,
}
```

**存储位置**: `~/.po-translator/config.json`

---

## 🎨 状态管理 (Zustand)

### 全局状态结构

```typescript
interface AppState {
  // 文件状态
  entries: POEntry[]           // 所有条目
  currentEntry: POEntry | null // 当前编辑条目
  currentIndex: number         // 当前索引
  
  // 翻译状态
  isTranslating: boolean       // 是否正在翻译
  progress: number             // 翻译进度 (0-100)
  report: TranslationReport | null
  
  // 配置
  config: AppConfig | null
  
  // UI状态（持久化）
  theme: 'light' | 'dark'
  language: 'zh-CN' | 'en-US'
  
  // Actions
  setEntries, updateEntry, setCurrentEntry,
  setTranslating, setProgress, setReport,
  toggleTheme, setLanguage, ...
}
```

### 持久化策略

**持久化**: `theme`, `language` (localStorage)  
**临时**: 其他状态 (内存)

---

## 🎯 关键设计原则

### 1. 数据一致性

**问题**: Rust和前端的数据格式必须严格匹配

**解决方案**:
- Rust: 使用 `#[derive(Serialize, Deserialize)]`
- TypeScript: 定义匹配的接口
- 通过 `types/tauri.ts` 统一管理

### 2. 翻译记忆库逻辑

**核心规则** (必须与Python版本一致):
1. **加载**: 内置短语 + 学习部分
2. **保存**: 只保存学习部分
3. **学习**: 只学习简单短语（is_simple_phrase()）
4. **去重**: 用IndexMap保持插入顺序

### 3. 主题系统

**实现方式**:
- ConfigProvider (Ant Design) - 组件级主题
- CSS `[data-theme]` 属性 - 自定义样式
- `useTheme` hook - 语义化颜色

**颜色系统**:
```typescript
semanticColors = {
  light: {
    bgPrimary: '#ffffff',
    textPrimary: 'rgba(0,0,0,0.88)',
    ...
  },
  dark: {
    bgPrimary: '#141414',
    textPrimary: 'rgba(255,255,255,0.88)',
    ...
  }
}
```

### 4. 错误处理

**前端**:
```typescript
try {
  const result = await invoke('command', params);
} catch (error) {
  message.error('操作失败');
  console.error(error);
}
```

**后端**:
```rust
#[tauri::command]
pub async fn command() -> Result<Data, String> {
    some_operation()
        .map_err(|e| e.to_string())
}
```

---

## 🔧 常见问题及解决方案

### 1. 翻译后自动重启

**原因**: `src-tauri/data/` 文件变化触发热重载

**解决**: 改用 `../data/` (项目根目录)

### 2. 记忆库清空报错

**原因**: 前端未保存空数据，后端加载失败

**解决**: 清空时立即保存空的 `learned: {}`

### 3. 暗色模式不生效

**原因**: 硬编码颜色值，未使用主题变量

**解决**: 全部使用 `colors.xxx` 语义化颜色

### 4. 词条排序混乱

**原因**: HashMap无序，每次加载顺序不同

**解决**: 使用 IndexMap 保持插入顺序

---

## 📊 性能优化

### 1. 翻译优化

- ✅ TM预查找（避免重复API调用）
- ✅ 文本去重（相同文本只翻译一次）
- ✅ 批量翻译（减少网络往返）
- ✅ 智能学习（只学习简单短语）

### 2. UI优化

- ✅ 虚拟滚动（大数据量）- 可选
- ✅ 状态本地化（减少重渲染）
- ✅ 懒加载组件
- ✅ Debounce搜索

### 3. 内存优化

- ✅ Rust无GC（低内存占用）
- ✅ 增量更新（不重新创建数组）
- ✅ 及时释放资源

---

## 🚀 部署架构

### 开发模式

```
npm run tauri:dev
  → Vite Dev Server (前端热重载)
  → Cargo (Rust编译 + 热重载)
  → Tauri窗口 (WebView)
```

### 生产构建

```
npm run tauri:build
  → TypeScript编译
  → Vite打包 (dist/)
  → Cargo release编译
  → 打包为单一可执行文件
  → 输出: PO翻译工具.exe (~15MB)
```

---

## 📝 开发规范

### 1. 命名约定

**Rust**:
- 文件: `snake_case.rs`
- 结构体: `PascalCase`
- 函数: `snake_case`
- 常量: `UPPER_SNAKE_CASE`

**TypeScript**:
- 文件: `PascalCase.tsx` (组件) / `camelCase.ts` (工具)
- 组件: `PascalCase`
- 函数: `camelCase`
- 常量: `UPPER_SNAKE_CASE`

### 2. 提交规范

```
feat: 新功能
fix: 修复bug
refactor: 重构
docs: 文档更新
style: 代码格式
perf: 性能优化
test: 测试相关
```

### 3. 代码组织

- 一个功能一个文件
- 相关功能放在同一目录
- 公共逻辑抽取到 utils/hooks
- 类型定义集中管理

---

## 🔮 未来扩展

### 计划功能

- [ ] 多语言翻译（不仅中英）
- [ ] 术语库管理
- [ ] 翻译审核流程
- [ ] 协作翻译（多人）
- [ ] 云端同步
- [ ] 插件系统

### 技术演进

- [ ] 升级到 Tauri v2
- [ ] 使用 SWC 替代 Babel
- [ ] WebAssembly 加速
- [ ] 本地AI模型支持

---

## 📚 参考文档

- [Tauri 官方文档](https://tauri.app/)
- [Ant Design React](https://ant.design/)
- [Zustand 状态管理](https://github.com/pmndrs/zustand)
- [async-openai](https://docs.rs/async-openai/)
- [IndexMap](https://docs.rs/indexmap/)

---

**维护者**: PO-i10n Team  
**最后更新**: 2025-01-06

