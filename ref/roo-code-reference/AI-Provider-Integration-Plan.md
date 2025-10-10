# 🚀 ai-l10n-studio 多AI供应商集成技术方案

> 基于 [Roo-Code](https://github.com/RooVetGit/Roo-Cline) 的成熟架构设计
> 
> 项目地址：https://github.com/XIYBHK/ai-l10n-studio

---

## 📋 目录

- [设计哲学](#设计哲学)
- [需求概述](#需求概述)
- [技术架构](#技术架构)
- [核心功能设计](#核心功能设计)
- [数据结构定义](#数据结构定义)
- [实施计划](#实施计划)
- [参考代码索引](#参考代码索引)

---

## 💡 设计哲学

Roo-Code 的 AI 供应商框架展现了生产级系统的 8 大设计理念：

| 理念 | 核心价值 | 技术实现 |
|------|---------|---------|
| 🔄 **容错优先** | 系统可靠性 | 多层缓存、自动重试、Fallback 机制 |
| 💰 **成本透明** | 精确计费 | 逐 Token 计算、支持分层定价、缓存成本追踪 |
| 🔌 **高扩展性** | 易于维护 | 统一 Provider 接口、插件化架构 |
| 🎛️ **灵活配置** | 企业适配 | 多种认证方式、自定义端点、代理支持 |
| ⚡ **性能优化** | 用户体验 | Worker 线程、流式响应、智能缓存 |
| 🧠 **智能适配** | 自动化 | 模型特性识别、动态参数调整、ARN 解析 |
| 🔒 **安全合规** | 企业级 | VPC 支持、私有部署、多种认证、凭证安全 |
| 📈 **可观测性** | 运维友好 | Token 追踪、成本统计、审计日志 |

**本方案将这些经过实战验证的设计理念融入 ai-l10n-studio 项目！**

---

## ⚠️ 翻译项目的简化建议

### 🎯 必需功能（MVP）

| 功能 | 优先级 | 理由 |
|------|--------|------|
| 基础 Provider 接口 | ⭐⭐⭐ | 核心架构，必须有 |
| 成本计算（基础） | ⭐⭐⭐ | 用户核心需求 |
| 2-3个主流供应商 | ⭐⭐⭐ | OpenAI + DeepSeek 足够 |
| 简单缓存（内存） | ⭐⭐⭐ | 避免重复获取模型列表 |
| 基础错误处理 | ⭐⭐⭐ | 保证可用性 |

### ✅ 推荐功能（增强体验）

| 功能 | 优先级 | 理由 |
|------|--------|------|
| 模型列表动态获取 | ⭐⭐ | 用户体验好，但可静态配置 |
| 缓存命中率统计 | ⭐⭐ | 有助于节省成本 |
| 成本历史记录 | ⭐⭐ | 便于预算管理 |
| 自动重试（简单） | ⭐⭐ | 提高稳定性 |

### 🔧 可选功能（按需实现）

| 功能 | 优先级 | 建议 |
|------|--------|------|
| 4个以上供应商 | ⭐ | 翻译场景2-3个够用 |
| 文件缓存持久化 | ⭐ | 内存缓存即可，5分钟TTL |
| 复杂重试策略 | ⭐ | 简单重试1-2次足够 |

### ❌ 可能过度设计的部分

| 功能 | 原因 | 简化建议 |
|------|------|---------|
| **Worker 线程** | 翻译不需要高并发 | ❌ 不需要，Rust异步即可 |
| **流式响应** | 批量翻译不需要实时显示 | ❌ 可选，使用普通请求 |
| **ARN 解析** | 只有 AWS Bedrock 需要 | ❌ 跳过，不支持 Bedrock |
| **多点缓存策略** | 翻译上下文简单 | ❌ 不需要，单缓存点够用 |
| **推理预算控制** | o1/DeepSeek-R1特有 | ❌ 暂时不需要 |
| **VPC/私有部署** | 企业级需求 | ❌ 个人工具不需要 |
| **Vertex AI 认证** | Google 企业认证 | ❌ 只用 API Key 即可 |
| **审计日志** | 合规需求 | ❌ 基础统计即可 |
| **复杂分层定价** | 模型动态调价 | ⚠️ 简化：只支持固定价格 |

### 📝 实施建议

**阶段1（MVP）- 2周**
```rust
// 只实现核心功能
✅ ModelInfo 基础结构（无 tiers）
✅ 2个 Provider（OpenAI + DeepSeek）
✅ 基础成本计算（无缓存成本）
✅ 简单内存缓存（HashMap）
✅ 基本错误处理
```

**阶段2（增强）- 1-2周**
```rust
// 添加体验优化
✅ 模型动态获取（简单版）
✅ 缓存成本计算
✅ 历史记录（JSON文件）
✅ 简单重试（1次）
```

**阶段3（可选）- 按需**
```rust
// 根据用户反馈决定
⭐ 添加第3个供应商
⭐ UI 美化
⭐ 导出报表
```

### 🎯 关键简化原则

1. **翻译 ≠ 对话** - 不需要复杂的上下文管理
2. **批量 > 实时** - 可以等待完成，不需要流式
3. **简单够用** - 2-3个供应商覆盖99%场景
4. **成本优先** - 重点是成本透明，不是高级特性

---

## 🎯 需求概述（MVP）

### 核心需求

1. **多AI供应商支持**（2-3个供应商）
   - ✅ OpenAI + DeepSeek（必需）
   - ✅ 用户可自行输入 API 密钥
   - ✅ 动态切换供应商
   - ✅ 供应商配置持久化

2. **模型信息展示**
   - ✅ 模型参数提示（上下文窗口、最大输出Token）
   - ✅ 实时价格显示（输入/输出价格）
   - ✅ 推荐模型标记

3. **成本预计算与统计**
   - ✅ 翻译前成本预估
   - ✅ 实时Token使用统计
   - ✅ 简单的历史成本记录

### 供应商清单

| 优先级 | 供应商 | 优势 | 适用场景 | 价格级别 |
|-------|--------|------|---------|---------|
| ⭐⭐⭐ | **OpenAI** | 质量最高，稳定可靠 | 重要文档翻译 | $$$ |
| ⭐⭐⭐ | **DeepSeek** | 中文优化，性价比极高 | 中文翻译，大批量 | $ |
| ⭐⭐ | **Moonshot** | 国内服务，长上下文（200K） | 大型PO文件 | $$ |
| ⭐⭐ | **Gemini** | Google服务，免费额度高 | 测试和开发 | $-$$ |
| ⭐⭐ | **智谱 GLM** | 国内主流，中文优化 | 国内用户 | $$ |
| ⭐ | **Ollama** | 本地部署，完全免费 | 离线、隐私场景 | FREE |

**实施策略**：
- **阶段1（MVP - 2周）**：实现 OpenAI + DeepSeek（2个）
- **阶段2（扩展 - 1周）**：添加 Moonshot + 智谱（国内用户）
- **阶段3（完善 - 1周）**：添加 Gemini + Ollama（可选）

---

## 🏗️ 技术架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 (React + TypeScript)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 供应商选择器 │  │ 模型信息卡片 │  │ 成本统计面板 │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                  │
│                      Tauri Commands                          │
│                            │                                  │
└────────────────────────────┼──────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────┐
│                     后端 (Rust + Tauri)                       │
│                            │                                  │
│  ┌─────────────────────────▼────────────────────────────┐   │
│  │              AI Provider Manager                       │   │
│  │  ┌──────────────────────────────────────────────┐    │   │
│  │  │          Provider Registry                     │    │   │
│  │  │  - 注册所有供应商                              │    │   │
│  │  │  - 工厂模式创建实例                            │    │   │
│  │  └──────────────────────────────────────────────┘    │   │
│  └──────────────┬────────────────────────┬──────────────┘   │
│                 │                        │                   │
│    ┌────────────▼──────────┐  ┌─────────▼────────────┐     │
│    │   Provider Trait       │  │   Model Info Cache   │     │
│    │  - translate()         │  │  - 内存缓存 (5min)   │     │
│    │  - list_models()       │  │  - 文件缓存 (持久)   │     │
│    │  - test_connection()   │  │  - 价格信息          │     │
│    └────────────┬──────────┘  └──────────────────────┘     │
│                 │                                            │
│    ┌────────────▼──────────────────────────────────┐       │
│    │         Concrete Providers (6个)              │       │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │       │
│    │  │ OpenAI   │  │ DeepSeek │  │ Moonshot │   │       │
│    │  └──────────┘  └──────────┘  └──────────┘   │       │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────┐   │       │
│    │  │  Gemini  │  │ 智谱GLM  │  │  Ollama  │   │       │
│    │  └──────────┘  └──────────┘  └──────────┘   │       │
│    └────────────────────────────────────────────┘       │
│                            │                              │
│    ┌────────────────────────▼─────────────────────────┐  │
│    │           Cost Calculator & Tracker               │  │
│    │  - calculate_translation_cost()                   │  │
│    │  - track_usage()                                  │  │
│    │  - generate_report()                              │  │
│    └───────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### 目录结构设计

```
src-tauri/src/
├── services/
│   ├── ai/                          # 🆕 AI供应商模块
│   │   ├── mod.rs                   # 模块导出
│   │   ├── provider.rs              # Provider trait定义
│   │   ├── model_info.rs            # 模型信息结构
│   │   ├── manager.rs               # Provider管理器
│   │   ├── factory.rs               # Provider工厂
│   │   │
│   │   ├── providers/               # 各供应商实现（6个）
│   │   │   ├── mod.rs
│   │   │   ├── openai.rs            # OpenAI (gpt-4o-mini等)
│   │   │   ├── deepseek.rs          # DeepSeek (deepseek-chat)
│   │   │   ├── moonshot.rs          # Moonshot (kimi)
│   │   │   ├── gemini.rs            # Google Gemini
│   │   │   ├── zhipu.rs             # 智谱 GLM (glm-4-flash等)
│   │   │   └── ollama.rs            # Ollama 本地部署
│   │   │
│   │   ├── cache/                   # 缓存系统
│   │   │   ├── mod.rs
│   │   │   ├── model_cache.rs       # 模型列表缓存
│   │   │   └── memory_cache.rs      # 通用内存缓存
│   │   │
│   │   └── cost/                    # 成本追踪
│   │       ├── mod.rs
│   │       ├── calculator.rs        # 成本计算器
│   │       ├── tracker.rs           # 使用统计
│   │       └── report.rs            # 报表生成
│   │
│   ├── ai_translator.rs             # 修改：使用新架构
│   ├── translation_memory.rs        # 保持不变
│   ├── batch_translator.rs          # 修改：集成成本追踪
│   ├── po_parser.rs                 # 保持不变
│   └── config_manager.rs            # 修改：支持多供应商配置
│
├── commands/                        # Tauri命令
│   ├── ai_commands.rs               # 🆕 AI相关命令
│   └── ...
│
└── main.rs                          # 注册命令

src/
├── components/
│   ├── settings/
│   │   ├── ProviderSelector.tsx     # 🆕 供应商选择器
│   │   ├── ModelInfoCard.tsx        # 🆕 模型信息卡片
│   │   └── ApiKeyInput.tsx          # 🆕 密钥输入组件
│   │
│   ├── cost/
│   │   ├── CostEstimator.tsx        # 🆕 成本预估器
│   │   ├── CostTracker.tsx          # 🆕 成本追踪面板
│   │   └── UsageChart.tsx           # 🆕 使用统计图表
│   │
│   └── SettingsModal.tsx            # 修改：集成新组件
│
├── hooks/
│   ├── useAIProviders.ts            # 🆕 供应商管理Hook
│   └── useCostTracking.ts           # 🆕 成本追踪Hook
│
└── types/
    ├── ai.ts                        # 🆕 AI相关类型
    └── cost.ts                      # 🆕 成本相关类型
```

---

## 💎 核心功能设计

### 1. Provider Trait（统一接口）

```rust
// src-tauri/src/services/ai/provider.rs

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// 模型信息（简化版）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
    
    // 技术参数
    pub context_window: usize,
    pub max_output_tokens: usize,
    
    // 💰 定价信息（每百万token，USD）
    pub input_price: f64,
    pub output_price: f64,
    
    // UI展示
    pub description: Option<String>,
    pub recommended: bool,
}

/// 翻译请求
#[derive(Debug, Clone)]
pub struct TranslationRequest {
    pub source_text: String,
    pub source_lang: String,
    pub target_lang: String,
    pub context: Option<String>,
    pub glossary: Option<Vec<GlossaryEntry>>,
}

/// 翻译响应（简化版）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationResponse {
    pub translated_text: String,
    
    // Token使用统计
    pub input_tokens: usize,
    pub output_tokens: usize,
    
    // 成本信息
    pub cost_usd: f64,
    
    // 元数据
    pub model_used: String,
    pub timestamp: i64,
}

/// AI供应商统一接口（简化版）
#[async_trait]
pub trait AIProvider: Send + Sync {
    /// 供应商标识
    fn provider_id(&self) -> &str;
    
    /// 供应商名称（用于UI显示）
    fn provider_name(&self) -> &str;
    
    /// 获取可用模型列表（静态配置）
    fn list_models(&self) -> Vec<ModelInfo>;
    
    /// 执行翻译
    async fn translate(&self, request: TranslationRequest) -> Result<TranslationResponse, ProviderError>;
}

/// 供应商错误类型
#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("API密钥无效")]
    InvalidApiKey,
    
    #[error("模型不存在: {0}")]
    ModelNotFound(String),
    
    #[error("请求失败: {0}")]
    RequestFailed(String),
    
    #[error("网络错误: {0}")]
    NetworkError(String),
    
    #[error("未知错误: {0}")]
    Unknown(String),
}
```

### 2. 成本计算器（简化版）

```rust
// src-tauri/src/services/ai/cost/calculator.rs

use super::super::model_info::ModelInfo;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostBreakdown {
    pub input_tokens: usize,
    pub output_tokens: usize,
    pub input_cost: f64,
    pub output_cost: f64,
    pub total_cost: f64,
}

pub struct CostCalculator;

impl CostCalculator {
    /// 计算单次翻译成本（简化版）
    pub fn calculate(
        model: &ModelInfo,
        input_tokens: usize,
        output_tokens: usize,
    ) -> CostBreakdown {
        // 计算成本（USD per million tokens）
        let input_cost = model.input_price * (input_tokens as f64 / 1_000_000.0);
        let output_cost = model.output_price * (output_tokens as f64 / 1_000_000.0);
        let total = input_cost + output_cost;
        
        CostBreakdown {
            input_tokens,
            output_tokens,
            input_cost,
            output_cost,
            total_cost: total,
        }
    }
    
    /// 估算批量翻译成本
    pub fn estimate_batch_cost(
        model: &ModelInfo,
        total_chars: usize,
    ) -> f64 {
        // 简单估算：
        // 1. 平均 4 字符 = 1 token
        // 2. 输出通常与输入相近（翻译场景）
        
        let estimated_input_tokens = (total_chars / 4) as f64;
        let estimated_output_tokens = estimated_input_tokens * 1.0;
        
        let input_cost = model.input_price * (estimated_input_tokens / 1_000_000.0);
        let output_cost = model.output_price * (estimated_output_tokens / 1_000_000.0);
        
        input_cost + output_cost
    }
}
```

### 3. 成本追踪器

```rust
// src-tauri/src/services/ai/cost/tracker.rs（简化版）

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageRecord {
    pub timestamp: i64,
    pub provider: String,
    pub model: String,
    pub input_tokens: usize,
    pub output_tokens: usize,
    pub cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStats {
    pub total_cost: f64,
    pub total_input_tokens: usize,
    pub total_output_tokens: usize,
    pub translation_count: usize,
    pub avg_cost_per_translation: f64,
}

pub struct CostTracker {
    records: Vec<UsageRecord>,
}

impl CostTracker {
    pub fn new() -> Self {
        Self {
            records: Vec::new(),
        }
    }
    
    /// 记录一次翻译使用
    pub fn track(
        &mut self,
        provider: &str,
        model: &str,
        input_tokens: usize,
        output_tokens: usize,
        cost: f64,
    ) {
        let record = UsageRecord {
            timestamp: chrono::Utc::now().timestamp(),
            provider: provider.to_string(),
            model: model.to_string(),
            input_tokens,
            output_tokens,
            cost,
        };
        
        self.records.push(record);
    }
    
    /// 获取统计数据
    pub fn get_stats(&self) -> UsageStats {
        let total_cost: f64 = self.records.iter().map(|r| r.cost).sum();
        let total_input: usize = self.records.iter().map(|r| r.input_tokens).sum();
        let total_output: usize = self.records.iter().map(|r| r.output_tokens).sum();
        let count = self.records.len();
        
        let avg_cost = if count > 0 {
            total_cost / count as f64
        } else {
            0.0
        };
        
        UsageStats {
            total_cost,
            total_input_tokens: total_input,
            total_output_tokens: total_output,
            translation_count: count,
            avg_cost_per_translation: avg_cost,
        }
    }
    
    /// 清空记录
    pub fn clear(&mut self) {
        self.records.clear();
    }
}
```

### 4. 前端类型定义

```typescript
// src/types/ai.ts

export interface AIProvider {
  id: string;
  name: string;
  icon: string;
  description: string;
  requiresApiKey: boolean;
  supportedModels: ModelInfo[];
  status: 'available' | 'configured' | 'error';
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  
  // 技术参数
  contextWindow: number;
  maxOutputTokens: number;
  
  // 定价（USD per million tokens）
  inputPrice: number;
  outputPrice: number;
  
  // UI
  description?: string;
  recommended: boolean;
}

export interface TranslationCost {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface UsageStats {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  translationCount: number;
  avgCostPerTranslation: number;
}
```

---

## 📊 数据结构定义

### 配置文件结构

```json
// config.json
{
  "ai_providers": {
    "current": "openai",
    "configs": {
      "openai": {
        "api_key": "sk-xxx",
        "model": "gpt-4o-mini",
        "base_url": null
      },
      "deepseek": {
        "api_key": "sk-xxx",
        "model": "deepseek-chat",
        "base_url": null
      },
      "moonshot": {
        "api_key": "sk-xxx",
        "model": "moonshot-v1-128k",
        "base_url": null
      },
      "gemini": {
        "api_key": "xxx",
        "model": "gemini-2.0-flash-exp",
        "base_url": null
      },
      "zhipu": {
        "api_key": "xxx.xxx",
        "model": "glm-4-flash",
        "base_url": null
      },
      "ollama": {
        "api_key": null,
        "model": "qwen2.5",
        "base_url": "http://localhost:11434"
      }
    }
  },
  "cost_tracking": {
    "enabled": true,
    "show_estimates": true,
    "show_real_time": true
  }
}
```

---

## 🎯 实施计划

### Phase 1: 基础架构（第1周）

**目标**：搭建多供应商框架

#### 任务清单
- [ ] 创建 `services/ai/` 目录结构
- [ ] 定义 `Provider` trait
- [ ] 实现 `ModelInfo` 数据结构
- [ ] 创建 `ProviderFactory` 工厂模式
- [ ] 实现 `ProviderManager` 管理器
- [ ] 编写单元测试

#### 交付物
- `provider.rs` - Trait定义
- `model_info.rs` - 模型信息结构
- `factory.rs` - 工厂模式
- `manager.rs` - 管理器
- 单元测试通过

---

### Phase 2: 供应商实现（第2周）

**目标**：实现6个供应商

#### 任务清单
- [ ] 实现 OpenAI Provider（gpt-4o-mini）
- [ ] 实现 DeepSeek Provider（deepseek-chat，中文优化）
- [ ] 实现 Moonshot Provider（kimi，国内长上下文）
- [ ] 实现 Gemini Provider（gemini-2.0-flash-exp）
- [ ] 实现 智谱 Provider（glm-4-flash，国内主流）
- [ ] 实现 Ollama Provider（本地部署，免费）
- [ ] 每个供应商添加集成测试

#### 交付物
- 6个完整的 Provider 实现
- 集成测试套件
- API调用日志

---

### Phase 3: 成本系统（第3周）

**目标**：实现成本计算和追踪

#### 任务清单
- [ ] 实现 `CostCalculator`
  - [ ] 单次成本计算
  - [ ] 批量成本估算
  - [ ] 缓存成本优化
- [ ] 实现 `CostTracker`
  - [ ] 使用记录存储
  - [ ] 统计数据生成
  - [ ] 持久化到文件
- [ ] 创建 Tauri 命令
  - [ ] `get_cost_estimate`
  - [ ] `get_usage_stats`
  - [ ] `clear_usage_stats`

#### 交付物
- `calculator.rs` - 成本计算器
- `tracker.rs` - 使用追踪器
- `report.rs` - 报表生成
- Tauri 命令绑定

---

### Phase 4: 缓存系统（第3周）

**目标**：优化性能和成本

#### 任务清单
- [ ] 实现模型列表缓存
  - [ ] 内存缓存（5分钟TTL）
  - [ ] 文件缓存（持久化）
- [ ] 实现翻译结果缓存
  - [ ] 基于内容哈希
  - [ ] LRU淘汰策略
- [ ] 缓存命中率统计

#### 交付物
- `model_cache.rs` - 模型缓存
- `translation_cache.rs` - 翻译缓存
- 缓存统计功能

---

### Phase 5: 前端集成（第4周）

**目标**：完整的UI体验

#### 5.1 供应商选择器
- [ ] 创建 `ProviderSelector` 组件
  - [ ] 供应商卡片展示
  - [ ] API密钥输入
  - [ ] 连接状态测试
  - [ ] 保存配置

#### 5.2 模型信息展示
- [ ] 创建 `ModelInfoCard` 组件
  - [ ] 模型参数展示
  - [ ] 价格信息展示
  - [ ] 推荐标记
  - [ ] 能力标签（缓存、流式等）

#### 5.3 成本追踪面板
- [ ] 创建 `CostTracker` 组件
  - [ ] 实时成本显示
  - [ ] Token使用统计
  - [ ] 缓存命中率
  - [ ] 历史记录图表

#### 5.4 成本预估器
- [ ] 创建 `CostEstimator` 组件
  - [ ] 翻译前预估
  - [ ] 批量成本预算
  - [ ] 不同供应商对比

#### 交付物
- 4个完整的React组件
- TypeScript类型定义
- 响应式设计
- 国际化支持

---

### Phase 6: 集成与测试（第5周）

**目标**：系统集成和全面测试

#### 任务清单
- [ ] 集成测试
  - [ ] 端到端翻译流程
  - [ ] 供应商切换
  - [ ] 成本计算准确性
- [ ] 性能测试
  - [ ] 批量翻译性能
  - [ ] 缓存命中率
  - [ ] 并发处理能力
- [ ] 用户体验优化
  - [ ] 加载状态
  - [ ] 错误提示
  - [ ] 操作反馈

#### 交付物
- 完整的测试报告
- 性能基准测试
- Bug修复清单

---

### Phase 7: 文档与发布（第6周）

**目标**：完善文档，准备发布

#### 任务清单
- [ ] 用户文档
  - [ ] 供应商配置指南
  - [ ] API密钥获取教程
  - [ ] 成本优化建议
- [ ] 开发文档
  - [ ] 架构设计文档
  - [ ] API参考
  - [ ] 扩展指南
- [ ] 发布准备
  - [ ] CHANGELOG
  - [ ] 升级指南
  - [ ] 示例配置

#### 交付物
- 完整的用户文档
- 开发者文档
- 发布说明

---

## 📚 参考代码索引

所有参考代码已按原始目录结构复制到 `roo-code-reference/` 目录。

详见：[参考代码索引文档](./roo-code-reference/INDEX.md)

---

## 🎯 成功指标

### 功能指标
- ✅ 支持6个主流AI供应商
- ✅ 成本计算误差 < 5%
- ✅ 缓存命中率 > 30%
- ✅ 批量翻译性能 > 2条/秒

### 用户体验指标
- ✅ 供应商切换 < 1秒
- ✅ 成本预估响应 < 500ms
- ✅ UI响应流畅（60fps）
- ✅ 错误提示清晰友好

### 技术指标
- ✅ 单元测试覆盖率 > 80%
- ✅ 集成测试通过率 100%
- ✅ 内存占用 < 300MB
- ✅ CPU使用率 < 30%

---

## 🔧 技术选型理由

### 为什么选择这些供应商？

| 供应商 | 选择理由 |
|--------|---------|
| **OpenAI** | 行业标准，质量最高 |
| **DeepSeek** | 中文优化，性价比极高（适合中文PO文件） |
| **Moonshot** | 国内可用，200K上下文，适合大型文件 |
| **Gemini** | Google服务，免费额度高，适合测试 |
| **智谱 GLM** | 国内主流，中文优化，稳定可靠 |
| **Ollama** | 本地部署，完全免费，隐私保护 |

### 架构设计理由

1. **Trait抽象** - 易扩展，便于单测
2. **双层缓存** - 性能和持久化兼顾
3. **工厂模式** - 动态创建供应商实例
4. **成本追踪** - 透明化AI使用成本

---

## 📖 学习资源

### 官方文档
- [OpenAI API Docs](https://platform.openai.com/docs)
- [DeepSeek API Docs](https://platform.deepseek.com/docs)
- [Moonshot API Docs](https://platform.moonshot.cn/docs)
- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
- [智谱 API Docs](https://open.bigmodel.cn/dev/api)
- [Ollama API Docs](https://github.com/ollama/ollama/blob/main/docs/api.md)

### 技术参考
- [Tauri Async Commands](https://tauri.app/v2/guides/features/async/)
- [Rust async-trait](https://docs.rs/async-trait)
- [React Hooks 最佳实践](https://react.dev/reference/react)

---

## 💡 实施建议

### 优先级排序

**高优先级（必须）**
1. ✅ OpenAI + DeepSeek 实现
2. ✅ 基础成本计算
3. ✅ 供应商选择UI

**中优先级（推荐）**
4. ✅ Moonshot + 智谱 GLM
5. ✅ 内存缓存系统
6. ✅ 成本追踪面板

**低优先级（可选）**
7. ⭕ Gemini + Ollama
8. ⭕ 高级统计图表
9. ⭕ 成本报表导出

### 迭代策略

**Sprint 1（2周）** - MVP版本
- OpenAI + DeepSeek
- 基础成本显示
- 供应商切换

**Sprint 2（2周）** - 完善功能
- 添加更多供应商
- 成本预估和追踪
- 缓存优化

**Sprint 3（2周）** - 打磨优化
- UI/UX优化
- 性能调优
- 文档完善

---

## 🚀 开始施工

### 第一步：创建基础结构

```bash
# 1. 创建目录
mkdir -p src-tauri/src/services/ai/{providers,cache,cost}

# 2. 创建核心文件
touch src-tauri/src/services/ai/{mod.rs,provider.rs,model_info.rs,manager.rs,factory.rs}

# 3. 创建供应商文件
touch src-tauri/src/services/ai/providers/{mod.rs,openai.rs,deepseek.rs}

# 4. 创建成本模块
touch src-tauri/src/services/ai/cost/{mod.rs,calculator.rs,tracker.rs}

# 5. 创建前端组件
mkdir -p src/components/{settings,cost}
touch src/components/settings/{ProviderSelector.tsx,ModelInfoCard.tsx}
touch src/components/cost/{CostEstimator.tsx,CostTracker.tsx}
```

### 第二步：参考代码

查看 `roo-code-reference/INDEX.md` 找到对应的参考实现。

### 第三步：按计划推进

按照 Phase 1-7 的顺序逐步实现，每个Phase完成后进行测试。

---

**准备好开始了吗？让我们开始施工！** 🛠️

