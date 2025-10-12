## 架构（简版）

### 核心技术栈

**前端**: React 18 + TypeScript + Ant Design + Zustand + SWR  
**后端**: Tauri **2.8** + Rust (Tokio) + nom parser + 8 AI SDKs  
**构建**: Vite + Vitest（73 测试，82.8% 覆盖率）

### 提升开发效率的核心架构

#### 1️⃣ **三层 API 设计**

```
组件层 (React Hooks)
   ↓ useAsync / useConfig
API 层 (api.ts - 13 模块)
   ↓ 统一错误处理 + 日志
Tauri Commands (52 个)
   ↓ 序列化/反序列化
Rust 服务层 (services/)
```

#### 2️⃣ **类型安全事件总线**

- **UE 风格设计**: `EventMap` 全局类型定义 → 编译时检查
- **双向桥接**: `useTauriEventBridge` 自动连接后端事件到前端 dispatcher
- **调试友好**: 事件历史记录 + 时间戳 + payload 快照

#### 3️⃣ **SWR 数据缓存层**

- 自动缓存配置/TM/术语库（避免重复 IPC 调用）
- 后台重验证（保持数据新鲜）
- 乐观更新（即时 UI 响应）
- 与事件系统集成（数据变更自动失效缓存）

#### 4️⃣ **Channel API 翻译（统一路径）**

```rust
// Rust 端通过 IPC Channel 发送进度和统计
progress_tx.send(ProgressEvent { current, total, entry }).await;
stats_tx.send(StatsEvent { tm_hits, deduplicated, ... }).await;

// 前端 useChannelTranslation 订阅
const { progress, stats } = useChannelTranslation(onProgress);
```

- ✅ 高性能：替代轮询，实时推送
- ✅ 低内存：流式处理，无需缓存全部结果
- ✅ 唯一翻译路径：已移除 Event API

#### 5️⃣ **统计系统 V2（Event Sourcing）**

```
┌─────────────────────────────────────────────────────────────┐
│ Rust Backend (src-tauri)                                    │
├─────────────────────────────────────────────────────────────┤
│ translate_batch_with_channel                                │
│   ├─ AITranslator::translate_batch_with_sources()           │
│   │   ├─ TM 查询 → tm_hits++                                │
│   │   ├─ 去重处理 → deduplicated++                          │
│   │   └─ AI 翻译 → ai_translated++, token 统计              │
│   ├─ 发送统计到 Channel: stats_tx.send()                    │
│   └─ 发送事件: emit('translation:after', stats)             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Frontend Event Bridge (useTauriEventBridge)                 │
├─────────────────────────────────────────────────────────────┤
│ 监听 Tauri Events → 转发到 EventDispatcher                  │
│   ├─ translation:before                                     │
│   ├─ translation-stats-update (Channel)                     │
│   └─ translation:after                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ StatsManagerV2 (事件编排层)                                  │
├─────────────────────────────────────────────────────────────┤
│ 1. translation:before → 生成 taskId                         │
│ 2. translation-stats-update → StatsEngine 聚合会话统计       │
│ 3. translation:after → 更新累计统计（持久化）                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ StatsEngine (事件溯源核心)                                   │
├─────────────────────────────────────────────────────────────┤
│ EventStore                                                  │
│   ├─ 存储所有 StatsEvent（带 eventId/taskId/timestamp）     │
│   ├─ 幂等性去重（同 eventId 只处理一次）                     │
│   └─ 事件聚合器（实时计算会话统计）                          │
│                                                             │
│ 调试工具                                                     │
│   ├─ getEventHistory() - 查看完整事件流                     │
│   ├─ getTaskStats(taskId) - 按任务查询                      │
│   └─ reset() - 清空事件存储                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Zustand Stores (状态管理)                                    │
├─────────────────────────────────────────────────────────────┤
│ useSessionStore                                             │
│   ├─ sessionStats (应用启动时重置)                          │
│   └─ 聚合当前会话所有翻译统计                                │
│                                                             │
│ useStatsStore (持久化到 TauriStore)                          │
│   ├─ cumulativeStats (跨会话累加)                           │
│   └─ 包含完整统计字段（tm_hits/deduplicated/tokens/cost）   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ UI Components (AIWorkspace)                                 │
├─────────────────────────────────────────────────────────────┤
│ 💼 本次会话统计 (sessionStats)                               │
│   ├─ 记忆库命中: X / Y%                                     │
│   ├─ 去重节省: X / Y%                                       │
│   ├─ AI调用: X                                              │
│   └─ 预估费用: ¥X.XX                                        │
│                                                             │
│ 📊 累计统计 (cumulativeStats)                                │
│   ├─ 总计: X                                                │
│   ├─ 命中: X, 去重: X, AI调用: X                            │
│   └─ Token: X,XXX / ¥X.XX                                   │
└─────────────────────────────────────────────────────────────┘
```

**核心特性**:

1. **事件溯源**: 所有统计以事件流存储，可追溯、可审计
2. **幂等性**: 同一事件多次处理结果一致，防止重复计数
3. **双存储分离**: 会话统计（瞬态）+ 累计统计（持久化）
4. **类型安全**: 完整 TypeScript 类型定义 + 编译时检查

#### 6️⃣ **性能优化策略**

- **智能分批**: <10MB 直接加载，10-50MB 500条/批，>50MB 200条/批
- **去重翻译**: 批量去重（减少 70% API 调用）
- **节流更新**: 100ms 进度节流（避免 UI 卡顿）
- **LRU 缓存**: 翻译记忆库模式匹配缓存

#### 7️⃣ **多AI供应商架构（统一API）**

```
┌─────────────────────────────────────────────────┐
│ 模型层 (models/)                                 │
├─────────────────────────────────────────────────┤
│ openai.rs    → get_openai_models()              │
│ moonshot.rs  → get_moonshot_models()            │
│ deepseek.rs  → get_deepseek_models()            │
│   ↓ 返回 Vec<ModelInfo>                         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 成本计算 (CostCalculator)                        │
├─────────────────────────────────────────────────┤
│ calculate_openai(&ModelInfo, ...) → CostBreakdown│
│   ├─ 输入/输出 token                             │
│   ├─ 缓存写入/读取                               │
│   └─ 节省计算 (高达90%)                          │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ AI 翻译器 (AITranslator)                         │
├─────────────────────────────────────────────────┤
│ provider.get_model_info(model_id)               │
│   .expect("模型必须存在")  ← Fail Fast          │
│                                                 │
│ CostCalculator::calculate_openai(...)           │
│   → token_stats.cost (USD)                      │
└─────────────────────────────────────────────────┘
```

**核心设计**：

- **强制 ModelInfo** - 无降级逻辑，模型不存在 = 立即失败
- **统一定价** - USD per 1M tokens，清除所有 CNY 标记
- **精确成本** - 支持缓存定价，30%命中率节省27%成本
- **类型安全** - ts-rs 自动生成 TypeScript 类型

#### 8️⃣ **AI 翻译管线**

```
PO 文件 → nom 解析器 → 去重队列
   ↓
TM 查询（83+ 内置 + 用户自定义）
   ↓
AI 翻译（ModelInfo + CostCalculator 精确计费）
   ↓
TM 更新 + 事件发布 → SWR 失效 → UI 更新
```

### 开发工作流

```bash
npm run tauri:dev  # 自动热重载（Vite HMR + Rust 监控）
npm run test       # Vitest 监听模式
npm run test:ui    # 可视化测试调试
```

**完整文档**: `CLAUDE.md` §Architecture Overview & Development Guidelines
