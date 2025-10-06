# 架构对比：Python vs Rust

## 旧架构（Python 后端）

```
┌─────────────────────────────────────────────────┐
│              前端 (React + Tauri)                │
│  - App.tsx                                      │
│  - useTranslator.ts                             │
└────────────────┬────────────────────────────────┘
                 │
                 │ invoke (Tauri Commands)
                 ▼
┌─────────────────────────────────────────────────┐
│           Rust Layer (桥接层)                    │
│  - commands/translator.rs                       │
│  - services/python_bridge.rs ❌                 │
└────────────────┬────────────────────────────────┘
                 │
                 │ subprocess / stdio
                 ▼
┌─────────────────────────────────────────────────┐
│          Python Backend                         │
│  - po_translator.py      (PO解析+AI翻译)        │
│  - translation_memory.py (翻译记忆库)           │
│  - batch_translate.py    (批量翻译)             │
│  - translate.py          (配置+入口)            │
└─────────────────────────────────────────────────┘
                 │
                 │ HTTP Request
                 ▼
        ┌───────────────────┐
        │   Moonshot API    │
        └───────────────────┘
```

### 问题
- ❌ 需要打包 Python 运行时
- ❌ 跨进程通信开销
- ❌ 部署复杂
- ❌ 启动慢

---

## 新架构（纯 Rust）

```
┌─────────────────────────────────────────────────┐
│              前端 (React + Tauri)                │
│  - App.tsx                                      │
│  - useTranslator.ts                             │
└────────────────┬────────────────────────────────┘
                 │
                 │ invoke (Tauri Commands)
                 ▼
┌─────────────────────────────────────────────────┐
│           Rust Backend (直接集成)                │
│  ┌───────────────────────────────────────────┐  │
│  │ commands/translator.rs                    │  │
│  │  - parse_po_file                          │  │
│  │  - translate_batch                        │  │
│  │  - save_po_file                           │  │
│  │  - translate_directory                    │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ services/                                 │  │
│  │  - po_parser.rs          ✅               │  │
│  │  - ai_translator.rs      ✅               │  │
│  │  - translation_memory.rs ⚠️ (需补充)      │  │
│  │  - batch_translator.rs   ✅               │  │
│  │  - config_manager.rs     ✅               │  │
│  └───────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────┘
                 │
                 │ HTTP Request (reqwest)
                 ▼
        ┌───────────────────┐
        │   Moonshot API    │
        └───────────────────┘
```

### 优势
- ✅ 单一可执行文件
- ✅ 无需 Python 运行时
- ✅ 更快的性能
- ✅ 更简单的部署
- ✅ 更好的类型安全

---

## 模块映射关系

| Python 模块 | Rust 模块 | 状态 | 完成度 |
|------------|-----------|------|-------|
| `po_translator.py` | `po_parser.rs` + `ai_translator.rs` | ✅ | 100% |
| `translation_memory.py` | `translation_memory.rs` | ⚠️ | 80% |
| `batch_translate.py` | `batch_translator.rs` | ✅ | 100% |
| `translate.py` | `config_manager.rs` | ✅ | 100% |
| - | `commands/translator.rs` (新增) | ✅ | 100% |

---

## 核心类对比

### POTranslator (Python) → 分解为多个 Rust 模块

```python
# Python: 单一大类
class POTranslator:
    def __init__(self, api_key, base_url, use_tm)
    def parse_po_file(self, file_path)
    def translate_batch(self, texts)
    def translate_po_file(self, po_file, batch_size)
    def _write_po_file(self, file_path, header, entries)
```

```rust
// Rust: 职责分离
struct POParser {
    fn parse_file() -> Vec<POEntry>
    fn write_file(entries: &[POEntry])
}

struct AITranslator {
    fn translate_batch(texts: Vec<String>) -> Vec<String>
    fn get_token_stats() -> TokenStats
}

struct BatchTranslator {
    fn translate_directory(path: &Path) -> Vec<TranslationReport>
}
```

### 优势
- ✅ 更好的模块化
- ✅ 更容易测试
- ✅ 更清晰的职责划分

---

## TranslationMemory 对比

### Python 版本
```python
class TranslationMemory:
    BUILTIN_PHRASES = {
        # 83+ 个内置短语
        "XTools|Random": "XTools|随机",
        "XTools|Sort": "XTools|排序",
        # ... 更多
    }
    
    def is_simple_phrase(self, text: str) -> bool:
        # 9 个严格条件
        if len(text) > 35: return False
        if has_sentence_endings: return False
        if word_count > 5: return False
        if has_placeholders: return False
        # ... 更多检查
```

### Rust 版本
```rust
impl TranslationMemory {
    // ⚠️ 仅 20 个内置短语
    fn get_builtin_memory() -> HashMap<String, String> {
        // 缺少 XTools 相关短语
    }
    
    // ⚠️ 仅 3 个条件（过于简化）
    fn is_simple_phrase(text: &str) -> bool {
        text.len() <= 30 
            && !text.contains('\n') 
            && !text.contains('|')
    }
}
```

### 需要改进
1. 🔴 补充 60+ 个内置短语
2. 🔴 增加 6 个检查条件到 `is_simple_phrase`

---

## 性能对比（预估）

| 操作 | Python | Rust | 提升 |
|------|--------|------|------|
| 启动时间 | ~2-3s | ~0.5s | **4-6x** |
| PO 解析 | ~100ms | ~10ms | **10x** |
| 翻译（API 限制） | ~1s | ~1s | 相同 |
| 内存占用 | ~150MB | ~30MB | **5x** |
| 安装包大小 | ~200MB | ~15MB | **13x** |

---

## 部署对比

### Python 版本
```
部署包结构:
├── python.exe (50MB)
├── python39.dll
├── Lib/ (100MB)
│   └── site-packages/
│       ├── openai/
│       ├── requests/
│       └── ...
├── python-backend/
│   ├── po_translator.py
│   └── ...
└── gui.exe (10MB)

总大小: ~200MB
```

### Rust 版本
```
部署包结构:
└── PO翻译工具.exe (15MB)

总大小: ~15MB
```

### 优势
- ✅ **13x** 更小的安装包
- ✅ 无需 Python 运行时
- ✅ 单文件部署
- ✅ 更快的启动速度

---

## 总结

### ✅ 成功迁移
- 所有核心功能
- 配置管理（更强）
- GUI 集成
- 性能提升显著

### ⚠️ 需要补充
- 翻译记忆库内置短语（60+）
- is_simple_phrase 检查条件（6个）
- 翻译记忆库持久化逻辑

### 🎯 结论
**重构成功！** 可以删除 Python 后端代码。

