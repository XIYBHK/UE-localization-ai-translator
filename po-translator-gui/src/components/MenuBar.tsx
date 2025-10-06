import { Button, Tooltip, Divider } from 'antd';
import { 
  FolderOpenOutlined,
  SaveOutlined,
  SettingOutlined,
  TranslationOutlined,
} from '@ant-design/icons';

interface MenuBarProps {
  onOpenFile: () => void;
  onSaveFile: () => void;
  onTranslateAll: () => void;
  onSettings: () => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  isTranslating: boolean;
  hasEntries: boolean;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  onOpenFile,
  onSaveFile,
  onTranslateAll,
  onSettings,
  apiKey,
  isTranslating,
  hasEntries,
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: '8px 16px',
      background: '#fafafa',
      borderBottom: '1px solid #d9d9d9',
      gap: '8px'
    }}>
      <div style={{ 
        fontSize: '16px', 
        fontWeight: 600, 
        marginRight: '16px',
        color: '#1890ff'
      }}>
        🌐 PO 翻译工具
      </div>
      
      <Tooltip title="打开 PO 文件 (Ctrl+O)">
        <Button 
          icon={<FolderOpenOutlined />}
          onClick={onOpenFile}
          size="middle"
        >
          打开
        </Button>
      </Tooltip>
      
      <Tooltip title="保存文件 (Ctrl+S)">
        <Button 
          icon={<SaveOutlined />}
          onClick={onSaveFile}
          disabled={!hasEntries}
          size="middle"
        >
          保存
        </Button>
      </Tooltip>
      
      <Divider type="vertical" style={{ height: '24px', margin: '0 8px' }} />
      
      <Tooltip title="翻译所有未翻译条目">
        <Button 
          type="primary"
          icon={<TranslationOutlined />}
          onClick={onTranslateAll}
          loading={isTranslating}
          disabled={!apiKey || !hasEntries}
          size="middle"
        >
          {isTranslating ? '翻译中...' : '批量翻译'}
        </Button>
      </Tooltip>
      
      <div style={{ flex: 1 }} />
      
      <Tooltip title="设置 API 密钥和翻译选项">
        <Button 
          icon={<SettingOutlined />}
          onClick={onSettings}
          size="middle"
        >
          设置
        </Button>
      </Tooltip>
      
      {!apiKey && (
        <div style={{ 
          padding: '4px 12px', 
          background: '#fff7e6', 
          border: '1px solid #ffd591',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#fa8c16'
        }}>
          ⚠️ 请先在设置中配置 API 密钥
        </div>
      )}
    </div>
  );
};
