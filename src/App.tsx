import { useState, useEffect, useRef } from 'react';
import { Layout, ConfigProvider, message, Alert, Button, Space } from 'antd';
import { listen } from '@tauri-apps/api/event';
import { throttle } from 'lodash';
import { MenuBar } from './components/MenuBar';
import { EntryList } from './components/EntryList';
import { EditorPane } from './components/EditorPane';
import { SettingsModal } from './components/SettingsModal';
import { DevToolsModal } from './components/DevToolsModal';
import { AIWorkspace } from './components/AIWorkspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSessionStore } from './store';
// import { useSettingsStore, useStatsStore } from './store'; // 预留给未来使用
import { useTranslator } from './hooks/useTranslator';
import { useTheme } from './hooks/useTheme';
import { useTauriEventBridge } from './hooks/useTauriEventBridge';
import { useChannelTranslation } from './hooks/useChannelTranslation'; // Tauri 2.x: Channel API
import { TranslationStats, POEntry } from './types/tauri';
import { createModuleLogger } from './utils/logger';
import { eventDispatcher } from './services/eventDispatcher';
import { poFileApi, dialogApi, languageApi, translatorApi, apiClient, type LanguageInfo } from './services/api';
import { accumulateStats } from './utils/statsAggregator';
import { ConfigSyncManager } from './services/configSync';
import './i18n/config';
import './App.css';
import { FileInfoBar } from './components/FileInfoBar';
import { useAIConfigs } from './hooks/useConfig';

const { Sider } = Layout;
const log = createModuleLogger('App');

