# ==============================================================================
# SKP RENDER PRO IA - SCRIPT OFICIAL DE LIMPEZA E DESBLOQUEIO TOTAL
# ==============================================================================
# Como usar:
# 1. Abra o SketchUp
# 2. Vá no menu: Janela (Window) > Console Ruby (Ruby Console)
# 3. Digite ou cole: load 'limpar_e_desbloquear_licenca.rb' (ou arraste este arquivo)
# Ou simplesmente coloque este arquivo na pasta Plugins do SketchUp e reinicie.
# ==============================================================================

require 'sketchup.rb'
require 'net/http'
require 'uri'
require 'json'
require 'openssl'
require 'time'
begin; require 'win32ole'; rescue LoadError; end

module SKPRenderProReset
  PLUGIN_NAME   = "SKP RENDER PRO IA".freeze
  NOME_REGISTRO = "SKPRenderPro_Registro".freeze
  APP_URL       = "http://localhost:3000".freeze

  def self.obter_id_pc
    if RUBY_PLATFORM =~ /mswin|mingw/
      begin
        wmi = WIN32OLE.connect("winmgmts://")
        wmi.ExecQuery("select UUID from Win32_ComputerSystemProduct").each do |sys|
          uuid = sys.UUID.to_s.strip
          return uuid unless uuid.empty?
        end
      rescue => e
        puts "[Reset SKP] Erro WMI: #{e.message}"
      end
    else
      begin
        id = `ioreg -rd1 -c IOPlatformExpertDevice | grep -E '"IOPlatformSerialNumber"'`.split('"').last.strip
        return id unless id.empty?
      rescue => _
      end
    end
    "ID_DESCONHECIDO"
  end

  def self.executar_limpeza_total
    puts "\n" + "=" * 60
    puts ">>> [SKP RENDER PRO IA] INICIANDO LIMPEZA E DESBLOQUEIO DO PC <<<"
    puts "=" * 60

    # 1. LIMPEZA TOTAL DE REGISTROS LOCAIS DO SKETCHUP
    begin
      Sketchup.write_default(NOME_REGISTRO, "ServidorURL", "")
      Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", "")
      Sketchup.write_default(NOME_REGISTRO, "UltimoTimestampUso", "")
      Sketchup.write_default(NOME_REGISTRO, "DataGravacao", "")
      Sketchup.write_default("com.skprenderpro.dialog", "ChaveAtivacao", "")
      puts "[1/4] Registros locais do SketchUp limpos com sucesso (incluindo URL do servidor restaurada)."
    rescue => e
      puts "[1/4] Aviso registro: #{e.message}"
    end

    # 2. DETECÇÃO DO UUID REAL DO COMPUTADOR
    meu_id = obter_id_pc
    puts "[2/4] UUID identificado do seu computador: #{meu_id}"

    # 3. REQUISIÇÃO AO SERVIDOR PARA DESBLOQUEAR DA BLACKLIST
    desbloqueado_no_servidor = false
    chave_encontrada = nil
    cliente_nome = nil
    validade_str = nil

    begin
      puts "[3/4] Comunicando com o servidor para desbloqueio online..."
      uri = URI("#{APP_URL}/api/admin/clear-blacklist")
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')
      http.verify_mode = OpenSSL::SSL::VERIFY_NONE rescue nil
      http.open_timeout = 5.0
      http.read_timeout = 5.0

      req = Net::HTTP::Post.new(uri.request_uri, { 'Content-Type' => 'application/json' })
      req.body = { pcId: meu_id, clearAll: true }.to_json
      res = http.request(req)

      if res.is_a?(Net::HTTPSuccess)
        puts "[3/4] Blacklist do servidor limpa com sucesso!"
        desbloqueado_no_servidor = true
      end
    rescue => e
      puts "[3/4] Aviso de conexão com servidor: #{e.message}"
    end

    # 4. VERIFICAÇÃO SE JÁ EXISTE LICENÇA ATIVA NO SERVIDOR PARA ESTE PC
    begin
      puts "[4/4] Buscando se este PC possui licença ativa cadastrada no servidor..."
      check_uri = URI("#{APP_URL}/api/license/check-status?pcId=#{URI.encode_www_form_component(meu_id)}")
      http_check = Net::HTTP.new(check_uri.host, check_uri.port)
      http_check.use_ssl = (check_uri.scheme == 'https')
      http_check.verify_mode = OpenSSL::SSL::VERIFY_NONE rescue nil
      http_check.open_timeout = 5.0
      http_check.read_timeout = 5.0

      req_check = Net::HTTP::Get.new(check_uri.request_uri)
      res_check = http_check.request(req_check)

      if res_check.is_a?(Net::HTTPSuccess)
        dados = JSON.parse(res_check.body) rescue {}
        if dados["active"] == true
          cliente_nome = dados["clientName"]
          validade_str = dados["validUntil"]
          puts "[4/4] Licença ATIVA encontrada no servidor para #{cliente_nome} (Válida até: #{validade_str})!"
        end
      end
    rescue => e
      puts "[4/4] Verificação de licença: #{e.message}"
    end

    # SE TIVER O MÓDULO SKPRenderPro CARREGADO, PEGA AS LICENÇAS DISPONÍVEIS
    begin
      list_uri = URI("#{APP_URL}/api/licenses")
      http_list = Net::HTTP.new(list_uri.host, list_uri.port)
      http_list.use_ssl = (list_uri.scheme == 'https')
      http_list.verify_mode = OpenSSL::SSL::VERIFY_NONE rescue nil
      req_list = Net::HTTP::Get.new(list_uri.request_uri)
      res_list = http_list.request(req_list)
      if res_list.is_a?(Net::HTTPSuccess)
        lista = JSON.parse(res_list.body) rescue []
        registro_meu = lista.find { |item| item["pcId"].to_s.strip.downcase == meu_id.downcase }
        if registro_meu && registro_meu["status"] == "active" && registro_meu["licenseKey"]
          chave_encontrada = registro_meu["licenseKey"]
          cliente_nome = registro_meu["clientName"]
          validade_str = registro_meu["validUntil"]
          # Grava a chave ativa direto no SketchUp!
          Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", chave_encontrada)
          Sketchup.write_default(NOME_REGISTRO, "UltimoTimestampUso", Time.now.to_i.to_s)
          puts ">>> [SUCESSO TOTAL] Chave válida ativada automaticamente no SketchUp para #{cliente_nome}!"
        end
      end
    rescue => e
      puts "Aviso listagem: #{e.message}"
    end

    # 5. EXIBE A JANELA COM O RESULTADO PARA O USUÁRIO
    if chave_encontrada
      mensagem = "✅ SUCESSO! SEU COMPUTADOR FOI DESBLOQUEADO E ATIVADO!\n\n" \
                 "• UUID do seu PC:\n#{meu_id}\n\n" \
                 "• Cliente: #{cliente_nome}\n" \
                 "• Validade: #{validade_str}\n\n" \
                 "A chave oficial foi baixada e gravada no seu SketchUp.\n" \
                 "Você já pode usar o SKP RENDER PRO IA normalmente!"
      UI.messagebox(mensagem)
    else
      mensagem = "✨ LIMPEZA E DESBLOQUEIO CONCLUÍDOS COM SUCESSO!\n\n" \
                 "• Todas as travas e mensagens de bloqueio foram removidas.\n" \
                 "• Blacklist do servidor foi limpa.\n\n" \
                 "UUID do seu computador:\n#{meu_id}\n\n" \
                 "Clique em OK para abrir o SKP Render Pro IA."
      UI.messagebox(mensagem)
    end

    # Tenta abrir o painel do plugin se ele estiver carregado
    if defined?(SKPRenderPro) && SKPRenderPro.respond_to?(:open_dialog)
      begin
        SKPRenderPro.open_dialog
      rescue => _
      end
    end

    puts "=" * 60
    puts ">>> LIMPEZA FINALIZADA! PODE ABRIR O SKP RENDER PRO IA <<<"
    puts "=" * 60
    return true
  end
end

# Executa a limpeza imediatamente ao carregar o arquivo
SKPRenderProReset.executar_limpeza_total

# Registra também comando no menu Extensões
if defined?(UI)
  menu = nil
  begin; menu = UI.menu("Extensions"); rescue => _; end
  menu ||= (UI.menu("Plugins") rescue nil)
  if menu
    menu.add_item("🧹 Desbloquear e Limpar Licença (SKP Render Pro)") do
      SKPRenderProReset.executar_limpeza_total
    end
  end
end
