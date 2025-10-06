import React, { useState, useEffect, useRef } from 'react';
import { Progress, Button } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { POEntry } from '../types/tauri';
import { useAppStore } from '../store/useAppStore';
import { useTheme } from '../hooks/useTheme';

interface EntryListProps {
  entries: POEntry[];
  currentEntry: POEntry | null;
  isTranslating: boolean;
  progress: number;
  onEntrySelect: (entry: POEntry) => void;
  onTranslateSelected?: (indices: number[]) => void;
}

export const EntryList: React.FC<EntryListProps> = ({
  entries,
  currentEntry,
  isTranslating,
  progress,
  onEntrySelect,
  onTranslateSelected,
}) => {
  const { updateEntry } = useAppStore();
  const { colors } = useTheme();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 三列宽度状态
  const [columnWidths, setColumnWidths] = useState([33.33, 33.33, 33.34]); // 百分比
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);

  // 确认翻译
  const handleConfirm = (index: number, event: React.MouseEvent) => {
    event.stopPropagation(); // 阻止触发行选择
    updateEntry(index, { needsReview: false });
  };

  // 确认所有待确认条目
  const handleConfirmAll = () => {
    const needsReviewEntries = entries.filter(e => getEntryStatus(e) === 'needs-review');
    needsReviewEntries.forEach((entry) => {
      const index = entries.indexOf(entry);
      updateEntry(index, { needsReview: false });
    });
  };

  // 确认已选中条目
  const handleConfirmSelected = () => {
    selectedRowKeys.forEach((key) => {
      const index = key as number;
      const entry = entries[index];
      if (entry && getEntryStatus(entry) === 'needs-review') {
        updateEntry(index, { needsReview: false });
      }
    });
    setSelectedRowKeys([]);
  };

  // 翻译已选中条目
  const handleTranslateSelected = () => {
    if (onTranslateSelected) {
      const indices = selectedRowKeys.map(key => key as number);
      onTranslateSelected(indices);
    }
  };

  // 当前激活列（用于全选）
  const [activeColumn, setActiveColumn] = useState<'untranslated' | 'needsReview' | 'translated' | null>(null);

  // 列宽调整
  useEffect(() => {
    if (resizingColumn === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidths = [...columnWidths];
      const mouseX = e.clientX - containerRect.left;
      const containerWidth = containerRect.width;
      const percentage = (mouseX / containerWidth) * 100;

      if (resizingColumn === 0) {
        // 调整第一列和第二列
        const minWidth = 15;
        const maxWidth = 100 - minWidth * 2;
        const newFirstWidth = Math.max(minWidth, Math.min(maxWidth, percentage));
        const diff = newFirstWidth - columnWidths[0];
        newWidths[0] = newFirstWidth;
        newWidths[1] = Math.max(minWidth, columnWidths[1] - diff);
      } else if (resizingColumn === 1) {
        // 调整第二列和第三列
        const minWidth = 15;
        const firstWidth = columnWidths[0];
        const newSecondWidth = Math.max(minWidth, Math.min(100 - firstWidth - minWidth, percentage - firstWidth));
        const diff = newSecondWidth - columnWidths[1];
        newWidths[1] = newSecondWidth;
        newWidths[2] = Math.max(minWidth, columnWidths[2] - diff);
      }

      setColumnWidths(newWidths);
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, columnWidths]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+A 或 Cmd+A 全选当前列
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        
        if (activeColumn) {
          // 全选当前列
          const groupedEntries = {
            untranslated: entries.filter(e => getEntryStatus(e) === 'untranslated'),
            needsReview: entries.filter(e => getEntryStatus(e) === 'needs-review'),
            translated: entries.filter(e => getEntryStatus(e) === 'translated'),
          };
          
          const columnEntries = groupedEntries[activeColumn];
          const columnKeys = columnEntries.map(entry => entries.indexOf(entry));
          setSelectedRowKeys(columnKeys);
        } else {
          // 如果没有激活列，全选所有
          const allKeys = entries.map((_, index) => index);
          setSelectedRowKeys(allKeys);
        }
      }
      // Ctrl+C 或 Cmd+C 复制选中内容
      else if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        if (selectedRowKeys.length > 0) {
          event.preventDefault();
          const selectedTexts = selectedRowKeys
            .map(key => {
              const index = key as number;
              const entry = entries[index];
              return `${entry.msgid || ''}\t${entry.msgstr || ''}`;
            })
            .join('\n');
          
          navigator.clipboard.writeText(selectedTexts).then(() => {
            console.log(`已复制 ${selectedRowKeys.length} 个条目到剪贴板`);
          });
        }
      }
      // Escape 取消选择
      else if (event.key === 'Escape') {
        setSelectedRowKeys([]);
      }
      // Ctrl+D 或 Cmd+D 取消选择
      else if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
        event.preventDefault();
        setSelectedRowKeys([]);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      // 设置 tabIndex 使 div 可聚焦
      container.setAttribute('tabIndex', '0');
    }

    return () => {
      if (container) {
        container.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [entries, selectedRowKeys]);

  const getEntryStatus = (entry: POEntry) => {
    if (!entry.msgid) return 'empty';
    if (entry.msgstr && entry.needsReview) return 'needs-review';
    if (entry.msgstr) return 'translated';
    return 'untranslated';
  };

  const handleRowClick = (record: POEntry, index: number, event: React.MouseEvent) => {
    onEntrySelect(record);

    if (event.shiftKey && lastClickedIndex !== null) {
      // Shift + 点击：选择范围
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeKeys = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      setSelectedRowKeys(rangeKeys);
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd + 点击：切换选择状态
      if (selectedRowKeys.includes(index)) {
        setSelectedRowKeys(selectedRowKeys.filter(key => key !== index));
      } else {
        setSelectedRowKeys([...selectedRowKeys, index]);
      }
    } else {
      // 普通点击：单选
      setSelectedRowKeys([index]);
      setLastClickedIndex(index);
    }
  };

  // 按状态分组条目
  const groupedEntries = {
    untranslated: entries.filter(e => getEntryStatus(e) === 'untranslated'),
    needsReview: entries.filter(e => getEntryStatus(e) === 'needs-review'),
    translated: entries.filter(e => getEntryStatus(e) === 'translated'),
  };

  const renderColumn = (title: string, items: POEntry[], statusColor: string, columnType: 'untranslated' | 'needsReview' | 'translated') => (
    <div 
      style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        borderRight: columnType !== 'translated' ? `1px solid ${colors.borderSecondary}` : 'none',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden'
      }}
      onMouseEnter={() => setActiveColumn(columnType)}
      onMouseLeave={() => setActiveColumn(null)}
    >
      <div style={{ 
        padding: '8px 12px',
        background: colors.bgTertiary,
        borderBottom: `1px solid ${colors.borderSecondary}`,
        fontSize: '13px',
        fontWeight: 600,
        color: statusColor,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>{title}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 'normal', color: colors.textSecondary }}>({items.length})</span>
          {columnType === 'needsReview' && items.length > 0 && (
            <Button 
              type="link" 
              size="small" 
              onClick={handleConfirmAll}
              style={{ fontSize: '12px', padding: 0, height: 'auto' }}
            >
              确认所有
            </Button>
          )}
        </div>
      </div>
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        overflowX: 'hidden', 
        userSelect: 'none',
        minHeight: 0
      }}>
        {items.map((entry) => {
          const globalIndex = entries.indexOf(entry);
          const isSelected = selectedRowKeys.includes(globalIndex);
          const isCurrent = currentEntry === entry;
          const status = getEntryStatus(entry);
          
          return (
            <div
              key={globalIndex}
              onClick={(event) => handleRowClick(entry, globalIndex, event)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: isSelected 
                  ? colors.selectedBg 
                  : isCurrent 
                    ? colors.hoverBg 
                    : 'transparent',
                borderBottom: `1px solid ${colors.borderSecondary}`,
                borderLeft: isSelected ? `3px solid ${colors.selectedBorder}` : '3px solid transparent',
                transition: 'all 0.2s',
                userSelect: 'none',
              }}
              className={isSelected ? 'table-row-selected' : ''}
            >
              <div style={{ 
                fontSize: '12px', 
                color: colors.textTertiary,
                marginBottom: 4 
              }}>
                #{globalIndex + 1}
              </div>
              <div style={{ 
                fontSize: '13px',
                lineHeight: '1.4',
                marginBottom: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                color: colors.textPrimary,
                fontWeight: 500
              }}>
                {entry.msgid || '(空)'}
              </div>
              {entry.msgstr && (
                <div style={{ 
                  fontSize: '12px',
                  color: colors.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {entry.msgstr}
                </div>
              )}
              {entry.msgctxt && (
                <div 
                  style={{ 
                    fontSize: '11px',
                    color: colors.textTertiary,
                    marginTop: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={`上下文信息: ${entry.msgctxt}`}
                >
                  📌 {entry.msgctxt}
                </div>
              )}
              {status === 'needs-review' && (
                <div style={{ marginTop: 8 }}>
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={(e) => handleConfirm(globalIndex, e)}
                    style={{ fontSize: '12px' }}
                  >
                    确认
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div 
      ref={containerRef}
      style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        outline: 'none',
        background: colors.bgPrimary 
      }}
    >
      <div style={{ 
        padding: '8px 16px',
        borderBottom: `1px solid ${colors.borderSecondary}`,
        background: colors.bgTertiary,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: colors.textPrimary }}>
          共 {entries.length} 条 {selectedRowKeys.length > 0 && `(已选 ${selectedRowKeys.length})`}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectedRowKeys.length > 0 && (() => {
            const hasNeedsReview = selectedRowKeys.some(key => {
              const entry = entries[key as number];
              return entry && getEntryStatus(entry) === 'needs-review';
            });
            
            const hasUntranslated = selectedRowKeys.some(key => {
              const entry = entries[key as number];
              return entry && getEntryStatus(entry) === 'untranslated';
            });
            
            return (
              <>
                {hasNeedsReview && (
                  <Button 
                    type="primary" 
                    size="small" 
                    onClick={handleConfirmSelected}
                    icon={<CheckOutlined />}
                  >
                    确认已选中
                  </Button>
                )}
                {hasUntranslated && (
                  <Button 
                    type="primary" 
                    size="small" 
                    onClick={handleTranslateSelected}
                    disabled={isTranslating}
                  >
                    翻译选中
                  </Button>
                )}
              </>
            );
          })()}
          {selectedRowKeys.length > 0 && (
            <span style={{ fontSize: '12px', color: colors.textTertiary }}>
              Ctrl+A 全选 | Ctrl+C 复制 | Esc 取消
            </span>
          )}
        </div>
      </div>
      
      {isTranslating && (
        <div style={{ padding: '8px 16px', background: colors.bgPrimary }}>
          <Progress 
            percent={Math.round(progress)} 
            size="small"
            status="active"
          />
        </div>
      )}
      
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ width: `${columnWidths[0]}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
          {renderColumn('未翻译', groupedEntries.untranslated, colors.statusUntranslated, 'untranslated')}
          {/* 拖拽手柄 */}
          <div
            onMouseDown={() => setResizingColumn(0)}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '5px',
              cursor: 'col-resize',
              backgroundColor: 'transparent',
              zIndex: 10,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.statusUntranslated}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          />
        </div>
        <div style={{ width: `${columnWidths[1]}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
          {renderColumn('待确认', groupedEntries.needsReview, colors.statusNeedsReview, 'needsReview')}
          {/* 拖拽手柄 */}
          <div
            onMouseDown={() => setResizingColumn(1)}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '5px',
              cursor: 'col-resize',
              backgroundColor: 'transparent',
              zIndex: 10,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.statusNeedsReview}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          />
        </div>
        <div style={{ width: `${columnWidths[2]}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {renderColumn('已翻译', groupedEntries.translated, colors.statusTranslated, 'translated')}
        </div>
      </div>
    </div>
  );
};
