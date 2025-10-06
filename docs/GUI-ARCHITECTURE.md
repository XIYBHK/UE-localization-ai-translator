# PO 翻译工具 GUI 架构设计

> 基于 Tauri + React 的桌面应用版本

## 📋 目录

- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [核心功能](#核心功能)
- [数据流设计](#数据流设计)
- [开发计划](#开发计划)

---

## 🛠 技术栈

### 前端框架
```json
{
  "@tauri-apps/api": "^1.5.0",    // Tauri API
  "@tauri-apps/cli": "^1.5.0",    // Tauri CLI
  "react": "^18.2.0",              // UI 框架
  "react-dom": "^18.2.0",          // React DOM
  "typescript": "^5.3.0"           // 类型系统
}
```

### UI 组件库
```json
{
  "antd": "^5.12.0",               // UI 组件库
  "@ant-design/icons": "^5.2.6",  // 图标库
  "styled-components": "^6.1.0"    // CSS-in-JS
}
```

### 状态管理
```json
{
  "zustand": "^4.4.7",             // 轻量级状态管理
  "immer": "^10.0.3"               // 不可变数据
}
```

### 构建工具
```json
{
  "vite": "^5.0.0",                // 快速构建工具
  "@tauri-apps/cli": "^1.5.0"      // Tauri 构建工具
}
```

### Rust 后端
```toml
[dependencies]
tauri = { version = "1.5", features = ["shell-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
```

### Python 集成
```json
{
  "@tauri-apps/plugin-shell": "^1.0.0",  // 调用 Python 脚本
  "@tauri-apps/plugin-store": "^1.0.0"    // 配置存储
}
```

---

## 📁 项目结构

```
ue-po-ai-translator/
├── tauri-app/                 # GUI 应用目录
│   ├── src-tauri/             # Tauri 后端（Rust）
│   │   ├── src/
│   │   │   ├── main.rs        # Rust 主程序
│   │   │   ├── commands/      # Tauri 命令
│   │   │   │   ├── translator.rs  # 翻译命令
│   │   │   │   ├── file.rs        # 文件操作命令
│   │   │   │   └── config.rs      # 配置命令
│   │   │   ├── services/      # 服务层
│   │   │   │   ├── python_bridge.rs  # Python 桥接
│   │   │   │   └── po_parser.rs     # PO 文件解析
│   │   │   └── utils.rs       # 工具函数
│   │   ├── Cargo.toml         # Rust 依赖配置
│   │   └── tauri.conf.json    # Tauri 配置
│   │
│   ├── src/                   # React 前端
│   │   ├── App.tsx            # 应用根组件
│   │   ├── main.tsx           # 前端入口
│   │   │
│   │   ├── components/        # UI 组件
│   │   │   ├── Layout/
│   │   │   │   ├── AppLayout.tsx      # 主布局
│   │   │   │   ├── MenuBar.tsx        # 菜单栏
│   │   │   │   ├── ToolBar.tsx        # 工具栏
│   │   │   │   └── StatusBar.tsx      # 状态栏
│   │   │   │
│   │   │   ├── EntryList/
│   │   │   │   ├── EntryList.tsx      # 条目列表
│   │   │   │   ├── EntryItem.tsx      # 单个条目
│   │   │   │   └── FilterBar.tsx      # 过滤器
│   │   │   │
│   │   │   ├── Editor/
│   │   │   │   ├── EditorPane.tsx     # 编辑器面板
│   │   │   │   ├── SourceText.tsx     # 原文显示
│   │   │   │   ├── TranslationEditor.tsx  # 译文编辑
│   │   │   │   └── ActionButtons.tsx  # 操作按钮
│   │   │   │
│   │   │   ├── Settings/
│   │   │   │   └── SettingsModal.tsx  # 设置对话框
│   │   │   │
│   │   │   └── Common/
│   │   │       ├── LoadingSpinner.tsx
│   │   │       └── ProgressBar.tsx
│   │   │
│   │   ├── hooks/             # 自定义 Hooks
│   │   │   ├── useTranslator.ts   # 翻译逻辑
│   │   │   ├── useFileOps.ts      # 文件操作
│   │   │   └── useKeyboard.ts     # 快捷键
│   │   │
│   │   ├── store/             # 状态管理
│   │   │   ├── useAppStore.ts     # 应用状态
│   │   │   ├── useEntryStore.ts   # 条目状态
│   │   │   └── useSettingsStore.ts # 设置状态
│   │   │
│   │   ├── types/             # 类型定义
│   │   │   ├── entry.ts
│   │   │   ├── translation.ts
│   │   │   └── tauri.ts
│   │   │
│   │   └── utils/             # 工具函数
│   │       ├── format.ts
│   │       └── validate.ts
│   │
│   ├── public/                # 静态资源
│   │   └── icon.png
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── src/                       # Python 后端（保持原有）
├── tools/
├── docs/
└── README.md
```

---

## 🎨 界面设计

### 主界面布局（类似 Poedit）

```
┌────────────────────────────────────────────────────────────┐
│  [文件] [编辑] [翻译] [视图] [帮助]          [🌙] [⚙️]     │ ← MenuBar
├────────────────────────────────────────────────────────────┤
│  [📂 打开] [💾 保存] [🤖 AI翻译] [📊 报告] [🔄 刷新]      │ ← ToolBar
├─────────────────────┬──────────────────────────────────────┤
│ 📋 条目列表 (30%)   │  📝 翻译编辑区 (70%)                │
│ ┌─────────────────┐ │ ┌──────────────────────────────────┐ │
│ │ 🔍 [搜索过滤]   │ │ │ 原文 (msgid)                     │ │
│ ├─────────────────┤ │ │ XTools|Random                    │ │
│ │ [全部▼] 844条   │ │ │                                  │ │
│ ├─────────────────┤ │ │ Context: Menu/Tools              │ │
│ │ ✅ 1. XTools... │ │ └──────────────────────────────────┘ │
│ │ ⏳ 2. Asset...  │ │ ┌──────────────────────────────────┐ │
│ │ ❌ 3. Config... │ │ │ 译文 (msgstr)                    │ │
│ │ ⚪ 4. Debug...  │ │ │ XTools|随机                      │ │
│ │ ⚪ 5. Export... │ │ │                                  │ │
│ │ ...             │ │ │ [TM 建议] Connection → 连接      │ │
│ │                 │ │ └──────────────────────────────────┘ │
│ │                 │ │                                      │ │
│ │                 │ │ [🤖 AI翻译] [💾 保存] [⏭️ 下一条]   │ │
│ └─────────────────┘ │                                      │ │
├─────────────────────┴──────────────────────────────────────┤
│ 📊 总计: 844 | ✅ 已翻译: 741 (87.8%) | ⏳ 翻译中: 0      │ ← StatusBar
└────────────────────────────────────────────────────────────┘
```

### 图标说明
- ✅ 已翻译
- ⏳ 翻译中
- ❌ 有错误
- ⚪ 未翻译
- 🔍 需审核

---

## 🔄 数据流设计

### 1. 应用启动流程

```mermaid
graph LR
A[启动应用] --> B[加载配置]
B --> C[初始化 Tauri 后端]
C --> D[创建窗口]
D --> E[渲染 React UI]
E --> F[等待用户操作]
```

### 2. 打开文件流程

```typescript
// 用户操作
用户点击 [打开] 
  ↓
前端调用: invoke('file:open')
  ↓
Tauri 后端: 显示文件选择对话框
  ↓
Tauri 后端: 调用 Python 解析 PO 文件
  ↓
Tauri 后端: 返回解析结果
  ↓
前端: 更新 EntryStore
  ↓
界面: 显示条目列表
```

### 3. AI 翻译流程（实时更新）

```typescript
// 批量翻译
用户点击 [AI翻译全部]
  ↓
前端: 发送翻译请求 + 监听进度
  ↓
Tauri 后端: 启动 Python 翻译脚本
  ↓
Python: 逐条翻译并发送进度事件
  ↓
Tauri 后端: 转发进度 → 前端
  ↓
前端: 实时更新条目状态
  ↓
界面: 条目图标变化 ⚪ → ⏳ → ✅
```

### 4. 状态管理（Zustand）

```typescript
// useEntryStore.ts
interface EntryStore {
  entries: Entry[];           // 所有条目
  currentIndex: number;       // 当前选中索引
  filter: FilterType;         // 过滤器
  translating: Set<number>;   // 翻译中的索引
  
  // Actions
  loadFile: (entries: Entry[]) => void;
  updateEntry: (index: number, msgstr: string) => void;
  setTranslating: (index: number, status: boolean) => void;
  selectEntry: (index: number) => void;
  setFilter: (filter: FilterType) => void;
}
```

---

## 🎯 核心功能模块

### 1. MenuBar（菜单栏）

```typescript
// components/Layout/MenuBar.tsx
const menuItems = [
  {
    label: '文件',
    items: [
      { label: '打开PO文件', key: 'open', shortcut: 'Ctrl+O' },
      { label: '保存', key: 'save', shortcut: 'Ctrl+S' },
      { label: '另存为', key: 'saveas', shortcut: 'Ctrl+Shift+S' },
      { label: '导出报告', key: 'export' },
      { type: 'divider' },
      { label: '退出', key: 'quit', shortcut: 'Alt+F4' }
    ]
  },
  {
    label: '翻译',
    items: [
      { label: '翻译当前条目', key: 'translate-current', shortcut: 'Ctrl+T' },
      { label: '翻译全部未翻译', key: 'translate-all', shortcut: 'Ctrl+Shift+T' },
      { label: '翻译记忆库', key: 'tm-manager' }
    ]
  },
  {
    label: '视图',
    items: [
      { label: '显示已翻译', key: 'filter-translated', type: 'checkbox' },
      { label: '显示未翻译', key: 'filter-untranslated', type: 'checkbox' },
      { type: 'divider' },
      { label: '放大', key: 'zoom-in', shortcut: 'Ctrl+=' },
      { label: '缩小', key: 'zoom-out', shortcut: 'Ctrl+-' }
    ]
  },
  {
    label: '帮助',
    items: [
      { label: '使用文档', key: 'docs' },
      { label: '快捷键', key: 'shortcuts', shortcut: 'F1' },
      { label: '关于', key: 'about' }
    ]
  }
];
```

### 2. EntryList（条目列表）

```typescript
// components/EntryList/EntryList.tsx
interface EntryListProps {
  entries: Entry[];
  currentIndex: number;
  onSelect: (index: number) => void;
  filter: FilterType;
}

const EntryList: React.FC<EntryListProps> = ({ 
  entries, 
  currentIndex, 
  onSelect,
  filter 
}) => {
  // 过滤逻辑
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      switch(filter) {
        case 'all': return true;
        case 'translated': return entry.msgstr;
        case 'untranslated': return !entry.msgstr;
        case 'translating': return entry.isTranslating;
        default: return true;
      }
    });
  }, [entries, filter]);
  
  return (
    <VirtualList
      data={filteredEntries}
      height={600}
      itemHeight={60}
      renderItem={(entry, index) => (
        <EntryItem
          entry={entry}
          isSelected={index === currentIndex}
          onClick={() => onSelect(index)}
        />
      )}
    />
  );
};
```

### 3. EditorPane（编辑器）

```typescript
// components/Editor/EditorPane.tsx
interface EditorPaneProps {
  entry: Entry | null;
  onSave: (translation: string) => void;
  onTranslate: () => void;
}

const EditorPane: React.FC<EditorPaneProps> = ({
  entry,
  onSave,
  onTranslate
}) => {
  const [translation, setTranslation] = useState('');
  const [tmSuggestions, setTmSuggestions] = useState<string[]>([]);
  
  // 获取 TM 建议
  useEffect(() => {
    if (entry?.msgid) {
      getTMSuggestions(entry.msgid).then(setTmSuggestions);
    }
  }, [entry?.msgid]);
  
  return (
    <div className="editor-pane">
      {/* 原文区 */}
      <SourceText 
        text={entry?.msgid} 
        context={entry?.msgctxt}
      />
      
      {/* 译文编辑区 */}
      <TranslationEditor
        value={translation}
        onChange={setTranslation}
        placeholder="输入翻译..."
      />
      
      {/* TM 建议 */}
      {tmSuggestions.length > 0 && (
        <TMSuggestions 
          suggestions={tmSuggestions}
          onApply={(text) => setTranslation(text)}
        />
      )}
      
      {/* 操作按钮 */}
      <ActionButtons
        onAITranslate={onTranslate}
        onSave={() => onSave(translation)}
        isTranslating={entry?.isTranslating}
      />
    </div>
  );
};
```

### 4. Python Bridge（Python 桥接）

```rust
// src-tauri/src/services/python_bridge.rs
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use serde_json;
use tauri::State;

pub struct PythonBridge {
    python_path: String,
    script_path: String,
}

impl PythonBridge {
    pub fn new() -> Self {
        Self {
            // 开发环境使用系统 Python，生产环境使用打包的 Python
            python_path: if cfg!(debug_assertions) {
                "python".to_string()
            } else {
                "python".to_string() // 生产环境需要配置正确的 Python 路径
            },
            script_path: "../src".to_string(),
        }
    }
    
    /// 解析 PO 文件
    pub async fn parse_po_file(&self, file_path: &str) -> Result<Vec<Entry>, String> {
        let output = Command::new(&self.python_path)
            .args(&[
                &format!("{}/parse_po.py", self.script_path),
                file_path
            ])
            .output()
            .map_err(|e| format!("Failed to execute Python script: {}", e))?;
        
        if output.status.success() {
            let result: Vec<Entry> = serde_json::from_slice(&output.stdout)
                .map_err(|e| format!("Failed to parse JSON: {}", e))?;
            Ok(result)
        } else {
            Err(format!("Python script failed: {}", String::from_utf8_lossy(&output.stderr)))
        }
    }
    
    /// 翻译单条
    pub async fn translate_entry(
        &self,
        text: &str,
        api_key: &str,
    ) -> Result<String, String> {
        let output = Command::new(&self.python_path)
            .args(&[
                &format!("{}/translate_single.py", self.script_path),
                text,
                api_key
            ])
            .output()
            .map_err(|e| format!("Failed to execute Python script: {}", e))?;
        
        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(format!("Python script failed: {}", String::from_utf8_lossy(&output.stderr)))
        }
    }
    
    /// 批量翻译（实时进度）
    pub async fn translate_batch(
        &self,
        texts: Vec<String>,
        api_key: &str,
        on_progress: impl Fn(usize, String) + Send + Sync + 'static,
    ) -> Result<(), String> {
        let mut child = Command::new(&self.python_path)
            .args(&[
                &format!("{}/batch_translate.py", self.script_path),
                "--api-key", api_key,
                "--stdin"
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn Python process: {}", e))?;
        
        // 发送待翻译文本
        if let Some(stdin) = child.stdin.as_mut() {
            let input = serde_json::to_string(&texts)
                .map_err(|e| format!("Failed to serialize input: {}", e))?;
            stdin.write_all(input.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        }
        
        // 监听实时输出
        if let Some(stdout) = child.stdout.take() {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    if let Ok(result) = serde_json::from_str::<serde_json::Value>(&line) {
                        if let (Some(index), Some(translation)) = (
                            result.get("index").and_then(|v| v.as_u64()),
                            result.get("translation").and_then(|v| v.as_str())
                        ) {
                            on_progress(index as usize, translation.to_string());
                        }
                    }
                }
            }
        }
        
        let status = child.wait()
            .map_err(|e| format!("Failed to wait for Python process: {}", e))?;
        
        if status.success() {
            Ok(())
        } else {
            Err("Python translation process failed".to_string())
        }
    }
}

// Tauri 命令
#[tauri::command]
pub async fn parse_po_file(
    file_path: String,
    python_bridge: State<'_, PythonBridge>
) -> Result<Vec<Entry>, String> {
    python_bridge.parse_po_file(&file_path).await
}

#[tauri::command]
pub async fn translate_entry(
    text: String,
    api_key: String,
    python_bridge: State<'_, PythonBridge>
) -> Result<String, String> {
    python_bridge.translate_entry(&text, &api_key).await
}
```

---

## 🎹 快捷键设计

```typescript
// hooks/useKeyboard.ts
const shortcuts = {
  // 文件操作
  'Ctrl+O': 'openFile',
  'Ctrl+S': 'saveFile',
  'Ctrl+Shift+S': 'saveAs',
  
  // 翻译操作
  'Ctrl+T': 'translateCurrent',
  'Ctrl+Shift+T': 'translateAll',
  
  // 导航
  'Ctrl+↑': 'previousEntry',
  'Ctrl+↓': 'nextEntry',
  'Enter': 'saveAndNext',
  
  // 视图
  'Ctrl+=': 'zoomIn',
  'Ctrl+-': 'zoomOut',
  'Ctrl+F': 'search',
  
  // 其他
  'F1': 'showHelp',
  'Esc': 'cancel'
};
```

---

## 📅 开发计划

### Phase 1: 基础框架（1周）
- [ ] 初始化 Tauri + React 项目
- [ ] 配置 TypeScript + Vite
- [ ] 搭建基础 UI 布局
- [ ] 实现基本的菜单和工具栏

### Phase 2: 文件操作（1周）
- [ ] 实现打开/保存 PO 文件
- [ ] 编写 Python Bridge
- [ ] PO 文件解析和显示
- [ ] 条目列表渲染优化

### Phase 3: 编辑功能（1周）
- [ ] 编辑器组件开发
- [ ] 单条目保存
- [ ] 快捷键支持
- [ ] 撤销/重做功能

### Phase 4: AI 翻译（1周）
- [ ] 集成现有 Python 翻译脚本
- [ ] 实时进度更新
- [ ] 批量翻译队列
- [ ] 错误处理

### Phase 5: 翻译记忆库（3天）
- [ ] TM 建议显示
- [ ] TM 管理界面
- [ ] 一键应用建议

### Phase 6: 优化打磨（1周）
- [ ] 性能优化（虚拟列表）
- [ ] UI/UX 优化
- [ ] 设置面板
- [ ] 主题切换（深色模式）

### Phase 7: 打包发布（3天）
- [ ] Windows 打包
- [ ] Mac 打包
- [ ] Linux 打包
- [ ] 自动更新

**总计：约 5-6 周完成 MVP**

---

## 🚀 快速开始

### 初始化项目

```bash
# 创建 tauri-app 目录
mkdir tauri-app
cd tauri-app

# 初始化 Tauri 项目
npm create tauri-app@latest . -- --template react-ts

# 安装依赖
npm install antd zustand immer
npm install @types/node -D

# 安装 Tauri CLI
npm install @tauri-apps/cli -D
```

### 项目配置文件

详见后续的配置文档...

---

## 📚 参考资源

- [Tauri 官方文档](https://tauri.app/)
- [React 官方文档](https://react.dev/)
- [Ant Design](https://ant.design/)
- [Zustand](https://github.com/pmndrs/zustand)
- [Rust 官方文档](https://doc.rust-lang.org/)

---

**下一步：** 创建详细的组件设计文档和 Tauri 命令协议

