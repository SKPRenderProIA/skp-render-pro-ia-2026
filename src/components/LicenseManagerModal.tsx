import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Copy, Check, Download, Terminal, 
  X, FileCode, ShieldAlert, Key, Sparkles, RefreshCw, AlertCircle, RotateCw, RotateCcw, Wrench, Globe,
  Users, Phone, Calendar, Hash, UserPlus, Trash2, ShieldX, Clock, Search, Filter, Image as ImageIcon,
  BellRing
} from 'lucide-react';
import { SKP_PLUGIN_STABLE_CODE } from '../data/skpPluginSource';

interface LicenseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopyText: (text: string, idRef?: string) => void;
  copiedId: string | null;
}

export const LicenseManagerModal: React.FC<LicenseManagerModalProps> = ({
  isOpen,
  onClose,
  onCopyText,
  copiedId,
}) => {
  const [activeTab, setActiveTab] = useState<'licenses' | 'ruby' | 'plugin' | 'obfuscator'>('licenses');
  
  // Lista de Licenças
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'revoked'>('all');

  // Formulário de Nova Licença
  const [newClient, setNewClient] = useState({
    name: '',
    contact: '',
    pcId: '',
    duration: '30', // default 1 month
    customValidUntil: '',
  });
  const [generating, setGenerating] = useState(false);

  // Código Ruby puro do plugin
  const [pluginRubyCode, setPluginRubyCode] = useState<string>('');
  const [loadingPluginCode, setLoadingPluginCode] = useState<boolean>(false);

  // Ofuscador de código Ruby
  const [rubyToObfuscate, setRubyToObfuscate] = useState<string>('');
  const [obfuscatedResult, setObfuscatedResult] = useState<string | null>(null);
  const [loadingObfuscation, setLoadingObfuscation] = useState<boolean>(false);
  const [loadingPublish, setLoadingPublish] = useState<boolean>(false);
  const [obfuscatedFilename, setObfuscatedFilename] = useState<string>('skp_render_pro_protected.rb');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal de Reativação / Renovação
  const [reactivatingLicense, setReactivatingLicense] = useState<any | null>(null);
  const [reactivateDuration, setReactivateDuration] = useState<string>('30');
  const [reactivateCustomDate, setReactivateCustomDate] = useState<string>('');
  const [isReactivating, setIsReactivating] = useState<boolean>(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  // Modal de Exclusão de Licença
  const [deletingLicense, setDeletingLicense] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // URL do Servidor configurada no Plugin para distribuição (Padrão automático: http://localhost:3000)
  const [targetServerUrl, setTargetServerUrl] = useState<string>('http://localhost:3000');

  // Controle de Notificação de Atualização do Plugin para Clientes
  const [releaseInfo, setReleaseInfo] = useState<{
    version: number;
    versionName: string;
    releaseDate: string;
    releaseNotes: string;
    activeAlert: boolean;
  } | null>(null);
  const [isPublishingRelease, setIsPublishingRelease] = useState<boolean>(false);

  const fetchReleaseInfo = async () => {
    try {
      const res = await fetch(`/api/plugin-version?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          setReleaseInfo(data);
        }
      }
    } catch (_) {}
  };

  const handlePublishPluginRelease = async () => {
    setIsPublishingRelease(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/admin/publish-plugin-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionName: '2.1.0',
          releaseNotes: 'Nova versão oficial do plugin SKP Render Pro IA'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('✓ Atualização lançada com sucesso! O botão no plugin dos clientes ficará LARANJA até que eles baixem o novo arquivo.');
        if (data.releaseInfo) {
          setReleaseInfo({
            version: data.releaseInfo.releaseVersion,
            versionName: data.releaseInfo.versionName,
            releaseDate: data.releaseInfo.releaseDate,
            releaseNotes: data.releaseInfo.releaseNotes,
            activeAlert: data.releaseInfo.activeAlert
          });
        }
      } else {
        throw new Error(data.error || 'Falha ao publicar atualização');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao publicar atualização');
    } finally {
      setIsPublishingRelease(false);
    }
  };

  const handleClearPluginAlert = async () => {
    setIsPublishingRelease(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/admin/clear-plugin-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('✓ Alerta de atualização desativado! O botão no SketchUp voltou ao estado normal.');
        if (data.releaseInfo) {
          setReleaseInfo({
            version: data.releaseInfo.releaseVersion,
            versionName: data.releaseInfo.versionName,
            releaseDate: data.releaseInfo.releaseDate,
            releaseNotes: data.releaseInfo.releaseNotes,
            activeAlert: data.releaseInfo.activeAlert
          });
        }
      } else {
        throw new Error(data.error || 'Falha ao desativar alerta');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao desativar alerta');
    } finally {
      setIsPublishingRelease(false);
    }
  };

  const handlePublishProtected = async () => {
    if (!obfuscatedResult) return;
    
    setLoadingPublish(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/admin/publish-protected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: obfuscatedResult }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage('Plugin atualizado com sucesso! Agora os clientes podem baixar essa versão ofuscada.');
        
        // Iniciar download silencioso via Iframe oculto para não abrir nova aba
        const downloadUrl = `/api/download/skp_render_pro_protected.rb?t=${Date.now()}`;
        let iframe = document.getElementById('silent-download-iframe') as HTMLIFrameElement;
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'silent-download-iframe';
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
        }
        iframe.src = downloadUrl;
      } else {
        setErrorMessage(data.error || 'Falha ao publicar atualização.');
      }
    } catch (err) {
      setErrorMessage('Erro de conexão ao tentar publicar atualização.');
    } finally {
      setLoadingPublish(false);
    }
  };

  const handleObfuscate = async () => {
    if (!rubyToObfuscate.trim()) {
      setErrorMessage('Por favor, cole o código Ruby que deseja proteger.');
      return;
    }

    setLoadingObfuscation(true);
    setErrorMessage(null);
    setObfuscatedResult(null);

    try {
      const res = await fetch('/api/admin/obfuscate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: rubyToObfuscate,
          filename: 'skp_render_pro.rb'
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setObfuscatedResult(data.obfuscated);
        setObfuscatedFilename(data.filename);
        setSuccessMessage('Código ofuscado com sucesso! Agora ele está protegido contra leitura direta.');
      } else {
        setErrorMessage(data.error || 'Falha ao ofuscar o código.');
      }
    } catch (err) {
      setErrorMessage('Erro de conexão ao tentar ofuscar o código.');
    } finally {
      setLoadingObfuscation(false);
    }
  };

  const handleLoadOriginalRuby = async () => {
    try {
      setLoadingObfuscation(true);
      setErrorMessage(null);
      const res = await fetch(`/api/plugin-code?type=source&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.code && !data.code.trim().startsWith('<')) {
          setRubyToObfuscate(data.code);
          setSuccessMessage('Código original (aberto) carregado com sucesso para a caixa de edição.');
          return;
        }
      }
      // Contingência embutida
      setRubyToObfuscate(SKP_PLUGIN_STABLE_CODE);
      setSuccessMessage('Código original oficial carregado com sucesso a partir da base estável.');
    } catch (err) {
      setRubyToObfuscate(SKP_PLUGIN_STABLE_CODE);
      setSuccessMessage('Código original oficial carregado com sucesso a partir da base estável.');
    } finally {
      setLoadingObfuscation(false);
    }
  };

  const handleRestoreStablePlugin = async () => {
    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      const res = await fetch('/api/admin/restore-stable', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`✓ Plugin restaurado com sucesso! Arquivo oficial skp_render_pro.rb com ${data.lines} linhas no estado mais estável.`);
        await fetchPluginCode();
      } else {
        setErrorMessage(data.error || 'Falha ao restaurar plugin.');
      }
    } catch (err: any) {
      setErrorMessage('Erro de conexão ao tentar restaurar plugin.');
    }
  };

  const downloadObfuscated = () => {
    if (!obfuscatedResult) return;
    try {
      const blob = new Blob([obfuscatedResult], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = obfuscatedFilename || 'skp_render_pro_protected.rb';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.error('Error downloading obfuscated code:', err);
    }
  };

  const handleClearBlacklist = async (pcIdToClear?: string) => {
    try {
      setErrorMessage(null);
      const res = await fetch('/api/admin/clear-blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pcIdToClear ? { pcId: pcIdToClear } : { clearAll: true }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(data.message || 'Bloqueios removidos com sucesso!');
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(data.error || 'Erro ao limpar bloqueios.');
      }
    } catch (err) {
      setErrorMessage('Erro de conexão ao limpar bloqueios.');
    }
  };

  const fetchLicenses = async () => {
    try {
      setLoadingList(true);
      const res = await fetch(`/api/licenses?t=${Date.now()}`);
      const data = await res.json();
      if (res.ok && data.licenses) {
        setLicenses(data.licenses);
      }
    } catch (err) {
      console.error('Erro ao carregar licenças:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const handleGenerateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.pcId.trim() || !newClient.name.trim()) {
      setErrorMessage('Nome e ID do Computador são obrigatórios.');
      return;
    }

    setGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let validUntil = '';
      const dur = newClient.duration;

      if (dur === 'custom') {
        validUntil = newClient.customValidUntil;
        if (!validUntil) {
          setErrorMessage('Por favor, selecione a data e hora de validade.');
          setGenerating(false);
          return;
        }
      } else {
        const targetDate = new Date();
        if (dur.startsWith('m')) {
          // Minutos
          const minutes = parseInt(dur.substring(1));
          targetDate.setMinutes(targetDate.getMinutes() + minutes);
        } else if (dur.startsWith('h')) {
          // Horas
          const hours = parseInt(dur.substring(1));
          targetDate.setHours(targetDate.getHours() + hours);
        } else {
          // Dias (padrão anterior)
          const days = parseInt(dur);
          targetDate.setDate(targetDate.getDate() + days);
          // Se for dias, mantemos até o final do dia
          targetDate.setHours(23, 59, 0, 0);
        }

        // Formato YYYY-MM-DDTHH:mm para o servidor e Ruby
        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');
        const hh = String(targetDate.getHours()).padStart(2, '0');
        const min = String(targetDate.getMinutes()).padStart(2, '0');
        
        validUntil = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch('/api/license/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          pcId: newClient.pcId.trim(),
          clientName: newClient.name.trim(),
          clientContact: newClient.contact.trim(),
          validUntil,
        }),
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`✓ Licença para ${newClient.name} gerada com sucesso! Código disponível na lista abaixo.`);
        setNewClient({ name: '', contact: '', pcId: '', duration: '30', customValidUntil: '' });
        await fetchLicenses();
      } else {
        setErrorMessage(data.error || 'Erro ao gerar licença.');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setErrorMessage('Tempo limite esgotado ao tentar gerar licença. Verifique sua conexão.');
      } else {
        setErrorMessage('Erro de conexão ao gerar licença.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/license/${id}/toggle-status`, { method: 'POST' });
      if (res.ok) fetchLicenses();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  const handleRequestDelete = (lic: any) => {
    setDeletingLicense(lic);
  };

  const handleConfirmDelete = async () => {
    if (!deletingLicense) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/license/${deletingLicense.id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMessage(`✓ Licença de ${deletingLicense.clientName} excluída com sucesso.`);
        await fetchLicenses();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || 'Erro ao excluir licença.');
      }
    } catch (err) {
      console.error('Erro ao excluir licença:', err);
      setErrorMessage('Erro de comunicação ao excluir licença.');
    } finally {
      setIsDeleting(false);
      setDeletingLicense(null);
    }
  };

  const handleOpenReactivateModal = (lic: any) => {
    setReactivatingLicense(lic);
    setReactivateDuration('30');
    setReactivateCustomDate('');
    setReactivateError(null);
  };

  const handleConfirmReactivate = async () => {
    if (!reactivatingLicense) return;
    setIsReactivating(true);
    setReactivateError(null);

    try {
      let validUntil = '';
      if (reactivateDuration === 'custom') {
        if (!reactivateCustomDate) {
          setReactivateError('Por favor, selecione a nova data e hora de validade.');
          setIsReactivating(false);
          return;
        }
        validUntil = reactivateCustomDate;
      } else {
        const targetDate = new Date();
        if (reactivateDuration.startsWith('m')) {
          const minutes = parseInt(reactivateDuration.substring(1));
          targetDate.setMinutes(targetDate.getMinutes() + minutes);
        } else if (reactivateDuration.startsWith('h')) {
          const hours = parseInt(reactivateDuration.substring(1));
          targetDate.setHours(targetDate.getHours() + hours);
        } else {
          const days = parseInt(reactivateDuration);
          targetDate.setDate(targetDate.getDate() + days);
          targetDate.setHours(23, 59, 0, 0);
        }

        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');
        const hh = String(targetDate.getHours()).padStart(2, '0');
        const min = String(targetDate.getMinutes()).padStart(2, '0');
        validUntil = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
      }

      const res = await fetch(`/api/license/${reactivatingLicense.id}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          validUntil,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage(`✓ Licença de ${reactivatingLicense.clientName} reativada com sucesso!`);
        setReactivatingLicense(null);
        fetchLicenses();
      } else {
        setReactivateError(data.error || 'Erro ao reativar licença.');
      }
    } catch (err: any) {
      setReactivateError('Erro de conexão ao reativar licença.');
    } finally {
      setIsReactivating(false);
    }
  };

  const isValidRubyCode = (code?: string): boolean => {
    if (!code || typeof code !== 'string') return false;
    const trimmed = code.trim();
    if (trimmed.length < 500) return false;
    if (trimmed.startsWith('<')) return false;
    const header = trimmed.slice(0, 300).toLowerCase();
    if (header.includes('<!doctype') || header.includes('<html') || header.includes('302 found') || header.includes('__cookie_check')) {
      return false;
    }
    return trimmed.includes('SKPRenderPro') || trimmed.includes('module ') || trimmed.includes('require \'sketchup');
  };

  const fetchPluginCode = async (overrideUrl?: string): Promise<string> => {
    setLoadingPluginCode(true);
    let resolvedCode = '';
    const srvUrl = overrideUrl !== undefined ? overrideUrl : targetServerUrl;
    const urlQuery = srvUrl && srvUrl.trim() ? `&serverUrl=${encodeURIComponent(srvUrl.trim())}` : '';
    try {
      // 1. Tentar obter a versão mais recente diretamente do endpoint JSON
      try {
        const resJson = await fetch(`/api/plugin-code?t=${Date.now()}${urlQuery}`);
        if (resJson.ok) {
          const contentType = resJson.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await resJson.json();
            if (data && data.success && data.code && isValidRubyCode(data.code)) {
              resolvedCode = data.code;
            }
          }
        }
      } catch (_) {}

      // 2. Fallback para download raw
      if (!resolvedCode) {
        try {
          const res = await fetch(`/api/download/skp_render_pro.rb?t=${Date.now()}${urlQuery}`);
          if (res.ok) {
            const text = await res.text();
            if (isValidRubyCode(text)) {
              resolvedCode = text;
            }
          }
        } catch (_) {}
      }

      // 3. Fallback Infalível Embutido
      if (!resolvedCode || !isValidRubyCode(resolvedCode)) {
        resolvedCode = SKP_PLUGIN_STABLE_CODE;
      }
      setPluginRubyCode(resolvedCode);
      return resolvedCode;
    } catch (err) {
      console.warn('Erro ao carregar código do plugin, usando versão estável embutida:', err);
      resolvedCode = SKP_PLUGIN_STABLE_CODE;
      setPluginRubyCode(resolvedCode);
      return resolvedCode;
    } finally {
      setLoadingPluginCode(false);
    }
  };

  const downloadRubyFileSafely = (codeContent: string, targetFilename: string) => {
    try {
      let finalContent = codeContent;
      if (!finalContent || !isValidRubyCode(finalContent)) {
        finalContent = SKP_PLUGIN_STABLE_CODE;
      }

      // Se estiver rodando dentro do SketchUp, abre o diálogo diretamente na pasta Plugins
      // Envia o código Ruby limpo diretamente, sem prefixos ou codificação intermediária
      if ((window as any).sketchup?.salvar_plugin_direto) {
        (window as any).sketchup.salvar_plugin_direto(finalContent);
        setSuccessMessage('Janela aberta diretamente na pasta Plugins do seu SketchUp!');
        return;
      } else if ((window as any).sketchup?.baixar_rb) {
        (window as any).sketchup.baixar_rb(finalContent);
        setSuccessMessage('Janela aberta diretamente na pasta Plugins do seu SketchUp!');
        return;
      }

      const blob = new Blob([finalContent], { type: 'text/x-ruby;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = targetFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 1500);
      setSuccessMessage(`Arquivo ${targetFilename} limpo baixado com sucesso!`);
    } catch (err) {
      // Se qualquer erro ocorrer no DOM, tenta fallback simples
      try {
        const fallbackBlob = new Blob([SKP_PLUGIN_STABLE_CODE], { type: 'text/x-ruby;charset=utf-8' });
        const fallbackUrl = window.URL.createObjectURL(fallbackBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = fallbackUrl;
        a.download = targetFilename;
        document.body.appendChild(a);
        a.click();
        setSuccessMessage(`Arquivo ${targetFilename} baixado via contingência!`);
      } catch (_) {
        setErrorMessage('Erro ao acionar download no navegador.');
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPluginCode();
      fetchLicenses();
      fetchReleaseInfo();
    }
  }, [isOpen]);

  const filteredLicenses = licenses.filter(l => {
    const matchesSearch = l.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          l.pcId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = statusFilter === 'all' || l.computedStatus === statusFilter;
    return matchesSearch && matchesFilter;
  });

  if (!isOpen) return null;

  const rubyScriptExample = `# COMO GERAR NO CONSOLE RUBY DO SKETCHUP (EXEMPLO):
# 1. Abra o SketchUp -> Janela -> Console Ruby
# 2. Cole este comando substituindo pelos dados do seu cliente:

require 'base64'; require 'openssl'; require 'json'; require 'date'
CHAVE = "Minha_Senha_Secreta_Sketchup_2026!"
id_cliente = "SEU_ID_PC"
validade = "2026-12-31T23:59"

dados = JSON.generate({"id" => id_cliente, "validade" => validade})
assinatura = OpenSSL::HMAC.hexdigest('SHA256', CHAVE, dados)
licenca = Base64.strict_encode64("#{dados}|#{assinatura}")
puts "=== SUA LICENCA GERADA ==="
puts licenca`;

  return (
    <div className="admin-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#11241C] border border-[#2B5E46] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-gray-200">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-[#244A37] flex items-center justify-between bg-[#0C1A14]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#20523C] border border-[#3E8B67] flex items-center justify-center text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Painel do Administrador
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                  v2.0 Protegido
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Gerencie scripts Ruby e ofusque códigos para o plugin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#1A382B] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#244A37] bg-[#0E1E17] px-4 pt-2 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('licenses')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'licenses'
                ? 'border-emerald-400 text-emerald-300 bg-[#163024]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Gestão de Licenças
          </button>

          <button
            onClick={() => setActiveTab('ruby')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'ruby'
                ? 'border-emerald-400 text-emerald-300 bg-[#163024]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Script Ruby Offline
          </button>

          <button
            onClick={() => setActiveTab('plugin')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'plugin'
                ? 'border-emerald-400 text-emerald-300 bg-[#163024]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Baixar Plugin (.rb)</span>
            {releaseInfo?.activeAlert && (
              <span className="flex h-2 w-2 relative ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('obfuscator')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'obfuscator'
                ? 'border-emerald-400 text-emerald-300 bg-[#163024]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Ofuscador de Código (Acusador)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: GESTÃO DE LICENÇAS */}
          {activeTab === 'licenses' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Coluna 1: Formulário de Cadastro */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-[#142A1F] border border-[#27533E] rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <UserPlus className="w-4 h-4" />
                    <h3 className="text-sm font-bold uppercase">Nova Licença</h3>
                  </div>

                  <form onSubmit={handleGenerateLicense} className="space-y-3.5">
                    <div className="space-y-1.5">
                      <label 
                        className="text-xs text-emerald-300 font-bold uppercase tracking-wider block"
                        style={{ color: '#6ee7b7' }}
                      >
                        Nome do Cliente
                      </label>
                      <input 
                        type="text"
                        value={newClient.name}
                        onChange={e => setNewClient({...newClient, name: e.target.value})}
                        className="w-full bg-[#081810] text-white placeholder-gray-400 border border-[#2D5A44] rounded-lg px-3 py-2.5 text-xs font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40 outline-none transition-all shadow-inner"
                        style={{ color: '#ffffff', backgroundColor: '#081810' }}
                        placeholder="Ex: João Silva"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label 
                        className="text-xs text-emerald-300 font-bold uppercase tracking-wider block"
                        style={{ color: '#6ee7b7' }}
                      >
                        Telefone / WhatsApp
                      </label>
                      <input 
                        type="text"
                        value={newClient.contact}
                        onChange={e => setNewClient({...newClient, contact: e.target.value})}
                        className="w-full bg-[#081810] text-white placeholder-gray-400 border border-[#2D5A44] rounded-lg px-3 py-2.5 text-xs font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40 outline-none transition-all shadow-inner"
                        style={{ color: '#ffffff', backgroundColor: '#081810' }}
                        placeholder="Ex: (11) 99999-9999"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label 
                        className="text-xs text-emerald-300 font-bold uppercase tracking-wider block"
                        style={{ color: '#6ee7b7' }}
                      >
                        ID do Computador (PC ID)
                      </label>
                      <input 
                        type="text"
                        value={newClient.pcId}
                        onChange={e => setNewClient({...newClient, pcId: e.target.value})}
                        className="w-full bg-[#081810] text-white font-mono placeholder-gray-400 border border-[#2D5A44] rounded-lg px-3 py-2.5 text-xs font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40 outline-none transition-all shadow-inner"
                        style={{ color: '#ffffff', backgroundColor: '#081810' }}
                        placeholder="UUID do PC (Cole o ID do cliente)"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label 
                        className="text-xs text-emerald-300 font-bold uppercase tracking-wider block"
                        style={{ color: '#6ee7b7' }}
                      >
                        Duração da Licença
                      </label>
                      <select
                        value={newClient.duration}
                        onChange={e => setNewClient({...newClient, duration: e.target.value})}
                        className="w-full bg-[#081810] text-white border border-[#2D5A44] rounded-lg px-3 py-2.5 text-xs font-medium focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40 outline-none cursor-pointer transition-all shadow-inner"
                        style={{ color: '#ffffff', backgroundColor: '#081810' }}
                      >
                        <optgroup label="Testes Rápidos" className="bg-[#142A1F] text-emerald-300 font-bold">
                          <option value="m5" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>5 Minutos</option>
                          <option value="m15" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>15 Minutos</option>
                          <option value="m30" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>30 Minutos</option>
                          <option value="h1" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>1 Hora</option>
                          <option value="h3" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>3 Horas</option>
                          <option value="h6" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>6 Horas</option>
                          <option value="h12" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>12 Horas</option>
                        </optgroup>
                        <optgroup label="Teste Grátis (Dias)" className="bg-[#142A1F] text-emerald-300 font-bold">
                          <option value="1" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>1 Dia (Teste)</option>
                          <option value="3" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>3 Dias (Teste)</option>
                        </optgroup>
                        <optgroup label="Planos Normais" className="bg-[#142A1F] text-emerald-300 font-bold">
                          <option value="30" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>1 Mês</option>
                          <option value="90" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>3 Meses</option>
                          <option value="180" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>6 Meses</option>
                          <option value="365" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>1 Ano</option>
                          <option value="3650" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>Vitalício (10 anos)</option>
                        </optgroup>
                        <option value="custom" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>Personalizado (Data/Hora)</option>
                      </select>
                    </div>

                    {newClient.duration === 'custom' && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <label 
                          className="text-xs text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1 block"
                          style={{ color: '#6ee7b7' }}
                        >
                          <Calendar className="w-3.5 h-3.5" /> Selecionar Validade Exata
                        </label>
                        <input 
                          type="datetime-local"
                          value={newClient.customValidUntil}
                          onChange={e => setNewClient({...newClient, customValidUntil: e.target.value})}
                          className="w-full bg-[#081810] border border-emerald-500/40 rounded-lg px-3 py-2.5 text-xs text-white focus:border-emerald-400 outline-none"
                          style={{ color: '#ffffff', backgroundColor: '#081810', colorScheme: 'dark' }}
                          required
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={generating}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                    >
                      <ShieldCheck className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                      {generating ? 'Gerando...' : 'GERAR E SALVAR LICENÇA'}
                    </button>
                  </form>
                </div>

                {successMessage && (
                  <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 animate-fade-in">
                    {successMessage}
                  </div>
                )}
                
                {errorMessage && (
                  <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-[11px] text-red-300 animate-fade-in">
                    {errorMessage}
                  </div>
                )}
              </div>

              {/* Coluna 2 e 3: Lista de Clientes */}
              <div className="lg:col-span-2 space-y-3">
                {/* Banner de Aviso Rápido de Atualização do Plugin */}
                <div className={`p-2.5 px-3 rounded-xl border flex items-center justify-between gap-2 flex-wrap text-xs ${releaseInfo?.activeAlert ? 'bg-orange-950/40 border-orange-500/50 text-orange-200' : 'bg-[#142A1F] border-[#27533E] text-stone-300'}`}>
                  <div className="flex items-center gap-2">
                    <BellRing className={`w-4 h-4 ${releaseInfo?.activeAlert ? 'text-orange-400 animate-pulse' : 'text-emerald-400'}`} />
                    <span>
                      {releaseInfo?.activeAlert ? (
                        <strong className="text-orange-300">Alerta de Atualização do Plugin ATIVO no SketchUp</strong>
                      ) : (
                        <span>Status do Plugin: <strong>Normal (Sem alerta pendente)</strong></span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('plugin')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${releaseInfo?.activeAlert ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-400' : 'bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border-emerald-500/40'}`}
                    >
                      {releaseInfo?.activeAlert ? 'Gerenciar Alerta (.rb)' : '📢 Lançar Atualização'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#0C1A14] p-3 rounded-xl border border-[#244A37]">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input 
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Buscar por nome ou PC ID..."
                      className="w-full bg-[#081810] text-white placeholder-gray-400 border border-[#1F4733] rounded-lg pl-9 pr-3 py-1.5 text-xs focus:border-emerald-400 outline-none"
                      style={{ color: '#ffffff', backgroundColor: '#081810' }}
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="w-3.5 h-3.5 text-gray-400" />
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as any)}
                      className="bg-[#081810] text-white border border-[#1F4733] rounded-lg px-2 py-1.5 text-[11px] focus:border-emerald-400 outline-none cursor-pointer"
                      style={{ color: '#ffffff', backgroundColor: '#081810' }}
                    >
                      <option value="all" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>Todos os Status</option>
                      <option value="active" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>Ativos</option>
                      <option value="expired" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>Expirados</option>
                      <option value="revoked" className="bg-[#081810] text-white" style={{ color: '#ffffff', backgroundColor: '#081810' }}>Bloqueados</option>
                    </select>
                  </div>
                </div>

                <div className="bg-[#0C1A14] border border-[#244A37] rounded-xl overflow-hidden">
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-[#163024] z-10">
                        <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <th className="px-4 py-3">Cliente</th>
                          <th className="px-4 py-3">Validade</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F4733]">
                        {loadingList ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                              <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                              Carregando lista de licenças...
                            </td>
                          </tr>
                        ) : filteredLicenses.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-10 text-center text-gray-500 text-xs italic">
                              Nenhum cliente encontrado.
                            </td>
                          </tr>
                        ) : (
                          filteredLicenses.map((lic) => (
                            <tr key={lic.id} className="hover:bg-[#12291E] transition-colors group">
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-white">{lic.clientName}</span>
                                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                    <Hash className="w-2.5 h-2.5" />
                                    {lic.pcId.slice(0, 16)}...
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="text-[11px] text-gray-300">{lic.formattedValidUntil}</span>
                                  <span className={`text-[10px] font-medium ${lic.daysRemaining <= 3 || (lic.remainingText && (lic.remainingText.includes('hora') || lic.remainingText.includes('minuto'))) ? 'text-amber-400' : 'text-gray-500'}`}>
                                    {lic.computedStatus === 'expired' ? 'Expirou' : lic.remainingText || `${lic.daysRemaining} dias restantes`}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                  lic.computedStatus === 'active' 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : lic.computedStatus === 'expired'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                  {lic.computedStatus === 'active' ? 'Ativo' : lic.computedStatus === 'expired' ? 'Expirado' : 'Bloqueado'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Botão de Reativar destacado para Licenças Expiradas */}
                                  {lic.computedStatus === 'expired' && (
                                    <button
                                      onClick={() => handleOpenReactivateModal(lic)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95"
                                      title="Reativar e renovar licença expirada"
                                    >
                                      <RotateCw className="w-3 h-3" />
                                      <span>Reativar</span>
                                    </button>
                                  )}

                                  {/* Se já estiver ativa, botão para Renovar / Estender validade */}
                                  {lic.computedStatus === 'active' && (
                                    <button
                                      onClick={() => handleOpenReactivateModal(lic)}
                                      className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                      title="Renovar ou Estender Validade"
                                    >
                                      <Calendar className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  <button 
                                    onClick={() => onCopyText(lic.licenseKey, `lic-${lic.id}`)}
                                    className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Copiar Chave de Licença"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleToggleStatus(lic.id)}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                      lic.status === 'revoked' 
                                        ? 'text-emerald-400 hover:bg-emerald-500/10' 
                                        : 'text-amber-400 hover:bg-amber-500/10'
                                    }`}
                                    title={lic.status === 'revoked' ? "Desbloquear" : "Bloquear"}
                                  >
                                    {lic.status === 'revoked' ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldX className="w-3.5 h-3.5" />}
                                  </button>
                                  <button 
                                    onClick={() => handleRequestDelete(lic)}
                                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Excluir Licença"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SCRIPT RUBY OFFLINE */}
          {activeTab === 'ruby' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-white">Script Gerador em Ruby Puro</h3>
                  <p className="text-xs text-gray-400">
                    Você pode rodar este script no seu computador ou no Console Ruby do SketchUp
                  </p>
                </div>
                <a
                  href={`/api/download/gerador_licenca.rb?t=${Date.now()}`}
                  className="px-3 py-1.5 bg-[#1F4B38] hover:bg-[#285F47] border border-[#3E8B67] rounded-xl text-xs font-medium text-emerald-300 flex items-center gap-1.5 transition-colors no-underline cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar gerador_licenca.rb
                </a>
              </div>

              <div className="relative">
                <pre className="p-3 bg-[#08120D] border border-[#1F4733] rounded-xl text-[11px] font-mono text-gray-300 overflow-x-auto max-h-[300px]">
                  {rubyScriptExample}
                </pre>
                <button
                  onClick={() => onCopyText(rubyScriptExample, 'modal-ruby-code')}
                  className="absolute top-2 right-2 px-2.5 py-1 bg-[#1A382B] hover:bg-[#244E3C] border border-[#356B52] rounded-lg text-xs text-gray-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedId === 'modal-ruby-code' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Código
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: BAIXAR PLUGIN .RB */}
          {activeTab === 'plugin' && (
            <div className="space-y-4">
              {/* CONTROLE DE NOTIFICAÇÃO DE ATUALIZAÇÃO DO PLUGIN PARA CLIENTES */}
              <div className="p-4 bg-gradient-to-br from-amber-950/60 via-[#162a20] to-black/90 border-2 border-amber-500/50 rounded-xl space-y-3 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl flex items-center justify-center ${releaseInfo?.activeAlert ? 'bg-orange-500/25 text-orange-400 border border-orange-500/50 animate-pulse' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                      <BellRing className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        Aviso de Atualização do Plugin para Clientes
                      </h3>
                      <p className="text-[11px] text-gray-300">
                        Clique no botão abaixo para avisar a todos os clientes que há uma nova versão do plugin (.rb).
                      </p>
                    </div>
                  </div>

                  {/* Badge de Status Atual */}
                  <div className="flex items-center gap-1.5">
                    {releaseInfo?.activeAlert ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/50 text-xs font-bold animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                        Alerta Ativo (Botão Laranja Ligado)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Normal (Botão Padrão Verde)
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-black/50 border border-stone-800 rounded-lg flex items-center justify-between text-xs text-stone-300 flex-wrap gap-2">
                  <div>
                    <span className="text-stone-400">Versão cadastrada: </span>
                    <strong className="text-white font-mono">{releaseInfo?.versionName || '2.1.0'}</strong>
                    {releaseInfo?.releaseDate && (
                      <span className="text-stone-400 ml-2">
                        (Lançada em: {new Date(releaseInfo.releaseDate).toLocaleString('pt-BR')})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {releaseInfo?.activeAlert 
                      ? 'O botão .RB no SketchUp piscará em laranja para os clientes até que eles façam o download.'
                      : 'Nenhum alerta ativo. Os clientes estão com o botão verde estável.'}
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handlePublishPluginRelease}
                    disabled={isPublishingRelease}
                    className="py-3 px-4 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 border border-orange-400/80 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                    title="Faz o botão .RB no SketchUp de todos os clientes piscar em laranja até que eles baixem e atualizem o arquivo"
                  >
                    <BellRing className={`w-4 h-4 ${isPublishingRelease ? 'animate-spin' : ''}`} />
                    <span>📢 Lançar Atualização (Ativar Botão Laranja no Plugin)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearPluginAlert}
                    disabled={isPublishingRelease || !releaseInfo?.activeAlert}
                    className="py-3 px-4 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-xl text-xs font-semibold text-stone-300 hover:text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Desativa o alerta laranja para todos os clientes"
                  >
                    <X className="w-4 h-4 text-stone-400" />
                    <span>⏹️ Desativar Alerta (Apagar Botão Laranja)</span>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-xl space-y-2 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-bold text-amber-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Passo Obrigatório: Limpar arquivos antigos na pasta Plugins</span>
                </div>
                <p>
                  Se o SketchUp exibiu erro com <code>skp_render_pro (8).rb</code> ou <code>&lt;!doctype html&gt;</code>, é porque o navegador salvou arquivos com números entre parênteses.
                </p>
                <p className="font-semibold">
                  Abra a pasta abaixo e APAGUE todos os arquivos com parênteses como <code>skp_render_pro (1).rb</code>, <code>(2).rb</code>, etc:
                </p>
                <div className="p-2.5 bg-black/60 rounded-lg font-mono text-[11px] text-amber-300 border border-amber-600/40 select-all">
                  %AppData%\SketchUp\SketchUp 2025\SketchUp\Plugins
                </div>
              </div>

              <div className="p-4 bg-[#142A1F] border border-[#27533E] rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    Arquivo Oficial: skp_render_pro.rb (v2.1.0 - Estado Mais Estável)
                  </h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-medium">
                    3.540 Linhas de Código Puro
                  </span>
                </div>
                <p className="text-gray-300">
                  Código Ruby puro original e completo, compatível de forma nativa com todas as versões do Trimble SketchUp (2017 até 2026+ no Windows e macOS). Sem erros de zlib ou bloqueios de antivírus.
                </p>

                {/* CONFIGURAÇÃO DE SERVIDOR & EXPLICAÇÃO MULTI-PC */}
                <div className="p-3 bg-black/40 border border-emerald-500/20 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-300 font-semibold text-[11px] flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      URL do Servidor Gravada no Plugin (.rb):
                    </span>
                    <span className="text-[10px] text-gray-400">Personalizável para outros computadores</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={targetServerUrl}
                      onChange={(e) => setTargetServerUrl(e.target.value)}
                      placeholder="https://sua-url-publica.com ou http://localhost:3000"
                      className="flex-1 bg-black/60 border border-[#27533E] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 font-mono focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setTargetServerUrl('http://localhost:3000')}
                      className="px-2 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 rounded-lg text-[10px] text-emerald-300 font-medium cursor-pointer"
                      title="Usar servidor local (iniciar_servidor_local.bat)"
                    >
                      Localhost
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetServerUrl('http://localhost:3000')}
                      className="px-2 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 rounded-lg text-[10px] text-emerald-300 font-medium cursor-pointer"
                      title="Usar padrão automático (Localhost:3000)"
                    >
                      Padrão (Localhost)
                    </button>
                  </div>
                  <div className="p-2.5 bg-blue-950/30 border border-blue-500/30 rounded-lg text-[11px] text-blue-200/90 leading-relaxed">
                    <strong className="text-blue-300">💡 Por que em outro PC aparecia a tela do AI Studio?</strong><br />
                    O link <code className="text-blue-300 font-mono">ais-dev</code> é restrito à sua conta de desenvolvedor. Quando outra pessoa tentava acessar, o Google barrava e redirecionava para o login do AI Studio. Agora o plugin está 100% blindado: se a URL requerer login ou estiver offline, ele abre o <strong>Painel Nativo do SKP Render Pro IA</strong> com identificação de UUID, licença e ferramentas, <strong>sem nunca exibir o site do AI Studio!</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const code = await fetchPluginCode(targetServerUrl);
                      downloadRubyFileSafely(code, 'skp_render_pro_protected.rb');
                    }}
                    className="py-2.5 px-3 bg-[#235841] hover:bg-[#2D6F52] border border-emerald-500/50 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
                    title="Baixar versão oficial protegida do plugin skp_render_pro_protected.rb com o servidor configurado"
                  >
                    <Download className="w-4 h-4 text-emerald-300" />
                    <span>Baixar skp_render_pro_protected.rb</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRestoreStablePlugin}
                    className="py-2.5 px-3 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 rounded-xl text-xs font-semibold text-emerald-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    title="Restaura imediatamente o arquivo skp_render_pro.rb para a versão original mais estável"
                  >
                    <Wrench className="w-4 h-4 text-emerald-400" />
                    <span>Restaurar Mais Estável</span>
                  </button>

                  <a
                    href={`/api/download/limpar_e_desbloquear_licenca.rb?t=${Date.now()}`}
                    className="py-2.5 px-3 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 rounded-xl text-xs font-semibold text-amber-300 flex items-center justify-center gap-2 transition-colors cursor-pointer no-underline"
                    title="Baixar script Ruby que limpa todos os registros do SketchUp automaticamente"
                  >
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    <span>Script Desbloqueio (.rb)</span>
                  </a>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => onCopyText(pluginRubyCode, 'modal-plugin-code')}
                    disabled={!pluginRubyCode}
                    className="w-full py-2.5 px-4 bg-[#1A382B] hover:bg-[#244E3C] border border-[#3E8B67] rounded-xl text-xs font-semibold text-emerald-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {copiedId === 'modal-plugin-code' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Código Copiado com Sucesso!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Código Completo do Plugin (.rb)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* DICA DE ATIVAÇÃO DO ATALHO NO SKETCHUP */}
                <div className="p-3 bg-[#0c1e15] border border-emerald-500/30 rounded-xl space-y-2 mt-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Como encontrar o Atalho e Menu no SketchUp:</span>
                  </div>
                  <ul className="text-[11px] text-gray-300 space-y-1.5 list-disc pl-4">
                    <li>
                      <b>Menu Extensões:</b> No topo do SketchUp, clique em <b>Extensões</b> &gt; <b>SKP RENDER PRO IA</b> &gt; <b>⚡ Abrir Painel</b>.
                    </li>
                    <li>
                      <b>Se a barra de atalhos sumir:</b> Acesse <b>Extensões</b> &gt; <b>SKP RENDER PRO IA</b> &gt; clique em <b>🛠️ Mostrar / Restaurar Barra de Ferramentas</b>.
                    </li>
                    <li>
                      <b>Pelas Barras do SketchUp:</b> Clique com o botão direito em qualquer barra de ferramentas do SketchUp (ou vá em <b>Visualizar &gt; Barras de Ferramentas</b>) e marque a caixinha <b>SKP RENDER PRO IA</b>.
                    </li>
                    <li>
                      <b>Local do arquivo:</b> Coloque o arquivo em <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded">%AppData%\SketchUp\SketchUp [Ano]\SketchUp\Plugins\</code>.
                    </li>
                  </ul>
                </div>
              </div>

              {pluginRubyCode && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-gray-400">Prévia do código Ruby (sem HTML):</span>
                    <span className="text-[10px] text-emerald-400 font-mono">100% Ruby Puro</span>
                  </div>
                  <pre className="p-3 bg-[#08120D] border border-[#1F4733] rounded-xl text-[10px] font-mono text-gray-300 overflow-x-auto max-h-[160px]">
                    {pluginRubyCode.slice(0, 800)}...
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: OFUSCADOR DE CÓDIGO */}
          {activeTab === 'obfuscator' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#142A1F] border border-emerald-500/20 rounded-xl space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Ofuscador Ruby Pro</h3>
                    <p className="text-[11px] text-gray-400">Proteja seu código contra leitura e modificações antes de enviar ao cliente.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest ml-1">1. Cole o Código Ruby Original</label>
                    <textarea
                      value={rubyToObfuscate}
                      onChange={(e) => setRubyToObfuscate(e.target.value)}
                      placeholder="# Cole aqui o conteúdo do seu arquivo .rb..."
                      className="w-full bg-[#0C1A14] border border-[#2D5A44] rounded-xl p-3 text-[11px] font-mono text-gray-300 h-[220px] focus:outline-none focus:border-emerald-500 leading-relaxed"
                    />
                    <div className="flex justify-between items-center px-1">
                      <button
                        type="button"
                        onClick={handleLoadOriginalRuby}
                        className="text-[10px] text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <RotateCw className="w-3 h-3" /> Carregar skp_render_pro.rb original
                      </button>
                      <button
                        onClick={() => setRubyToObfuscate('')}
                        className="text-[10px] text-red-400 hover:underline cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleObfuscate}
                    disabled={loadingObfuscation || !rubyToObfuscate.trim()}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#1A382B] disabled:text-gray-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Sparkles className={`w-4 h-4 ${loadingObfuscation ? 'animate-spin' : ''}`} />
                    <span>{loadingObfuscation ? 'Protegendo Código...' : 'GERAR CÓDIGO PROTEGIDO'}</span>
                  </button>

                  {obfuscatedResult && (
                    <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest ml-1">2. Código Protegido Gerado</label>
                        <div className="bg-[#0C1A14] border border-emerald-500/40 rounded-xl p-3 space-y-3">
                          <div className="text-[11px] font-mono text-emerald-400/90 break-all bg-black/30 p-3 rounded-lg border border-emerald-900/30 overflow-auto max-h-[100px]">
                            {obfuscatedResult.substring(0, 300)}...
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => onCopyText(obfuscatedResult, 'modal-obfuscated-code')}
                              className="flex items-center justify-center gap-2 py-2.5 bg-[#1A382B] border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-bold hover:bg-[#234A39] transition cursor-pointer"
                            >
                              <Copy className="w-4 h-4" />
                              <span>{copiedId === 'modal-obfuscated-code' ? 'Copiado!' : 'Copiar Código'}</span>
                            </button>
                            <button
                              onClick={downloadObfuscated}
                              className="flex items-center justify-center gap-2 py-2.5 bg-[#1A382B] border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-bold hover:bg-[#234A39] transition cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                              <span>Baixar {obfuscatedFilename}</span>
                            </button>
                            <button
                              onClick={handlePublishProtected}
                              disabled={loadingPublish}
                              className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition cursor-pointer shadow-md disabled:bg-gray-600"
                            >
                              <ShieldCheck className={`w-4 h-4 ${loadingPublish ? 'animate-spin' : ''}`} />
                              <span>{loadingPublish ? 'Publicando...' : 'PUBLICAR PARA CLIENTES'}</span>
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500 italic mt-1 text-center">
                          O arquivo gerado agora é ilegível para humanos, mas funciona normalmente no SketchUp.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-[#244A37] bg-[#0C1A14] flex items-center justify-between text-xs">
          <span className="text-gray-500 text-[11px]">
            🔒 Acesso Exclusivo com Senha Mestra
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1A382B] hover:bg-[#254F3D] text-xs font-medium text-gray-200 rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* DIÁLOGO / MODAL DE REATIVAÇÃO E RENOVAÇÃO DE LICENÇA */}
      {reactivatingLicense && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0C1A14] border border-emerald-500/40 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1F4733] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-inner">
                  <RotateCw className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Reativar / Renovar Licença</h4>
                  <p className="text-[11px] text-gray-400">Estender a validade e reativar o acesso</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReactivatingLicense(null)}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dados do Cliente */}
            <div className="bg-black/40 border border-[#1F4733] rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Cliente:</span>
                <span className="font-bold text-white text-sm">{reactivatingLicense.clientName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">PC ID:</span>
                <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                  {reactivatingLicense.pcId}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Validade Atual / Anterior:</span>
                <span className="text-gray-300 font-medium">{reactivatingLicense.formattedValidUntil}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Status atual:</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                  reactivatingLicense.computedStatus === 'expired'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                  {reactivatingLicense.computedStatus === 'expired' ? 'Expirada' : 'Ativa'}
                </span>
              </div>
            </div>

            {/* Seleção do Novo Prazo */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-gray-200 block">
                Novo Prazo a partir de hoje:
              </label>
              
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '30 Dias (1 Mês)', value: '30' },
                  { label: '90 Dias (3 Meses)', value: '90' },
                  { label: '180 Dias (6 Meses)', value: '180' },
                  { label: '1 Ano (365 Dias)', value: '365' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setReactivateDuration(opt.value);
                      setReactivateCustomDate('');
                    }}
                    className={`py-2 px-3 text-center rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      reactivateDuration === opt.value
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-md font-bold'
                        : 'bg-black/30 text-gray-300 border-[#1F4733] hover:border-emerald-500/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Opções rápidas para Teste ou Personalizada */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setReactivateDuration('7');
                    setReactivateCustomDate('');
                  }}
                  className={`flex-1 py-1.5 px-2 text-[11px] rounded-lg border transition-all cursor-pointer text-center ${
                    reactivateDuration === '7'
                      ? 'bg-emerald-600 text-white border-emerald-400 font-bold'
                      : 'bg-black/30 text-gray-400 border-[#1F4733] hover:text-gray-200'
                  }`}
                >
                  7 Dias
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReactivateDuration('h1');
                    setReactivateCustomDate('');
                  }}
                  className={`flex-1 py-1.5 px-2 text-[11px] rounded-lg border transition-all cursor-pointer text-center ${
                    reactivateDuration === 'h1'
                      ? 'bg-emerald-600 text-white border-emerald-400 font-bold'
                      : 'bg-black/30 text-gray-400 border-[#1F4733] hover:text-gray-200'
                  }`}
                >
                  1 Hora (Teste)
                </button>
                <button
                  type="button"
                  onClick={() => setReactivateDuration('custom')}
                  className={`flex-1 py-1.5 px-2 text-[11px] rounded-lg border transition-all cursor-pointer text-center ${
                    reactivateDuration === 'custom'
                      ? 'bg-emerald-600 text-white border-emerald-400 font-bold'
                      : 'bg-black/30 text-gray-400 border-[#1F4733] hover:text-gray-200'
                  }`}
                >
                  Personalizado
                </button>
              </div>

              {reactivateDuration === 'custom' && (
                <div className="pt-2 animate-in fade-in duration-200">
                  <label className="text-[11px] text-emerald-300 font-semibold block mb-1" style={{ color: '#6ee7b7' }}>Escolha data e hora limite:</label>
                  <input
                    type="datetime-local"
                    value={reactivateCustomDate}
                    onChange={(e) => setReactivateCustomDate(e.target.value)}
                    className="w-full bg-[#081810] border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-400 outline-none"
                    style={{ color: '#ffffff', backgroundColor: '#081810', colorScheme: 'dark' }}
                    required
                  />
                </div>
              )}
            </div>

            {reactivateError && (
              <div className="p-2.5 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-300">
                {reactivateError}
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1F4733]">
              <button
                type="button"
                onClick={() => setReactivatingLicense(null)}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isReactivating}
                onClick={handleConfirmReactivate}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isReactivating ? 'animate-spin' : ''}`} />
                <span>{isReactivating ? 'Reativando...' : 'CONFIRMAR REATIVAÇÃO'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE LICENÇA */}
      {deletingLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0D1E16] border border-red-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-gray-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F4733]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-500/20 rounded-xl text-red-400 border border-red-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Excluir Licença</h3>
                  <p className="text-[11px] text-gray-400">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeletingLicense(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-xl space-y-2 text-xs">
              <p className="text-gray-200">
                Tem certeza que deseja excluir permanentemente a licença do cliente <strong className="text-white font-bold">{deletingLicense.clientName}</strong>?
              </p>
              <div className="p-2.5 bg-black/40 rounded-lg text-[11px] font-mono text-gray-300 border border-[#1F4733] space-y-1">
                <div><span className="text-gray-500">PC ID:</span> {deletingLicense.pcId}</div>
                <div><span className="text-gray-500">Validade:</span> {deletingLicense.formattedValidUntil || deletingLicense.validUntil}</div>
                {deletingLicense.clientContact && (
                  <div><span className="text-gray-500">Contato:</span> {deletingLicense.clientContact}</div>
                )}
              </div>
              <p className="text-[11px] text-red-300">
                O cliente perderá o acesso e a chave será desativada imediatamente.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1F4733]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingLicense(null)}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'animate-pulse' : ''}`} />
                <span>{isDeleting ? 'Excluindo...' : 'CONFIRMAR EXCLUSÃO'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