function App() {
  // 使用新的分离式 store
  const {
    entries,
    currentEntry,
    currentIndex,
    currentFilePath,
    isTranslating,
    progress,
    setEntries,
    setCurrentEntry,
    setCurrentFilePath,
    updateEntry,
    setTranslating,
    setProgress,
    updateSessionStats, // 新增：会话统计
    resetSessionStats,  // 任务开始时重置会话统计
  } = useSessionStore();
  
  // 注意：theme 由 useTheme hook 管理，language 由 i18n 管理
  // const { cumulativeStats, updateCumulativeStats } = useStatsStore(); // 暂未使用
  
  const { parsePOFile } = useTranslator();
  const channelTranslation = useChannelTranslation(); // Tauri 2.x: Channel API for high-performance batch translation
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [devToolsVisible, setDevToolsVisible] = useState(false);
  const [translationStats, setTranslationStats] = useState<TranslationStats | null>(null);
  const aggregatedStatsRef = useRef<TranslationStats>({
    total: 0,
    tm_hits: 0,
    deduplicated: 0,
    ai_translated: 0,
    tm_learned: 0,
    token_stats: { input_tokens: 0, output_tokens: 0, total_tokens: 0, cost: 0 },
  });
  const [leftWidth, setLeftWidth] = useState(35); // 左侧栏宽度百分比
  const [isResizing, setIsResizing] = useState(false);
  // 存储AI原译文，用于术语检测对比（key: 条目索引, value: AI译文）
  const [aiTranslations, setAiTranslations] = useState<Map<number, string>>(new Map());
  
  // Phase 5: 语言状态管理
  const [sourceLanguage, setSourceLanguage] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('zh-CN'); // 默认目标语言：简体中文
  
  const { themeConfig, algorithm, toggleTheme, isDark, colors } = useTheme();
  
  // 使用 ref 防止重复检查AI配置
  const hasCheckedAIConfig = useRef(false);
  
  // 配置同步管理器
  const configSyncRef = useRef<ConfigSyncManager | null>(null);
  const configSyncInitialized = useRef(false); // 防止 StrictMode 重复初始化
  const [configSyncIssues, setConfigSyncIssues] = useState<string[]>([]);
  
  // 🌉 建立 Tauri 事件桥接
  useTauriEventBridge();

  // 💾 Store 已在 main.tsx 中初始化，这里不需要重复初始化

  // 全局错误处理 - 防止黑屏
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      log.error('全局错误捕获', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
      message.error(`应用错误: ${event.message}`, 5);
      event.preventDefault(); // 阻止默认的错误处理，避免黑屏
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      log.error('未处理的Promise拒绝', {
        reason: event.reason,
        promise: event.promise
      });
      message.error(`异步操作失败: ${event.reason}`, 5);
      event.preventDefault(); // 阻止默认的错误处理
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      // 组件卸载时取消所有待处理的 API 请求
      apiClient.cancelAll();
    };
  }, []);

  // 初始化配置同步管理器
  useEffect(() => {
    // 防止 StrictMode 重复初始化
    if (configSyncInitialized.current) {
      log.debug('ConfigSync 已初始化，跳过重复初始化');
      return;
    }
    configSyncInitialized.current = true;
    
    const syncManager = new ConfigSyncManager();
    configSyncRef.current = syncManager;
    
    // 初始化配置同步
    syncManager.initialize().catch((error: unknown) => {
      log.error('配置同步管理器初始化失败', { error });
    });
    
    // 监听配置不一致事件
    const unsubscribe = eventDispatcher.on('config:out-of-sync', async (data) => {
      log.warn('⚠️ 检测到配置不一致', data);
      setConfigSyncIssues(data.issues || []);
      // 自动触发一次后台→前端同步，避免用户手动点击
      try {
        if (configSyncRef.current) {
          await configSyncRef.current.syncFromBackend();
          setConfigSyncIssues([]);
          message.success('配置已自动同步');
        }
      } catch (e) {
        log.logError(e, '自动同步配置失败');
      }
    });
    
    return () => {
      // StrictMode 清理时不重置标志，避免重复初始化
      // configSyncInitialized.current = false;
      if (configSyncRef.current) {
        configSyncRef.current.destroy();
        configSyncRef.current = null;
      }
      unsubscribe();
    };
  }, []);

  // 使用 SWR 获取 AI 启用配置
  const { active, loading: aiConfigLoading } = useAIConfigs();

  // 注意：API Key 现在存储在 active.apiKey 中，不再使用顶层的 api_key

  // 检查 AI 启用配置（等待 SWR 加载完成后再检查，避免误判）
  useEffect(() => {
    // 只有在加载完成后才检查
    if (aiConfigLoading) return;
    
    // 如果还没检查过，且没有启用配置，则弹窗
    if (!hasCheckedAIConfig.current && !active) {
      hasCheckedAIConfig.current = true;
      setSettingsVisible(true);
      log.info('未检测到AI配置，已自动打开设置窗口');
    }
    
    // 如果检测到有启用配置，标记为已检查
    if (active) {
      hasCheckedAIConfig.current = true;
    }
  }, [active, aiConfigLoading]);

  // 全局快捷键监听
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+O 打开文件
      if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
        event.preventDefault();
        openFile();
      }
      // Ctrl+S 保存文件
      else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveFile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentFilePath, entries]); // 依赖 currentFilePath 和 entries，确保闭包中获取最新值

  // 文件拖放监听（使用 Tauri API）
  useEffect(() => {
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      // 使用 @tauri-apps/api/event 的 listen
      unlistenFn = await listen<string[]>('tauri://file-drop', async (event) => {
        const files = event.payload;
        log.info('文件拖放事件接收', { files });
        
        if (files && files.length > 0) {
          const filePath = files[0];
          // 检查是否为 .po 文件
          if (filePath.toLowerCase().endsWith('.po')) {
            try {
              const entries = await parsePOFile(filePath) as POEntry[];
              setEntries(entries);
              setCurrentFilePath(filePath);
              log.info('通过拖放导入文件成功', { filePath });
              // 静默提示，避免阻塞弹窗
              console.info(`[DragDrop] 成功导入文件: ${filePath.split(/[/\\]/).pop()}`);
            } catch (error) {
              log.logError(error, '解析拖放文件失败');
              console.error('[DragDrop] 文件解析失败:', error);
            }
          } else {
            console.warn('仅支持 .po 文件');
          }
        }
      });
      
      log.debug('文件拖放监听器设置完成');
    };

    setupListener();

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []); // 空依赖数组，只在组件挂载时设置一次监听器

  // 通过 SWR 读取配置，无需手动加载函数

  // Phase 5: 检测语言并设置默认目标语言
  const detectAndSetLanguages = async (entries: POEntry[]) => {
    try {
      // 取前几个有效条目的文本进行检测
      const sampleTexts = entries
        .filter(e => e.msgid && e.msgid.trim())
        .slice(0, 5)
        .map(e => e.msgid)
        .join(' ');
      
      if (sampleTexts) {
        const detectedLang = await languageApi.detectLanguage(sampleTexts);
        setSourceLanguage(detectedLang.display_name);
        log.info('检测到源语言', { code: detectedLang.code, name: detectedLang.display_name });
        
        // 获取默认目标语言
        const defaultTarget = await languageApi.getDefaultTargetLanguage(detectedLang.code);
        setTargetLanguage(defaultTarget.code);
        log.info('设置默认目标语言', { code: defaultTarget.code, name: defaultTarget.display_name });
      }
    } catch (error) {
      log.logError(error, '语言检测失败，使用默认设置');
      setSourceLanguage('未知');
      setTargetLanguage('zh-CN'); // 默认中文
    }
  };

  // Phase 5: 处理目标语言变更
  const handleTargetLanguageChange = (langCode: string, langInfo: LanguageInfo | undefined) => {
    setTargetLanguage(langCode);
    if (langInfo) {
      log.info('切换目标语言', { code: langInfo.code, name: langInfo.display_name });
    }
  };

  const openFile = async () => {
    try {
      const filePath = await dialogApi.openFile();
      if (filePath) {
        const entries = await parsePOFile(filePath) as POEntry[];
        setEntries(entries);
        setCurrentFilePath(filePath);
        
        // 按需求：会话仅在软件关闭时重置，这里不再清零
        
        // Phase 5: 检测源语言并设置默认目标语言
        await detectAndSetLanguages(entries);
        
        // 触发文件加载事件
        await eventDispatcher.emit('file:loaded', { path: filePath, entries });
        log.info('文件加载成功', { filePath, entryCount: entries.length });
      }
    } catch (error) {
      log.logError(error, '打开文件失败');
      await eventDispatcher.emit('file:error', { 
        path: undefined, 
        error: error as Error, 
        operation: 'load' 
      });
    }
  };

  const translateAll = async () => {
    // 检查是否有启用的AI配置
    if (!active || !active.apiKey) {
      // 静默打开设置，避免阻塞弹窗
      setSettingsVisible(true);
      return;
    }

    const untranslatedEntries = entries.filter(entry => 
      entry.msgid && !entry.msgstr
    );

    if (untranslatedEntries.length === 0) {
      // ❌ 已移除提示弹窗，静默返回
      return;
    }

    log.info('准备批量翻译', { 
      totalEntries: entries.length, 
      untranslatedCount: untranslatedEntries.length 
    });

    await executeTranslation(untranslatedEntries, 'all');
    // ❌ 已移除翻译完成弹窗
  };

  // 保存到原文件
  const saveFile = async () => {
    if (!currentFilePath) {
      message.warning('没有打开的文件，请使用"另存为"');
      return;
    }
    
    try {
      await poFileApi.save(currentFilePath, entries);
      message.success('保存成功！');
      
      // 触发文件保存事件
      await eventDispatcher.emit('file:saved', { 
        path: currentFilePath, 
        success: true 
      });
      log.info('文件保存成功', { filePath: currentFilePath });
    } catch (error) {
      log.logError(error, '保存文件失败');
      message.error(`保存失败：${error instanceof Error ? error.message : '未知错误'}`);
      
      await eventDispatcher.emit('file:error', { 
        path: currentFilePath, 
        error: error as Error, 
        operation: 'save' 
      });
    }
  };
  
  // 另存为
  const saveAsFile = async () => {
    try {
      const filePath = await dialogApi.saveFile();
      if (filePath) {
        await poFileApi.save(filePath, entries);
        setCurrentFilePath(filePath);
        message.success('保存成功！');
        
        // 触发文件保存事件
        await eventDispatcher.emit('file:saved', { 
          path: filePath, 
          success: true 
        });
        log.info('文件另存为成功', { filePath });
      }
    } catch (error) {
      log.logError(error, '另存为失败');
      message.error(`保存失败：${error instanceof Error ? error.message : '未知错误'}`);
      
      await eventDispatcher.emit('file:error', { 
        path: undefined, 
        error: error as Error, 
        operation: 'save' 
      });
    }
  };

  const handleSettings = () => {
    setSettingsVisible(true);
  };

  const handleDevTools = () => {
    setDevToolsVisible(true);
  };

  const handleResetStats = () => {
    setTranslationStats(null);
  };

  // 🔧 统一的翻译处理函数 - 智能选择 Channel API 或 Event API
  const executeTranslation = async (
    entriesToTranslate: POEntry[], 
    sourceType: 'all' | 'selected' = 'all'
  ) => {
    if (!active || !active.apiKey) {
      message.warning('请先设置并启用AI配置');
      setSettingsVisible(true);
      return false;
    }

    const texts = entriesToTranslate.map(e => e.msgid);
    const USE_CHANNEL_THRESHOLD = 100; // 超过此数量使用 Channel API
    const useChannelAPI = texts.length >= USE_CHANNEL_THRESHOLD;
    
    let completedCount = 0;
    
    log.debug('executeTranslation 开始', { 
      entriesToTranslateCount: entriesToTranslate.length,
      textsCount: texts.length,
      useChannelAPI,
      sourceType
    });
    
    try {
      // 本次任务开始：重置会话统计，避免跨任务累积
      resetSessionStats();
      setTranslating(true);
      setProgress(0);
      
      // 触发翻译开始事件
      await eventDispatcher.emit('translation:before', { texts, source: sourceType });
      log.info(`🚀 开始翻译 (${useChannelAPI ? 'Channel API' : 'Event API'})`, { 
        count: texts.length, 
        source: sourceType 
      });
      
      let finalStats: TranslationStats | null = null;
      
      if (useChannelAPI) {
        // 重置聚合器
        aggregatedStatsRef.current = {
          total: 0,
          tm_hits: 0,
          deduplicated: 0,
          ai_translated: 0,
          tm_learned: 0,
          token_stats: { input_tokens: 0, output_tokens: 0, total_tokens: 0, cost: 0 },
        };
        // ========== Tauri 2.x: 使用 Channel API (高性能) ==========
        const result = await channelTranslation.translateBatch(texts, targetLanguage, {
          onProgress: (current, _total, percentage) => {
            setProgress(percentage);
            completedCount = current;
          },
          onStats: (stats) => {
            // 转换 Channel API 的统计格式到 TranslationStats
            const convertedStats = {
              ...stats,
              token_stats: {
                total_tokens: stats.token_stats.total_tokens,
                prompt_tokens: stats.token_stats.prompt_tokens,
                completion_tokens: stats.token_stats.completion_tokens,
                input_tokens: stats.token_stats.prompt_tokens, // map
                output_tokens: stats.token_stats.completion_tokens, // map
                cost: stats.token_stats.cost,
              },
            } as TranslationStats;
            setTranslationStats(convertedStats);
          finalStats = convertedStats;
            // 📈 聚合增量（按批），total 留到完成时统一赋值
            aggregatedStatsRef.current = accumulateStats(aggregatedStatsRef.current, {
              ...convertedStats,
              total: 0,
            } as TranslationStats);
          },
          onItem: (index, translation) => {
            // 🎯 实时写入待确认区
            const entry = entriesToTranslate[index];
            const entryIndex = entries.indexOf(entry);
            
            if (entryIndex >= 0) {
              updateEntry(entryIndex, { 
                msgstr: translation, 
                needsReview: true 
              });
              
              setAiTranslations(prev => {
                const newMap = new Map(prev);
                newMap.set(entryIndex, translation);
                return newMap;
              });
              
              log.debug('📝 实时写入待确认区', { 
                index: entryIndex, 
                msgid: entry.msgid.substring(0, 30) + '...',
                translation: translation.substring(0, 30) + '...'
              });
            }
          },
        });
        
        // ✅ onItem 已实时写入，这里只确保统计完整
        log.info('📦 Channel API 批量翻译完成', { 
          totalTranslations: Object.keys(result.translations).length,
          completedCount 
        });
        
        // 用聚合结果作为最终统计，统一设置 total
        finalStats = {
          ...aggregatedStatsRef.current,
          total: texts.length,
        } as TranslationStats;
        setTranslationStats(finalStats);
        
      } else {
        // ========== 传统: 使用 Event API ==========
        const unsubProgress = eventDispatcher.on('translation:progress', ({ index, translation }) => {
          const logPrefix = sourceType === 'all' ? '全部翻译' : '选中翻译';
          log.debug(`📥 收到翻译进度（${logPrefix}）`, { index, translation });
          
          const entry = entriesToTranslate[index];
          const entryIndex = entries.indexOf(entry);
          
          if (entryIndex >= 0) {
            updateEntry(entryIndex, { 
              msgstr: translation, 
              needsReview: true 
            });
            
            setAiTranslations(prev => {
              const newMap = new Map(prev);
              newMap.set(entryIndex, translation);
              return newMap;
            });
            
            completedCount++;
            setProgress((completedCount / texts.length) * 100);
          }
        });
        
        const unsubStats = eventDispatcher.on('translation:stats', (stats) => {
          setTranslationStats(stats);
          finalStats = stats; // 记录最终统计
        });
        
        const result = await translatorApi.translateBatch(texts, targetLanguage);
        
        unsubProgress();
        unsubStats();
        
        // 从返回值获取最终统计（优先级更高）
        if (result?.stats) {
          finalStats = result.stats;
          setTranslationStats(finalStats);
        }
      }
      
      // 📊 更新会话统计（本次会话聚合）
      if (finalStats) {
        updateSessionStats(finalStats);
        log.info('📊 会话统计已更新', { sessionStats: finalStats });
      }
      
      // 触发翻译完成事件（使用 finalStats，确保有数据）
      await eventDispatcher.emit('translation:after', { 
        success: true, 
        stats: finalStats || undefined 
      });
      log.info('✅ 翻译完成', { count: completedCount, api: useChannelAPI ? 'Channel' : 'Event' });
      
      // ❌ 已移除翻译完成通知弹窗
      
      return true; // 成功
    } catch (error) {
      log.logError(error, '翻译失败');
      
      // 直接显示错误信息（后端已经处理成友好提示）
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      message.error({
        content: errorMessage,
        duration: 8,
      });
      
      // 触发翻译错误事件
      await eventDispatcher.emit('translation:error', { 
        error: error as Error, 
        phase: 'execution' 
      });
      
      return false; // 失败
    } finally {
      setTranslating(false);
      setProgress(0);
    }
  };

  // 翻译选中的条目
  const handleTranslateSelected = async (indices: number[]) => {
    // 检查是否有启用的AI配置
    if (!active) {
      message.warning('请先在设置中配置并启用 AI 服务！');
      setSettingsVisible(true);
      return;
    }
    
    const selectedEntries = indices.map(i => entries[i]).filter(e => e && e.msgid && !e.msgstr);
    if (selectedEntries.length === 0) {
      message.info('选中的条目都已翻译');
      return;
    }

    await executeTranslation(selectedEntries, 'selected');
    // ❌ 已移除翻译完成提示
  };

  // Phase 7: 精翻选中的条目（Contextual Refine）
  const handleContextualRefine = async (indices: number[]) => {
    // 检查是否有启用的AI配置
    if (!active || !active.apiKey) {
      message.warning('请先在设置中配置并启用 AI 服务！');
      setSettingsVisible(true);
      return;
    }
    
    // 过滤出待确认的条目
    const selectedEntries = indices
      .map(i => ({ index: i, entry: entries[i] }))
      .filter(({ entry }) => entry && entry.msgid && entry.needsReview);

    if (selectedEntries.length === 0) {
      message.info('选中的条目中没有待确认的项');
      return;
    }

    setTranslating(true);
    
    try {
      // 构建精翻请求
      const requests = selectedEntries.map(({ index, entry }) => ({
        msgid: entry.msgid,
        msgctxt: entry.msgctxt || undefined,
        comment: entry.comments.join('\n') || undefined,
        previous_entry: index > 0 ? entries[index - 1]?.msgstr : undefined,
        next_entry: index < entries.length - 1 ? entries[index + 1]?.msgstr : undefined,
      }));

      log.info('[精翻] 开始精翻', { 
        count: requests.length,
        targetLanguage: targetLanguage 
      });

      // 调用精翻 API
      // 注意：后端会从配置管理器获取启用的AI配置
      const results = await translatorApi.contextualRefine(
        requests,
        targetLanguage
      );

      // 应用翻译结果
      results.forEach((translation, i) => {
        const { index } = selectedEntries[i];
        updateEntry(index, { 
          msgstr: translation,
          needsReview: true  // 精翻后仍需手动确认
        });
      });

      // ❌ 已移除精翻完成提示
      log.info('[精翻] 完成', { count: results.length });

    } catch (error) {
      log.error('[精翻] 失败', { error });
      
      // 直接显示错误信息（后端已经处理成友好提示）
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      message.error({
        content: errorMessage,
        duration: 8,
      });
    } finally {
      setTranslating(false);
    }
  };

  // 拖拽调整宽度
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    // 使用throttle优化拖拽性能，限制为60fps (16ms)
    const handleMouseMove = throttle((e: MouseEvent) => {
      if (!isResizing) return;
      
      const windowWidth = window.innerWidth;
      const newWidth = (e.clientX / windowWidth) * 100;
      
      // 限制最小宽度20%，最大宽度60%
      if (newWidth >= 20 && newWidth <= 60) {
        setLeftWidth(newWidth);
      }
    }, 16); // 60fps = 1000ms/60 ≈ 16ms

    const handleMouseUp = () => {
      setIsResizing(false);
      handleMouseMove.cancel(); // 取消待执行的throttle调用
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      handleMouseMove.cancel(); // 清理待执行的throttle
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <ConfigProvider
      theme={{
        ...themeConfig,
        algorithm,
      }}
    >
      <div data-theme={isDark ? 'dark' : 'light'} style={{ height: '100vh', width: '100vw' }}>
      <Layout style={{ height: '100%', width: '100%' }}>
        <MenuBar
          onOpenFile={openFile}
          onSaveFile={saveFile}
          onSaveAsFile={saveAsFile}
          onTranslateAll={translateAll}
          onSettings={handleSettings}
          onDevTools={handleDevTools}
          apiKey={active?.apiKey || ''}
          onApiKeyChange={() => {}} // API Key 现在由配置管理，不再支持直接修改
          isTranslating={isTranslating}
          hasEntries={entries.length > 0}
          isDarkMode={isDark}
          onThemeToggle={toggleTheme}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          onTargetLanguageChange={handleTargetLanguageChange}
        />
        
        {/* 配置同步警告 */}
        {configSyncIssues.length > 0 && (
          <Alert
            message="配置同步警告"
            description={
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>检测到前后端配置不一致：</div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {configSyncIssues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </Space>
            }
            type="warning"
            showIcon
            closable
            onClose={() => setConfigSyncIssues([])}
            action={
              <Button 
                size="small" 
                type="primary"
                onClick={async () => {
                  if (configSyncRef.current) {
                    await configSyncRef.current.syncFromBackend();
                    setConfigSyncIssues([]);
                    message.success('配置已重新同步');
                  }
                }}
              >
                重新同步
              </Button>
            }
            style={{ margin: '8px 16px', borderRadius: 4 }}
          />
        )}
      
      <Layout style={{ height: configSyncIssues.length > 0 ? 'calc(100vh - 128px)' : 'calc(100vh - 48px)', width: '100%', position: 'relative' }}>
        <div 
          style={{ 
            width: `${leftWidth}%`,
            background: colors.bgPrimary,
            borderRight: `1px solid ${colors.borderPrimary}`,
            overflow: 'hidden',
            minWidth: '300px',
            position: 'relative'
          }}
        >
          <ErrorBoundary fallback={
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <Alert 
                message="条目列表加载失败" 
                description="请尝试重新打开文件"
                type="error" 
                showIcon 
              />
            </div>
          }>
            <EntryList
              entries={entries}
              currentEntry={currentEntry}
              isTranslating={isTranslating}
              progress={progress}
              onEntrySelect={setCurrentEntry}
              onTranslateSelected={handleTranslateSelected}
              onContextualRefine={handleContextualRefine} /* Phase 7: 精翻 */
            />
          </ErrorBoundary>
          {/* 拖拽手柄 */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '5px',
              cursor: 'col-resize',
              background: isResizing ? '#1890ff' : 'transparent',
              transition: 'background 0.2s',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              if (!isResizing) {
                (e.target as HTMLElement).style.background = '#e6f7ff';
              }
            }}
            onMouseLeave={(e) => {
              if (!isResizing) {
                (e.target as HTMLElement).style.background = 'transparent';
              }
            }}
          />
        </div>
        
        <div 
          style={{ 
            background: colors.bgPrimary,
            overflow: 'auto',
            flex: 1
          }}
        >
          <ErrorBoundary fallback={
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <Alert 
                message="编辑器加载失败" 
                description="请尝试选择其他条目"
                type="error" 
                showIcon 
              />
            </div>
          }>
            <EditorPane
              entry={currentEntry}
              onEntryUpdate={updateEntry}
              aiTranslation={currentIndex >= 0 ? aiTranslations.get(currentIndex) : undefined}
              apiKey={active?.apiKey || ''}
            />
          </ErrorBoundary>
        </div>

        <Sider
          width="320"
          style={{
            background: colors.bgTertiary,
            borderLeft: `1px solid ${colors.borderPrimary}`,
            overflow: 'auto',
            maxWidth: 'none',
            minWidth: '300px',
            flex: '0 0 320px'
          }}
        >
          <ErrorBoundary fallback={
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <Alert 
                message="AI工作区加载失败" 
                description="部分功能可能无法使用"
                type="warning" 
                showIcon 
              />
            </div>
          }>
            <AIWorkspace 
              stats={translationStats} 
              isTranslating={isTranslating}
              onResetStats={handleResetStats}
              apiKey={active?.apiKey || ''}
            />
          </ErrorBoundary>
        </Sider>
      </Layout>

      <ErrorBoundary>
        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <DevToolsModal
          visible={devToolsVisible}
          onClose={() => setDevToolsVisible(false)}
        />
      </ErrorBoundary>
      {/* 文件信息栏：展示格式与元数据 */}
      <FileInfoBar filePath={currentFilePath} />
    </Layout>
    </div>
    </ConfigProvider>
  );
}

export default App;
