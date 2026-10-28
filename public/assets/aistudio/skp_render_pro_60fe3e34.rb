# ==============================================================================
# SKP RENDER PRO IA - Plugin para Trimble SketchUp (COM PROTEÇÃO DE LICENÇA)
# Versão: 2.0.0
# Compatibilidade: SketchUp 2017 até SketchUp 2026+ (Windows & macOS)
# ==============================================================================

require 'sketchup.rb'
require 'tmpdir'
require 'base64'
require 'tempfile'
require 'openssl'
require 'json'
require 'date'
require 'net/http'
require 'uri'
begin; require 'win32ole'; rescue LoadError; end

module SKPRenderPro
  CHAVE_SECRETA = "Minha_Senha_Secreta_Sketchup_2026!".freeze
  NOME_REGISTRO = "SKPRenderPro_Registro".freeze
  # URL Oficial do Servidor SKP Render Pro IA (Servidor ativo com todas as atualizações)
  URL_PADRAO = 'https://skp-render-pro-ia-2026.onrender.com'.freeze
  
  def self.app_url
    url_custom = (defined?(Sketchup) && Sketchup.respond_to?(:read_default)) ? Sketchup.read_default(NOME_REGISTRO, "ServidorURL") : nil
    if url_custom && !url_custom.to_s.strip.empty?
      return url_custom.to_s.strip.chomp('/')
    end
    URL_PADRAO
  end

  APP_URL = URL_PADRAO.freeze
  PLUGIN_NAME = 'SKP RENDER PRO IA'.freeze

  def self.obter_id_pc
    if RUBY_PLATFORM =~ /mswin|mingw/
      begin
        wmi = WIN32OLE.connect("winmgmts://")
        wmi.ExecQuery("select UUID from Win32_ComputerSystemProduct").each do |sys|
          return sys.UUID.to_s.strip
        end
      rescue
        return "ID_WIN_DESCONHECIDO"
      end
    else
      begin
        id = `ioreg -rd1 -c IOPlatformExpertDevice | grep -E '"IOPlatformSerialNumber"'`.split('"').last.strip
        return id
      rescue
        return "ID_MAC_DESCONHECIDO"
      end
    end
  end

  def self.consultar_servidor_licenca(meu_id, licenca_salva)
    return { "active" => true } if meu_id.nil? || meu_id.strip.empty?

    begin
      url_str = "#{app_url}/api/license/check-status?pcId=#{URI.encode_www_form_component(meu_id)}&licenseKey=#{URI.encode_www_form_component(licenca_salva || '')}&t=#{Time.now.to_i}"
      uri = URI(url_str)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')
      http.open_timeout = 1.5
      http.read_timeout = 1.5
      req = Net::HTTP::Get.new(uri.request_uri)
      req['User-Agent'] = 'SketchUp-SKP-Render-Pro'
      res = http.request(req)
      if res.is_a?(Net::HTTPSuccess)
        data = JSON.parse(res.body)
        return data
      end
    rescue => e
      # Em caso de falha de conexão ou offline momentâneo
    end

    { "active" => true, "offline" => true }
  end

  def self.licenca_valida?(licenca_b64)
    return false if licenca_b64.nil? || licenca_b64.strip.empty?
    begin
      decodificado = Base64.strict_decode64(licenca_b64)
      dados_json, assinatura_recebida = decodificado.split('|')
      assinatura_calculada = OpenSSL::HMAC.hexdigest('SHA256', CHAVE_SECRETA, dados_json)
      return false if assinatura_recebida != assinatura_calculada
      
      dados = JSON.parse(dados_json)
      return false if dados["id"] != obter_id_pc
      
      str_val = dados["validade"].to_s.strip
      
      # Trava Real 1: Verificação de Data e Hora Exatas
      if str_val.include?('T') || str_val.include?(':')
        begin
          tempo_validade = Time.parse(str_val)
          return false if Time.now > tempo_validade
        rescue
          data_validade = Date.parse(str_val)
          return false if Date.today > data_validade
        end
      else
        data_validade = Date.parse(str_val)
        return false if Date.today > data_validade
      end
      
      # Trava Real 2 (Anti-fraude): Impede atrasar o relógio do Windows para burlar a validade
      agora_ts = Time.now.to_i
      ultimo_ts = Sketchup.read_default(NOME_REGISTRO, "UltimoTimestampUso")
      if ultimo_ts && !ultimo_ts.to_s.strip.empty?
        begin
          # Se o relógio do sistema foi retrocedido além de 5 minutos de tolerância
          return false if agora_ts < (ultimo_ts.to_i - 300)
        rescue
        end
      end
      
      # Registra o timestamp atual
      Sketchup.write_default(NOME_REGISTRO, "UltimoTimestampUso", agora_ts.to_s)
      true
    rescue
      false
    end
  end

  def self.validar_ou_solicitar_licenca
    licenca_salva = Sketchup.read_default(NOME_REGISTRO, "ChaveAtivacao")
    meu_id = obter_id_pc

    # Se já possui licença salva no SketchUp:
    if licenca_salva && !licenca_salva.strip.empty?
      # FAST-PATH INSTANTÂNEO: Se a licença já for válida localmente (HMAC-SHA256 + prazo),
      # libera imediatamente em 0.001s sem travar o SketchUp aguardando a rede!
      if licenca_valida?(licenca_salva)
        return true
      end

      # Caso localmente não seja mais válida (ex: prazo expirou), consulta online:
      status_online = consultar_servidor_licenca(meu_id, licenca_salva)
      if status_online["blocked"] == true || status_online["reason"] == "revoked" || status_online["reason"] == "not_found"
        Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", "")
        puts "[SKP Render Pro] Licença salva não autorizada no servidor. Registro limpo."
      elsif status_online["active"] == true
        if status_online["licenseKey"] && !status_online["licenseKey"].to_s.strip.empty?
          Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", status_online["licenseKey"].to_s.strip)
          Sketchup.write_default(NOME_REGISTRO, "UltimoTimestampUso", Time.now.to_i.to_s)
          puts "[SKP Render Pro] Licença renovada e ativada automaticamente pelo servidor!"
        end
        return true
      end
    end

    # Sincronização automática com o servidor se o PC já estiver cadastrado com licença ativa
    begin
      list_uri = URI("#{app_url}/api/licenses?t=#{Time.now.to_i}")
      http_list = Net::HTTP.new(list_uri.host, list_uri.port)
      http_list.use_ssl = (list_uri.scheme == "https")
      http_list.open_timeout = 1.5
      http_list.read_timeout = 1.5
      req_list = Net::HTTP::Get.new(list_uri.request_uri)
      res_list = http_list.request(req_list)
      if res_list.is_a?(Net::HTTPSuccess)
        dados_resp = JSON.parse(res_list.body) rescue {}
        lista = dados_resp.is_a?(Array) ? dados_resp : (dados_resp["licenses"] || [])
        registro_meu = lista.find { |item| item["pcId"].to_s.strip.downcase == meu_id.downcase }
        if registro_meu && registro_meu["status"] == "active" && registro_meu["licenseKey"]
          Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", registro_meu["licenseKey"])
          Sketchup.write_default(NOME_REGISTRO, "UltimoTimestampUso", Time.now.to_i.to_s)
          puts "[SKP Render Pro] Licença sincronizada e ativada com sucesso para #{registro_meu["clientName"]}!"
          return true
        end
      end
    rescue => e
      puts "[SKP Render Pro] Verificação silenciosa de licença: #{e.message}"
    end

    # Se a licença ainda não estiver gravada, permite que a interface HTMLDialog seja aberta
    # onde o usuário tem o painel completo, visualização do UUID, opções de desbloqueio e acesso admin!
    return true
  end

  def self.limpar_licenca_total
    meu_id = obter_id_pc
    Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", "")
    Sketchup.write_default(NOME_REGISTRO, "UltimoTimestampUso", "")
    Sketchup.write_default("com.skprenderpro.dialog", "ChaveAtivacao", "")

    # Limpa no servidor
    begin
      uri = URI("#{app_url}/api/admin/clear-blacklist")
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == "https")
      req = Net::HTTP::Post.new(uri.request_uri, { "Content-Type" => "application/json" })
      req.body = { pcId: meu_id, clearAll: true }.to_json
      http.request(req)
    rescue => _
    end

    # Sincroniza se houver licença ativa cadastrada
    chave_encontrada = nil
    begin
      list_uri = URI("#{app_url}/api/licenses")
      http_list = Net::HTTP.new(list_uri.host, list_uri.port)
      http_list.use_ssl = (list_uri.scheme == "https")
      req_list = Net::HTTP::Get.new(list_uri.request_uri)
      res_list = http_list.request(req_list)
      if res_list.is_a?(Net::HTTPSuccess)
        lista = JSON.parse(res_list.body) rescue []
        reg = lista.find { |item| item["pcId"].to_s.strip.downcase == meu_id.downcase }
        if reg && reg["status"] == "active" && reg["licenseKey"]
          chave_encontrada = reg["licenseKey"]
          Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", chave_encontrada)
        end
      end
    rescue => _
    end

    if chave_encontrada
      UI.messagebox("✅ SUCESSO! Computador desbloqueado e reativado automaticamente com sua licença ativa!")
    else
      UI.messagebox("✨ Registros locais limpos e computador desbloqueado com sucesso!\n\nUUID do seu PC:\n#{meu_id}")
    end

    open_dialog
  end

  def self.redefinir_licenca_dialog
    meu_id = obter_id_pc
    lic_salva = Sketchup.read_default(NOME_REGISTRO, "ChaveAtivacao") || ""

    status_str = (lic_salva.nil? || lic_salva.strip.empty?) ? "Nenhuma licença ativa." : "Licença salva atualmente ativa."

    msg = "GERENCIADOR DE LICENÇA - #{PLUGIN_NAME}\n\n" \
          "ID do seu computador (UUID):\n#{meu_id}\n\n" \
          "Status atual: #{status_str}\n\n" \
          "O que deseja fazer?\n" \
          "[Sim] Inserir uma NOVA Chave de Licença\n" \
          "[Não] LIMPAR / RESETAR Licença deste computador\n" \
          "[Cancelar] Voltar sem alterar"

    escolha = UI.messagebox(msg, MB_YESNOCANCEL)
    if escolha == 6 # Sim / IDYES
      prompts = ["Cole sua nova chave de licença:"]
      defaults = [""]
      input = UI.inputbox(prompts, defaults, "Renovar Licença - #{PLUGIN_NAME}")
      if input && !input[0].strip.empty?
        chave_digitada = input[0].strip
        status_online = consultar_servidor_licenca(meu_id, chave_digitada)
        if status_online["blocked"] == true || status_online["active"] == false
          motivo = status_online["message"] || "Esta licença não está autorizada no servidor."
          UI.messagebox("ERRO:\n\n#{motivo}")
        elsif licenca_valida?(chave_digitada)
          Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", chave_digitada)
          Sketchup.write_default(NOME_REGISTRO, "UltimoTimestampUso", Time.now.to_i.to_s)
          UI.messagebox("Sucesso! Sua nova licença foi gravada e ativada.")
        else
          UI.messagebox("Chave inválida para este computador ou com formato incorreto.")
        end
      end
    elsif escolha == 7 # Não / IDNO
      Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", "")
      UI.messagebox("Licença local REMOVIDA com sucesso!\n\nNa próxima vez que você abrir o plugin, será solicitada uma nova ativação.")
    end
  end

  def self.verificar_servidor_ativo(url_alvo, timeout_seg = 1.0)
    return false if url_alvo.nil? || url_alvo.to_s.strip.empty?
    begin
      uri = URI(url_alvo.to_s.strip)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')
      http.open_timeout = timeout_seg
      http.read_timeout = timeout_seg
      req = Net::HTTP::Get.new(uri.request_uri.empty? ? '/' : uri.request_uri)
      req['User-Agent'] = 'SketchUp-SKP-Render-Pro'
      res = http.request(req)
      return res.is_a?(Net::HTTPSuccess) || res.code.to_i == 304 || res.code.to_i == 200
    rescue
      false
    end
  end

  def self.configurar_servidor_dialog
    url_atual = app_url
    msg_box = "CONFIGURAÇÃO DE CONEXÃO DO SERVIDOR IA\n\n" \
              "URL Atual de Conexão:\n#{url_atual}\n\n" \
              "Opções:\n" \
              "• Para testes locais rápidos (0s de espera): http://localhost:3000\n" \
              "• Para servidor em nuvem (Produção 24/7): https://seu-dominio.com\n" \
              "• Para restaurar o padrão do Google AI Studio: deixe vazio e confirme."
    
    prompts = ["URL do Servidor IA (Vazio = Restaurar padrão):"]
    defaults = [url_atual]
    input = UI.inputbox(prompts, defaults, "Configurar Conexão - #{PLUGIN_NAME}")
    if input
      nova_url = input[0].to_s.strip
      if nova_url.empty?
        Sketchup.write_default(NOME_REGISTRO, "ServidorURL", "")
        UI.messagebox("✓ Conexão restaurada para a URL padrão oficial:\n#{URL_PADRAO}")
      else
        nova_url = nova_url.chomp('/')
        Sketchup.write_default(NOME_REGISTRO, "ServidorURL", nova_url)
        UI.messagebox("✓ Servidor configurado com sucesso para:\n#{nova_url}\n\nO plugin conectará diretamente nesta URL!")
      end
      recarregar_painel if @dialog && @dialog.visible?
    end
  end

  class << self
    attr_accessor :dialog, :gem_dialog, :wizard_dialog, :skp_ia1_dialog, :skp_ia2_dialog, :materials_dialog, :panorama_dialog, :last_panorama_data, :overlay_tool, :toolbar,
                  :current_ratio, :current_safe_frame, :current_rule_of_thirds, :overlay_instance,
                  :panorama_front_point, :panorama_obs_point

    def open_dialog
      return unless validar_ou_solicitar_licenca

      if @dialog && @dialog.visible?
        @dialog.bring_to_front
        return
      end

      dialog_options = {
        dialog_title: PLUGIN_NAME,
        preferences_key: 'com.skprenderpro.dialog',
        scrollable: true,
        resizable: true,
        width: 420,
        height: 720,
        min_width: 240,
        min_height: 280,
        style: UI::HtmlDialog::STYLE_DIALOG
      }

      meu_id = obter_id_pc
      url_atual = app_url

      # Se o usuário estiver rodando o servidor local na porta 3000, usa localhost
      if SKPRenderPro.verificar_servidor_ativo('http://localhost:3000', 0.2)
        url_atual = 'http://localhost:3000'
      end

      url_com_params = "#{url_atual}?skp_pcid=#{URI.encode_www_form_component(meu_id)}&inside_skp=1&skp=1&t=#{Time.now.to_i}"

      @dialog = UI::HtmlDialog.new(dialog_options)
      @dialog.set_url(url_com_params)
      setup_dialog_callbacks(@dialog)

      @dialog.set_on_closed do
        begin
          disable_viewport_overlay(Sketchup.active_model)
        rescue => err
          puts "[SKP Render Pro] Erro ao desativar moldura no fechamento: #{err.message}"
        end
      end

      begin
        toggle_viewport_overlay(0.8, 2000, 2500, true, false)
      rescue => e
        puts "Aviso ao ativar moldura inicial: #{e.message}"
      end

      @dialog.center
      @dialog.show
    end

    def recarregar_painel
      if @dialog && @dialog.visible?
        @dialog.close rescue nil
      end
      @dialog = nil
      open_dialog
    end

    def open_gem_dialog(url = 'https://gemini.google.com/gem/1G2t4Otxm7RqE88jeaVMh3862abPxfqdh?usp=sharing')
      return unless validar_ou_solicitar_licenca

      url = 'https://gemini.google.com/gem/1G2t4Otxm7RqE88jeaVMh3862abPxfqdh?usp=sharing' if url.nil? || url.empty?

      if @gem_dialog && @gem_dialog.visible?
        @gem_dialog.bring_to_front
        return
      end

      gem_options = {
        dialog_title: 'GEMINI IA - SKP RENDER PRO',
        preferences_key: 'com.skprenderpro.gemini_dialog',
        scrollable: true,
        resizable: true,
        width: 800,
        height: 850,
        min_width: 280,
        min_height: 320,
        style: UI::HtmlDialog::STYLE_DIALOG
      }

      @gem_dialog = UI::HtmlDialog.new(gem_options)
      @gem_dialog.set_url(url)
      setup_dialog_callbacks(@gem_dialog)
      @gem_dialog.show
    end

    def open_skp_ia1_dialog(url = 'https://skp-render-pro-7f071a69.base44.app/login')
      return unless validar_ou_solicitar_licenca

      # Força sempre a URL oficial atualizada do SKP IA 01 (evita qualquer URL legada vinda do frontend em nuvem)
      url = 'https://skp-render-pro-7f071a69.base44.app/login'

      if @skp_ia1_dialog && @skp_ia1_dialog.visible?
        @skp_ia1_dialog.set_url(url)
        @skp_ia1_dialog.bring_to_front
        return
      end

      ia1_options = {
        dialog_title: 'SKP IA 01 - SKP RENDER PRO',
        preferences_key: 'com.skprenderpro.skp_ia1_dialog',
        scrollable: true,
        resizable: true,
        width: 950,
        height: 850,
        min_width: 320,
        min_height: 400,
        style: UI::HtmlDialog::STYLE_DIALOG
      }

      @skp_ia1_dialog = UI::HtmlDialog.new(ia1_options)
      @wizard_dialog = @skp_ia1_dialog
      @skp_ia1_dialog.set_url(url)
      setup_dialog_callbacks(@skp_ia1_dialog)
      @skp_ia1_dialog.show
    end

    def open_sketch_print_wizard_dialog(url = 'https://skp-render-pro-7f071a69.base44.app/login')
      open_skp_ia1_dialog('https://skp-render-pro-7f071a69.base44.app/login')
    end

    def open_skp_ia2_dialog(url = 'https://read-txt-app-1.preview.emergentagent.com/?utm_source=share')
      return unless validar_ou_solicitar_licenca

      url = 'https://read-txt-app-1.preview.emergentagent.com/?utm_source=share' if url.nil? || url.empty?

      if @skp_ia2_dialog && @skp_ia2_dialog.visible?
        @skp_ia2_dialog.bring_to_front
        return
      end

      ia2_options = {
        dialog_title: 'SKP IA 02 - SKP RENDER PRO',
        preferences_key: 'com.skprenderpro.skp_ia2_dialog',
        scrollable: true,
        resizable: true,
        width: 950,
        height: 850,
        min_width: 320,
        min_height: 400,
        style: UI::HtmlDialog::STYLE_DIALOG
      }

      @skp_ia2_dialog = UI::HtmlDialog.new(ia2_options)
      @skp_ia2_dialog.set_url(url)
      setup_dialog_callbacks(@skp_ia2_dialog)
      @skp_ia2_dialog.show
    end

    def open_materials_dialog(url = nil)
      return unless validar_ou_solicitar_licenca

      url = "#{app_url}/?popout=materials&inside_skp=1&skp=1&t=#{Time.now.to_i}" if url.nil? || url.empty?

      if @materials_dialog && @materials_dialog.visible?
        @materials_dialog.bring_to_front
        return
      end

      mat_options = {
        dialog_title: 'MATERIAIS E OBJETOS DA CENA - SKP RENDER PRO IA',
        preferences_key: 'com.skprenderpro.materials_dialog',
        scrollable: true,
        resizable: true,
        width: 1060,
        height: 740,
        min_width: 580,
        min_height: 480,
        style: UI::HtmlDialog::STYLE_DIALOG
      }

      @materials_dialog = UI::HtmlDialog.new(mat_options)
      @materials_dialog.set_url(url)
      setup_dialog_callbacks(@materials_dialog)
      @materials_dialog.show
    end

    def open_panorama360_dialog(url_or_data = nil)
      return unless validar_ou_solicitar_licenca

      if url_or_data && url_or_data.to_s.start_with?("data:image")
        @last_panorama_data = url_or_data.to_s
      end

      if @panorama_dialog && @panorama_dialog.visible?
        @panorama_dialog.bring_to_front
        if @last_panorama_data
          js = "if (window.carregarPanorama360Externo) { window.carregarPanorama360Externo(#{@last_panorama_data.to_json}); }"
          @panorama_dialog.execute_script(js) rescue nil
        end
        return
      end

      pano_options = {
        dialog_title: 'PRÉVIA PANORAMA 360° VR - SKP RENDER PRO IA',
        preferences_key: 'com.skprenderpro.panorama360_dialog',
        scrollable: false,
        resizable: true,
        width: 1100,
        height: 750,
        min_width: 580,
        min_height: 420,
        style: UI::HtmlDialog::STYLE_DIALOG
      }

      meu_id = obter_id_pc
      url = "#{app_url}/?popout=panorama360&skp_pcid=#{URI.encode_www_form_component(meu_id)}&inside_skp=1&skp=1&t=#{Time.now.to_i}"

      @panorama_dialog = UI::HtmlDialog.new(pano_options)
      @panorama_dialog.set_url(url)
      setup_dialog_callbacks(@panorama_dialog)
      @panorama_dialog.center
      @panorama_dialog.show

      if @last_panorama_data
        UI.start_timer(1.2, false) do
          if @panorama_dialog && @panorama_dialog.visible? && @last_panorama_data
            js = "if (window.carregarPanorama360Externo) { window.carregarPanorama360Externo(#{@last_panorama_data.to_json}); }"
            @panorama_dialog.execute_script(js) rescue nil
          end
        end
      end
    end

    # ==============================================================================
    # GERADOR DE ESPELHO REALISTA (Código Original Funcional e Fiel)
    # ==============================================================================
    def gerar_espelho_real(silencioso = false, target_face = nil, target_tr = nil, config_json = nil)
      model = Sketchup.active_model
      return unless model

      selection = model.selection
      selected_obj = nil
      face = target_face
      tr = target_tr || Geom::Transformation.new

      if face && face.valid?
        selected_obj = face
      else
        selected_obj = selection.first
        unless selected_obj
          UI.messagebox("Selecione a face ou o grupo do espelho.") unless silencioso
          return false
        end

        # Localiza a face selecionada e sua transformação
        face = selection.grep(Sketchup::Face).first

        if !face && (selected_obj.is_a?(Sketchup::ComponentInstance) || selected_obj.is_a?(Sketchup::Group))
          tr = selected_obj.transformation
          face = selected_obj.definition.entities.grep(Sketchup::Face).first
        end
      end

      unless face
        UI.messagebox("Nenhuma face válida foi encontrada.") unless silencioso
        return false
      end

      view = model.active_view
      camera = view.camera

      # Posição e orientação da câmera original
      orig_eye = camera.eye
      orig_target = camera.target
      orig_up = camera.up
      orig_fov = camera.fov
      orig_aspect = camera.aspect_ratio

      # Ponto central e vetor normal em coordenadas globais
      plane_pt = face.bounds.center.transform(tr)
      normal = face.normal.transform(tr).normalize

      # Garante que a normal do espelho aponta para a câmera (para dentro da sala)
      cam_vec = orig_eye - plane_pt
      normal = normal.reverse if normal.dot(cam_vec) < 0

      # Helper para escalar vetores
      scale_vec = lambda do |v, factor|
        Geom::Vector3d.new(v.x * factor, v.y * factor, v.z * factor)
      end

      # 1. Reflexão óptica da posição da câmera
      dist_eye = (orig_eye - plane_pt).dot(normal)
      ref_eye = orig_eye - scale_vec.call(normal, 2 * dist_eye)

      # 2. Reflexão do vetor de visão
      view_dir = orig_target - orig_eye
      dist_dir = view_dir.dot(normal)
      ref_dir = view_dir - scale_vec.call(normal, 2 * dist_dir)
      ref_target = ref_eye + ref_dir

      # 3. Reflexão do vetor UP
      dist_up = orig_up.dot(normal)
      ref_up = orig_up - scale_vec.call(normal, 2 * dist_up)

      # Configuração segura do plano de corte
      rend_opts = model.rendering_options
      old_cuts = rend_opts['DisplaySectionCuts'] rescue nil
      old_planes = rend_opts['DisplaySectionPlanes'] rescue nil

      begin; rend_opts['DisplaySectionCuts'] = true; rescue; end
      begin; rend_opts['DisplaySectionPlanes'] = false; rescue; end

      entities = model.active_entities
      sec_plane = entities.add_section_plane([plane_pt, normal]) rescue nil
      sec_plane.activate if sec_plane && sec_plane.respond_to?(:activate) rescue nil

      # Oculta o objeto do espelho para não bloquear a captura
      selected_obj.visible = false rescue nil

      # Aplica a câmera refletida
      camera.set(ref_eye, ref_target, ref_up)
      camera.fov = orig_fov if orig_fov
      camera.aspect_ratio = orig_aspect if orig_aspect > 0
      view.refresh

      # Dimensões da tela
      vp_w = view.vpwidth
      vp_h = view.vpheight

      # Captura a imagem refletida
      temp_path = File.join(Dir.tmpdir, "mirror_real_#{Time.now.to_i}.png")
      view.write_image(temp_path, vp_w, vp_h, true)

      # Restaura a câmera original, remove o corte e reexibe o espelho
      camera.set(orig_eye, orig_target, orig_up)
      selected_obj.visible = true rescue nil

      sec_plane.erase! if sec_plane && sec_plane.valid? rescue nil
      begin; rend_opts['DisplaySectionCuts'] = old_cuts unless old_cuts.nil?; rescue; end
      begin; rend_opts['DisplaySectionPlanes'] = old_planes unless old_planes.nil?; rescue; end
      view.refresh

      # 1. Configurações de Preset
      surf_type = 'espelho'
      opacity = 100.0
      darkening = 0.0

      if config_json && !config_json.empty?
        begin
          cfg = JSON.parse(config_json.to_s)
          surf_type = (cfg["type"] || "espelho").to_s.downcase
          opacity = (cfg["opacity"] || 100).to_f
          darkening = (cfg["darkening"] || 0).to_f
        rescue => _
        end
      end

      # 2. Deslocamento de exatamente 1.0 mm para fora da face (em direção à sala/câmera)
      # Cria uma moldura/plano solto, sem agrupar nem alterar o bloco 3D original
      dist_1mm = (1.0.mm rescue (1.0 / 25.4))
      offset_vec = scale_vec.call(normal, dist_1mm)

      # Vértices da face em coordenadas globais já deslocadas 1mm para fora
      outer_loop = face.outer_loop
      local_verts = outer_loop ? outer_loop.vertices.map(&:position) : face.vertices.map(&:position)
      global_pts = local_verts.map { |v| v.transform(tr) }
      offset_pts = global_pts.map { |p| p + offset_vec }

      model.start_operation("Gerar Reflexo de Superfície", true)

      # 3. Cria um Grupo Overlay Solto e Independente na raiz do modelo
      overlay_grp = model.entities.add_group
      overlay_grp.name = "SKP_Reflexo_#{surf_type.capitalize}_#{Time.now.to_i}"
      overlay_grp.set_attribute("SKP_RENDER_PRO", "is_reflection_overlay", true)
      overlay_grp.set_attribute("SKP_RENDER_PRO", "surface_type", surf_type)

      overlay_face = overlay_grp.entities.add_face(offset_pts) rescue nil
      if (!overlay_face || !overlay_face.valid?)
        overlay_face = overlay_grp.entities.add_face(offset_pts.reverse) rescue nil
      end

      unless overlay_face && overlay_face.valid?
        overlay_grp.erase! rescue nil
        model.abort_operation
        UI.messagebox("Não foi possível gerar a geometria do reflexo.") unless silencioso
        return false
      end

      # Garante que a face gerada aponte para a câmera
      overlay_face.reverse! if overlay_face.normal.dot(normal) < 0

      # 4. Mapeamento UV recortado na geometria da face do overlay solto
      o_verts = overlay_face.vertices.map(&:position)
      step = [1, (o_verts.size / 4.0).floor].max
      sample_verts = [o_verts[0], o_verts[step % o_verts.size], o_verts[(step * 2) % o_verts.size], o_verts[(step * 3) % o_verts.size]].uniq

      uv_array = []
      sample_verts.each do |pt|
        # Como overlay_grp está no model.entities (espaço mundial) com transformação identidade,
        # pt em coordenadas locais é exatamente idêntico a coordenadas de tela
        screen_pt = view.screen_coords(pt)
        u = screen_pt.x.to_f / vp_w
        v = (vp_h - screen_pt.y).to_f / vp_h

        # Inversão horizontal óptica da reflexão
        u = 1.0 - u

        uv_array << pt
        uv_array << Geom::Point3d.new(u, v, 0)
      end

      # 5. Prepara o material de acordo com o preset selecionado
      mat_name = "SKP_Reflexo_#{surf_type.capitalize}_#{Time.now.to_i}"
      mat = model.materials.add(mat_name)
      mat.texture = temp_path

      case surf_type
      when 'espelho'
        # Espelho Cristalino: NÃO altera mat.color para preservar 100% das cores reais RGB
        mat.alpha = 1.0
      when 'bronze'
        # Reflecta Bronze / Âmbar
        mat.color = Sketchup::Color.new(195, 145, 95)
        mat.alpha = (opacity / 100.0).clamp(0.05, 0.98)
      when 'fume'
        # Vidro / Espelho Fumê Grafite
        mat.color = Sketchup::Color.new(65, 65, 65)
        mat.alpha = (opacity / 100.0).clamp(0.05, 0.98)
      when 'tv'
        # Tela de TV / Monitor
        mat.color = Sketchup::Color.new(30, 30, 30)
        mat.alpha = (opacity / 100.0).clamp(0.05, 0.85)
      when 'vidro'
        # Vidro transparente incolor
        mat.alpha = (opacity / 100.0).clamp(0.05, 0.70)
      when 'piso'
        # Porcelanato / Piso Polido
        mat.alpha = (opacity / 100.0).clamp(0.05, 0.80)
      else
        mat.alpha = (opacity / 100.0).clamp(0.05, 1.0)
      end

      # 6. Aplica o material EXCLUSIVAMENTE na face do grupo solto (NUNCA toca no bloco 3D)
      overlay_face.position_material(mat, uv_array, true)
      overlay_face.position_material(mat, uv_array, false)

      # Limpa qualquer seleção para não deixar molduras azuis
      model.selection.clear rescue nil

      model.commit_operation
      view.invalidate rescue nil
      view.refresh rescue nil

      msg_ok = "#{surf_type.capitalize} gerado com sucesso!"
      UI.messagebox(msg_ok) unless silencioso
      Sketchup.status_text = "SKP Render Pro IA: #{msg_ok}"
      true
    rescue => err
      puts "[SKP RENDER PRO] Erro ao gerar espelho real: #{err.message}"
      Sketchup.status_text = "SKP Render Pro IA: Erro ao gerar espelho: #{err.message}"
      UI.messagebox("Erro ao gerar reflexão do espelho: #{err.message}") unless silencioso
      false
    ensure
      selected_obj.visible = true if selected_obj rescue nil
      sec_plane.erase! if sec_plane && sec_plane.valid? rescue nil
    end

    # Apaga todos os grupos de reflexo gerados pelo plugin de forma 100% segura e abrangente
    def apagar_todos_reflexos(silencioso = false)
      model = Sketchup.active_model
      return false unless model

      model.start_operation("Apagar Todos os Reflexos", true)
      removidos = 0

      begin
        # 1. Fecha qualquer contexto de edição ativo para voltar com segurança à raiz
        while model.active_path && !model.active_path.empty?
          model.close_active rescue break
        end

        # 2. Coleta todos os grupos de reflexo do modelo (na raiz e aninhados em blocos)
        to_erase = []

        # Varre entidades da raiz
        model.entities.each do |e|
          next unless e && e.valid? && !e.deleted?
          if e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
            is_match = false
            is_match = true if e.get_attribute("SKP_RENDER_PRO", "is_reflection_overlay")
            is_match = true if e.name.to_s =~ /^(SKP_Reflexo_|SKP_Espelho_|Espelho_Real)/i
            begin
              is_match = true if e.definition && e.definition.name.to_s =~ /^(SKP_Reflexo_|SKP_Espelho_|Espelho_Real)/i
            rescue
            end
            to_erase << e if is_match
          end
        end

        # Varre todas as definições (para achar overlays dentro de componentes ou blocos 3D)
        model.definitions.each do |cdef|
          next if cdef.deleted? || !cdef.valid?
          cdef.entities.each do |e|
            next unless e && e.valid? && !e.deleted?
            if e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
              is_match = false
              is_match = true if e.get_attribute("SKP_RENDER_PRO", "is_reflection_overlay")
              is_match = true if e.name.to_s =~ /^(SKP_Reflexo_|SKP_Espelho_|Espelho_Real)/i
              begin
                is_match = true if e.definition && e.definition.name.to_s =~ /^(SKP_Reflexo_|SKP_Espelho_|Espelho_Real)/i
              rescue
              end
              to_erase << e if is_match
            end
          end
        end

        # 3. Executa a exclusão de cada elemento coletado
        to_erase.uniq.each do |item|
          next unless item && item.valid? && !item.deleted?
          begin
            item.locked = false if item.respond_to?(:locked=)
            item.erase!
            removidos += 1
          rescue => e_del
            puts "[SKP RENDER PRO] Falha ao apagar item de reflexo: #{e_del.message}"
          end
        end

        model.commit_operation
      rescue => err
        puts "[SKP RENDER PRO] Erro ao apagar reflexos: #{err.message}"
        model.abort_operation rescue nil
      end

      # Atualiza a visualização
      model.active_view.invalidate rescue nil
      model.active_view.refresh rescue nil

      msg = "✓ #{removidos} plano(s) de reflexo removido(s) com sucesso!"
      Sketchup.status_text = "SKP Render Pro IA: #{msg}"
      UI.messagebox(msg) unless silencioso
      true
    rescue => err
      puts "[SKP RENDER PRO] Erro geral ao apagar reflexos: #{err.message}"
      false
    end

    # Restaura cores reais de qualquer espelho ou reflexo já presente no modelo do SketchUp
    def corrigir_cores_reflexos_existentes(silencioso = true)
      model = Sketchup.active_model
      return 0 unless model

      corrigidos = 0
      # Verifica apenas integridade sem alterar colorização de texturas
      model.materials.each do |mat|
        next unless mat.valid? && mat.texture
        if mat.name =~ /^SKP_Reflexo_Espelho_/i
          # Para espelhos cristalinos, assegura opacidade 100%
          if mat.alpha < 0.99
            mat.alpha = 1.0
            corrigidos += 1
          end
        end
      end

      if corrigidos > 0
        model.active_view.invalidate rescue nil
        puts "[SKP RENDER PRO] #{corrigidos} espelho(s) verificado(s) com sucesso!"
      end
      corrigidos
    end

    # Ativa a ferramenta interativa de mouse no SketchUp
    def ativar_ferramenta_reflexo(config_json = "{}")
      model = Sketchup.active_model
      return unless model
      # Ferramenta interativa de seleção de faces para criar novo reflexo
      # NUNCA modifica reflexos já criados na cena
      tool = SurfaceReflectTool.new(config_json)
      model.select_tool(tool)
    end

    # ==============================================================================
    # 4. ILUMINAÇÃO FAKE PARA RENDER IA (SPOTS CONE E FITAS DE LED)
    # ==============================================================================
    def gerar_spot_fake_na_face(face, tr = nil, config = {})
      model = Sketchup.active_model
      return unless model && face && face.valid?

      tr ||= Geom::Transformation.new
      model.start_operation("Gerar Spot Fake", true)

      color_hex = (config["color"] || config[:color] || "#ffe7ae").to_s
      alcance_cm = (config["reach"] || config[:reach] || 120).to_f
      intensidade = (config["intensity"] || config[:intensity] || 80).to_f
      abertura_deg = (config["angle"] || config[:angle] || 45).to_f
      light_type = (config["light_type"] || config[:light_type] || "spot").to_s

      alcance_inch = (alcance_cm / 2.54)
      alcance_inch = 25.0 if alcance_inch < 5.0

      cam = model.active_view.camera
      normal = face.normal.transform(tr).normalize
      pts = face.vertices.map { |v| v.position.transform(tr) }
      
      # Centro geométrico da face original
      center = Geom::Point3d.new(
        pts.map(&:x).sum / pts.size,
        pts.map(&:y).sum / pts.size,
        pts.map(&:z).sum / pts.size
      )

      # Determina a direção do facho da luz para o interior do ambiente
      # Se for teto/face horizontal (normal no eixo Z), o facho SEMPRE desce para baixo [0, 0, -1]
      dir_facho = nil
      if normal.z.abs > 0.5
        dir_facho = Geom::Vector3d.new(0, 0, -1)
      else
        # Para paredes ou faces verticais, a luz deve sair na direção da câmera (sala)
        v_to_cam = (cam.eye - center)
        v_to_cam = -cam.direction if cam.perspective? == false || v_to_cam.length < 0.001
        if normal.dot(v_to_cam) < 0
          dir_facho = normal.reverse
        else
          dir_facho = normal.clone
        end
      end
      dir_facho = dir_facho.normalize

      # DESLOCAMENTO EXATO DE 2MM ABAIXO DA FACE
      dist_2mm = 2.0 / 25.4 # 2mm em polegadas
      offset_vec = dir_facho.clone
      offset_vec.length = dist_2mm

      # Move centro e vértices exatamente 2mm abaixo da face
      center = center.offset(offset_vec)
      pts = pts.map { |p| p.offset(offset_vec) }

      grp = model.active_entities.add_group
      grp.name = "SKP_LuzFake_#{light_type.capitalize}_#{Time.now.to_i}"
      grp.set_attribute("SKP_RENDER_PRO", "is_fake_light", true)
      grp.set_attribute("SKP_RENDER_PRO", "fake_light_type", light_type)
      grp.casts_shadows = false rescue nil
      grp.receives_shadows = false rescue nil
      
      # Metadados para a IA
      grp.set_attribute("SKP_RENDER_PRO_AI", "type", light_type)
      grp.set_attribute("SKP_RENDER_PRO_AI", "color", color_hex)
      grp.set_attribute("SKP_RENDER_PRO_AI", "intensity", intensidade)
      grp.set_attribute("SKP_RENDER_PRO_AI", "reach", alcance_cm)

      # Materiais de degradê ultra-suaves e etéreos (glow sutil, sem bloco de plástico)
      mats_grad = []
      [0.15, 0.07, 0.02].each_with_index do |mul, idx|
        m_name = "SKP_LuzFake_Grad_#{idx}_#{color_hex.gsub('#', '')}"
        m = model.materials[m_name]
        unless m && m.valid?
          m = model.materials.add(m_name)
          m.color = Sketchup::Color.new(color_hex)
        end
        m.alpha = [[(intensidade / 100.0) * mul, 0.01].max, 0.18].min rescue 0.08
        mats_grad << m
      end

      mat_core_name = "SKP_LuzFake_Core_#{color_hex.gsub('#', '')}"
      mat_core = model.materials[mat_core_name]
      unless mat_core && mat_core.valid?
        mat_core = model.materials.add(mat_core_name)
        mat_core.color = Sketchup::Color.new(color_hex)
        mat_core.alpha = 1.0
      end

      ents = grp.entities
      half_angle_rad = (abertura_deg / 2.0) * (Math::PI / 180.0)
      tan_angle = Math.tan(half_angle_rad)

      if light_type == "plafon"
        # Modo Plafon: Segue a geometria da face (quadrado/retângulo) com degradê vertical (sem tampa de fundo)
        core_face = ents.add_face(pts) rescue nil
        if core_face
          core_face.material = mat_core
          core_face.back_material = mat_core
          core_face.edges.each { |e| e.hidden = true; e.soft = true; e.smooth = true; e.casts_shadows = false rescue nil }
        end

        levels = 3
        prev_pts = pts
        (1..levels).each do |lvl|
          h_step = (alcance_inch / levels.to_f)
          current_h = h_step * lvl
          lvl_center = center.offset(dir_facho, current_h)
          lvl_pts = []
          
          pts.each do |p|
            vec_from_center = p - center
            dist_from_center = vec_from_center.length
            new_dist = dist_from_center + current_h * tan_angle
            dir_vec = vec_from_center.length > 0.001 ? vec_from_center.normalize : Geom::Vector3d.new(1, 0, 0)
            lvl_pts << lvl_center.offset(dir_vec, new_dist)
          end

          # Cria as faces laterais para este nível
          (0...pts.size).each do |i|
            next_i = (i + 1) % pts.size
            side_face = ents.add_face(prev_pts[i], lvl_pts[i], lvl_pts[next_i], prev_pts[next_i]) rescue nil
            if side_face
              side_face.material = mats_grad[lvl-1]
              side_face.back_material = mats_grad[lvl-1]
              side_face.edges.each { |e| e.hidden = true; e.soft = true; e.smooth = true; e.casts_shadows = false rescue nil }
            end
          end
          # Sem tampa na base: facho dissipa suavemente no ar
          prev_pts = lvl_pts
        end
      else
        # Modo Spot: Tradicional redondo com facho cônico aberto suave (sem tampa na base)
        z_axis = dir_facho.normalize
        x_axis = z_axis.parallel?(Geom::Vector3d.new(0, 0, 1)) ? Geom::Vector3d.new(1, 0, 0) : z_axis.cross(Geom::Vector3d.new(0, 0, 1)).normalize
        y_axis = z_axis.cross(x_axis).normalize

        r_top = (3.5 / 2.54) # ~3.5cm raio da lâmpada
        segments = 16
        
        # 1. Disco emissivo
        top_pts = []
        (0...segments).each do |i|
          ang = (2.0 * Math::PI * i) / segments
          top_pts << center.offset(x_axis, Math.cos(ang) * r_top).offset(y_axis, Math.sin(ang) * r_top)
        end
        core_face = ents.add_face(top_pts) rescue nil
        if core_face
          core_face.material = mat_core
          core_face.back_material = mat_core
          core_face.edges.each { |e| e.hidden = true; e.soft = true; e.smooth = true; e.casts_shadows = false rescue nil }
        end

        levels = 3
        prev_pts = top_pts
        (1..levels).each do |lvl|
          h_step = (alcance_inch / levels.to_f)
          current_h = h_step * lvl
          lvl_center = center.offset(z_axis, current_h)
          r_lvl = r_top + current_h * tan_angle
          r_lvl = 6.0 if r_lvl < 3.0
          
          lvl_pts = []
          (0...segments).each do |i|
            ang = (2.0 * Math::PI * i) / segments
            lvl_pts << lvl_center.offset(x_axis, Math.cos(ang) * r_lvl).offset(y_axis, Math.sin(ang) * r_lvl)
          end

          # Facho cônico lateral (suavemente translúcido)
          (0...segments).each do |i|
            next_i = (i + 1) % segments
            side_face = ents.add_face(prev_pts[i], lvl_pts[i], lvl_pts[next_i], prev_pts[next_i]) rescue nil
            if side_face
              side_face.material = mats_grad[lvl-1]
              side_face.back_material = mats_grad[lvl-1]
              side_face.edges.each { |e| e.hidden = true; e.soft = true; e.smooth = true; e.casts_shadows = false rescue nil }
            end
          end
          # Sem tampa na base: facho dissipa naturalmente no ambiente
          prev_pts = lvl_pts
        end
      end

      model.commit_operation
      model.active_view.invalidate
      Sketchup.status_text = "SKP Render Pro IA: #{light_type.capitalize} de luz fake gerado com sucesso (2mm abaixo da face)!"
    rescue => err
      puts "[SKP RENDER PRO] Erro ao gerar spot/plafon: #{err.message}"
    end

    def gerar_fita_led_marcenaria(edges, config = {})
      model = Sketchup.active_model
      return unless model && edges && !edges.empty?

      model.start_operation("Gerar Fita de LED Marcenaria", true)

      color_hex = (config["color"] || config[:color] || "#ffe7ae").to_s
      reach_cm = (config["reach"] || config[:reach] || 25).to_f
      intensidade = (config["intensity"] || config[:intensity] || 80).to_f
      direcao = (config["direction"] || config[:direction] || "baixo").to_s.downcase

      reach_inch = (reach_cm / 2.54)
      reach_inch = 4.0 if reach_inch < 1.0

      vetores_proj = []
      case direcao
      when "cima"
        vetores_proj << Geom::Vector3d.new(0, 0, reach_inch)
      when "duplo"
        vetores_proj << Geom::Vector3d.new(0, 0, -reach_inch)
        vetores_proj << Geom::Vector3d.new(0, 0, reach_inch)
      when "esquerda", "direita"
        # Calculado dinamicamente relativo à perspectiva do usuário
      else # "baixo"
        vetores_proj << Geom::Vector3d.new(0, 0, -reach_inch)
      end

      grp = model.active_entities.add_group
      grp.name = "SKP_LuzFake_Fita_#{Time.now.to_i}"
      grp.set_attribute("SKP_RENDER_PRO", "is_fake_light", true)
      grp.set_attribute("SKP_RENDER_PRO", "fake_light_type", "fita_led")
      grp.casts_shadows = false rescue nil
      grp.receives_shadows = false rescue nil
      
      # Metadados para a IA
      grp.set_attribute("SKP_RENDER_PRO_AI", "type", "fita_led")
      grp.set_attribute("SKP_RENDER_PRO_AI", "color", color_hex)
      grp.set_attribute("SKP_RENDER_PRO_AI", "intensity", intensidade)
      grp.set_attribute("SKP_RENDER_PRO_AI", "reach", reach_cm)

      # Materiais de degradê ultra-suaves para fita (3 níveis sutis)
      mats_grad = []
      [0.12, 0.05, 0.015].each_with_index do |mul, idx|
        m_name = "SKP_LuzFake_FitaGrad_#{idx}_#{color_hex.gsub('#', '')}"
        m = model.materials[m_name]
        unless m && m.valid?
          m = model.materials.add(m_name)
          m.color = Sketchup::Color.new(color_hex)
        end
        m.alpha = [[(intensidade / 100.0) * mul, 0.01].max, 0.15].min rescue 0.05
        mats_grad << m
      end

      mat_core_name = "SKP_LuzFake_Core_#{color_hex.gsub('#', '')}"
      mat_core = model.materials[mat_core_name]
      unless mat_core && mat_core.valid?
        mat_core = model.materials.add(mat_core_name)
        mat_core.color = Sketchup::Color.new(color_hex)
        mat_core.alpha = 1.0
      end

      ents = grp.entities
      cam = model.active_view.camera

      edges.each do |edge_info|
        p1 = edge_info.is_a?(Array) ? edge_info[0] : (edge_info.start.position rescue nil)
        p2 = edge_info.is_a?(Array) ? edge_info[1] : (edge_info.end.position rescue nil)
        next unless p1 && p2 && p1.distance(p2) > 0.01

        v_edge = (p2 - p1).normalize
        # Vetor perpendicular horizontal ao segmento
        v_perp = v_edge.parallel?(Geom::Vector3d.new(0, 0, 1)) ? Geom::Vector3d.new(1, 0, 0) : v_edge.cross(Geom::Vector3d.new(0, 0, 1)).normalize

        # GARANTE que v_perp aponte SEMPRE PARA A FRENTE (para o observador / câmera / ambiente), nunca para dentro da madeira
        center_edge = Geom::Point3d.new((p1.x + p2.x) / 2.0, (p1.y + p2.y) / 2.0, (p1.z + p2.z) / 2.0)
        v_to_cam = (cam.eye - center_edge)
        v_to_cam = -cam.direction if cam.perspective? == false || v_to_cam.length < 0.001
        if v_perp.dot(v_to_cam) < 0
          v_perp = v_perp.reverse
        end

        # Deslocamento exato solicitado: 2mm À FRENTE da linha e 2mm ABAIXO da linha
        dist_2mm = 2.0 / 25.4 # 2mm em polegadas
        offset_frente = v_perp.clone
        offset_frente.length = dist_2mm
        offset_baixo = Geom::Vector3d.new(0, 0, -dist_2mm)

        # Largura da fita de LED (ex: 6mm)
        strip_w = 6.0 / 25.4

        # A fita é gerada a partir de 2mm à frente da linha, projetando mais strip_w para frente
        # Dessa forma, ela NUNCA fica no meio da linha e nem encosta na madeira
        strip_p1_back  = p1.offset(offset_frente).offset(offset_baixo)
        strip_p2_back  = p2.offset(offset_frente).offset(offset_baixo)
        strip_p1_front = strip_p1_back.offset(v_perp, strip_w)
        strip_p2_front = strip_p2_back.offset(v_perp, strip_w)

        # Centro da nova fita para projetar o brilho/facho de luz
        glow_p1 = Geom::Point3d.new(
          (strip_p1_back.x + strip_p1_front.x) / 2.0,
          (strip_p1_back.y + strip_p1_front.y) / 2.0,
          (strip_p1_back.z + strip_p1_front.z) / 2.0
        )
        glow_p2 = Geom::Point3d.new(
          (strip_p2_back.x + strip_p2_front.x) / 2.0,
          (strip_p2_back.y + strip_p2_front.y) / 2.0,
          (strip_p2_back.z + strip_p2_front.z) / 2.0
        )

        # Ajuste de vetores para direções esquerda/direita relativas à visão do usuário
        current_vetores = vetores_proj.dup
        if direcao == "esquerda"
          # Esquerda em relação à frente da fita
          v_left = v_perp.cross(Geom::Vector3d.new(0, 0, 1)).normalize.reverse
          v_left.length = reach_inch
          current_vetores << v_left
        elsif direcao == "direita"
          # Direita em relação à frente da fita
          v_right = v_perp.cross(Geom::Vector3d.new(0, 0, 1)).normalize
          v_right.length = reach_inch
          current_vetores << v_right
        end

        # 1. Face do núcleo emissivo da fita (posicionado 2mm à frente e 2mm abaixo)
        core_face = ents.add_face(
          strip_p1_back,
          strip_p2_back,
          strip_p2_front,
          strip_p1_front
        ) rescue nil
        if core_face
          core_face.material = mat_core
          core_face.back_material = mat_core
          core_face.edges.each { |e| e.hidden = true; e.soft = true; e.smooth = true }
        end

        # 2. Facho de luz volumétrico com degradê em 3 níveis
        current_vetores.each do |v_proj|
          levels = 3
          prev_glow_p1 = glow_p1
          prev_glow_p2 = glow_p2
          
          (1..levels).each do |lvl|
            v_step = v_proj.clone
            v_step.length = (v_proj.length / levels.to_f) * lvl
            
            p1_lvl = glow_p1.offset(v_step)
            p2_lvl = glow_p2.offset(v_step)
            
            glow_face = ents.add_face(prev_glow_p1, prev_glow_p2, p2_lvl, p1_lvl) rescue nil
            if glow_face
              glow_face.material = mats_grad[lvl-1]
              glow_face.back_material = mats_grad[lvl-1]
              glow_face.edges.each { |e| e.hidden = true; e.soft = true; e.smooth = true }
            end
            prev_glow_p1 = p1_lvl
            prev_glow_p2 = p2_lvl
          end
        end
      end

      model.commit_operation
      model.active_view.invalidate
      Sketchup.status_text = "SKP Render Pro IA: Fita de LED marcenaria gerada 2mm à frente e 2mm abaixo da linha!"
    rescue => err
      puts "[SKP RENDER PRO] Erro ao gerar fita marcenaria: #{err.message}"
    end

    def gerar_fita_led_espelho(face, tr = nil, config = {})
      model = Sketchup.active_model
      return unless model && face && face.valid?

      tr ||= Geom::Transformation.new
      model.start_operation("Gerar Fita de LED Espelho", true)

      color_hex = (config["color"] || config[:color] || "#ffe7ae").to_s
      reach_cm = (config["reach"] || config[:reach] || 15).to_f
      intensidade = (config["intensity"] || config[:intensity] || 80).to_f
      direcao = (config["direction"] || config[:direction] || "fora").to_s.downcase

      reach_inch = (reach_cm / 2.54)
      reach_inch = 3.0 if reach_inch < 1.0

      normal = face.normal.transform(tr).normalize
      outer_loop = face.outer_loop
      vertices = outer_loop.vertices.map { |v| v.position.transform(tr) }
      n_verts = vertices.size
      return if n_verts < 3

      grp = model.active_entities.add_group
      grp.name = "SKP_LuzFake_Espelho_#{Time.now.to_i}"
      grp.set_attribute("SKP_RENDER_PRO", "is_fake_light", true)
      grp.set_attribute("SKP_RENDER_PRO", "fake_light_type", "fita_led_espelho")
      
      # Metadados para a IA
      grp.set_attribute("SKP_RENDER_PRO_AI", "type", "fita_led_espelho")
      grp.set_attribute("SKP_RENDER_PRO_AI", "color", color_hex)
      grp.set_attribute("SKP_RENDER_PRO_AI", "intensity", intensidade)
      grp.set_attribute("SKP_RENDER_PRO_AI", "reach", reach_cm)

      grp.casts_shadows = false rescue nil
      grp.receives_shadows = false rescue nil

      # Materiais de degradê para halo do espelho (3 níveis sutis)
      mats_grad = []
      [0.16, 0.07, 0.02].each_with_index do |mul, idx|
        m_name = "SKP_LuzFake_HaloGrad_#{idx}_#{color_hex.gsub('#', '')}"
        m = model.materials[m_name]
        unless m && m.valid?
          m = model.materials.add(m_name)
          m.color = Sketchup::Color.new(color_hex)
        end
        m.alpha = [[(intensidade / 100.0) * mul, 0.01].max, 0.18].min rescue 0.07
        mats_grad << m
      end

      mat_core_name = "SKP_LuzFake_Core_#{color_hex.gsub('#', '')}"
      mat_core = model.materials[mat_core_name]
      unless mat_core && mat_core.valid?
        mat_core = model.materials.add(mat_core_name)
        mat_core.color = Sketchup::Color.new(color_hex)
        mat_core.alpha = 1.0
      end

      ents = grp.entities

      center = Geom::Point3d.new(
        vertices.map(&:x).sum / n_verts,
        vertices.map(&:y).sum / n_verts,
        vertices.map(&:z).sum / n_verts
      )

      back_offset = normal.reverse
      back_offset.length = 0.08 # ~2mm atrás

      out_pts = []
      in_pts  = []
      base_pts = vertices.map { |p| p.offset(back_offset) }

      vertices.each do |p|
        p_back = p.offset(back_offset)
        v_radial = (p_back - center).normalize
        out_pts << p_back.offset(v_radial, reach_inch)
        in_pts  << p_back.offset(v_radial.reverse, reach_inch * 0.5)
      end

      case direcao
      when "fora"
        levels = 3
        prev_pts = base_pts
        
        (1..levels).each do |lvl|
          lvl_reach = (reach_inch / levels.to_f) * lvl
          lvl_pts = []
          vertices.each do |p|
            p_back = p.offset(back_offset)
            v_radial = (p_back - center).normalize
            lvl_pts << p_back.offset(v_radial, lvl_reach)
          end
          
          # Anel de brilho do nível
          (0...n_verts).each do |i|
            next_i = (i + 1) % n_verts
            halo_face = ents.add_face(prev_pts[i], lvl_pts[i], lvl_pts[next_i], prev_pts[next_i]) rescue nil
            if halo_face
              halo_face.material = mats_grad[lvl-1]
              halo_face.back_material = mats_grad[lvl-1]
              halo_face.edges.each { |e| e.hidden = true; e.soft = true; e.smooth = true }
            end
          end
          prev_pts = lvl_pts
        end
      when "dentro"
        (0...n_verts).each do |i|
          next_i = (i + 1) % n_verts
          f = ents.add_face(base_pts[i], base_pts[next_i], in_pts[next_i], in_pts[i]) rescue nil
          if f
            f.material = mats_grad[0]
            f.back_material = mats_grad[0]
            f.edges.each { |e| e.hidden = true; e.soft = true; e.smooth = true }
          end
        end
      when "duplo"
        # Fora com degradê
        levels = 3
        prev_pts = base_pts
        (1..levels).each do |lvl|
          lvl_reach = (reach_inch / levels.to_f) * lvl
          lvl_pts = []
          vertices.each { |p| lvl_pts << p.offset(back_offset).offset((p.offset(back_offset) - center).normalize, lvl_reach) }
          (0...n_verts).each do |i|
            next_i = (i + 1) % n_verts
            f = ents.add_face(prev_pts[i], lvl_pts[i], lvl_pts[next_i], prev_pts[next_i]) rescue nil
            if f; f.material = mats_grad[lvl-1]; f.back_material = mats_grad[lvl-1]; f.edges.each{|e| e.hidden=true; e.soft=true; e.smooth=true}; end
          end
          prev_pts = lvl_pts
        end
        # Dentro simples
        (0...n_verts).each do |i|
          next_i = (i + 1) % n_verts
          f_in = ents.add_face(base_pts[i], base_pts[next_i], in_pts[next_i], in_pts[i]) rescue nil
          if f_in; f_in.material = mats_grad[0]; f_in.back_material = mats_grad[0]; f_in.edges.each{|e| e.hidden=true; e.soft=true; e.smooth=true}; end
        end
      end

      # Fita neon estreita de perímetro
      (0...n_verts).each do |i|
        next_i = (i + 1) % n_verts
        v_rad = (base_pts[i] - center).normalize
        p_narrow_1 = base_pts[i].offset(v_rad, 0.15)
        p_narrow_2 = base_pts[next_i].offset(v_rad, 0.15)
        f_neon = ents.add_face(base_pts[i], base_pts[next_i], p_narrow_2, p_narrow_1) rescue nil
        if f_neon
          f_neon.material = mat_core
          f_neon.back_material = mat_core
          f_neon.edges.each { |e| e.hidden = true; e.soft = true; e.smooth = true }
        end
      end

      model.commit_operation
      model.active_view.invalidate
      Sketchup.status_text = "SKP Render Pro IA: Fita de LED no espelho gerada com sucesso!"
    rescue => err
      puts "[SKP RENDER PRO] Erro ao gerar fita no espelho: #{err.message}"
    end

    def apagar_todas_luzes_fake(silencioso = false)
      model = Sketchup.active_model
      return false unless model

      model.start_operation("Apagar Todas as Luzes Fake", true)
      removidos = 0

      begin
        # 1. Fecha qualquer contexto de edição ativo para voltar com segurança à raiz
        while model.active_path && !model.active_path.empty?
          model.close_active rescue break
        end

        # 2. Coleta todos os grupos de luzes fake do modelo (na raiz e aninhados em blocos)
        to_erase = []

        # Varre entidades da raiz
        model.entities.each do |e|
          next unless e && e.valid? && !e.deleted?
          if e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
            is_match = false
            is_match = true if e.get_attribute("SKP_RENDER_PRO", "is_fake_light")
            is_match = true if e.name.to_s =~ /^SKP_LuzFake_/i
            begin
              is_match = true if e.definition && e.definition.name.to_s =~ /^SKP_LuzFake_/i
            rescue
            end
            to_erase << e if is_match
          end
        end

        # Varre todas as definições (para achar luzes dentro de componentes ou blocos 3D)
        model.definitions.each do |cdef|
          next if cdef.deleted? || !cdef.valid?
          cdef.entities.each do |e|
            next unless e && e.valid? && !e.deleted?
            if e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
              is_match = false
              is_match = true if e.get_attribute("SKP_RENDER_PRO", "is_fake_light")
              is_match = true if e.name.to_s =~ /^SKP_LuzFake_/i
              begin
                is_match = true if e.definition && e.definition.name.to_s =~ /^SKP_LuzFake_/i
              rescue
              end
              to_erase << e if is_match
            end
          end
        end

        # 3. Executa a exclusão de cada elemento de luz fake coletado
        to_erase.uniq.each do |item|
          next unless item && item.valid? && !item.deleted?
          begin
            item.locked = false if item.respond_to?(:locked=)
            item.erase!
            removidos += 1
          rescue => e_del
            puts "[SKP RENDER PRO] Falha ao apagar luz fake: #{e_del.message}"
          end
        end

        model.commit_operation
      rescue => err
        puts "[SKP RENDER PRO] Erro ao apagar luzes fake: #{err.message}"
        model.abort_operation rescue nil
      end

      # Atualiza a visualização
      model.active_view.invalidate rescue nil
      model.active_view.refresh rescue nil

      msg = "✓ #{removidos} luz(es) fake removida(s) com sucesso!"
      Sketchup.status_text = "SKP Render Pro IA: #{msg}"
      UI.messagebox(msg) unless silencioso
      true
    rescue => err
      puts "[SKP RENDER PRO] Erro geral ao apagar luzes fake: #{err.message}"
      false
    end

    def auto_suavizar_luzes_fakes_modelo(silencioso = true)
      model = Sketchup.active_model
      return 0 unless model

      model.start_operation("Suavizar Fachos de Luz", true)
      atualizadas = 0

      # 1. Procura todos os grupos de luz fake e suaviza geometrias e remove tampas
      model.entities.grep(Sketchup::Group).each do |grp|
        next unless grp && grp.valid?
        is_light = grp.get_attribute("SKP_RENDER_PRO", "is_fake_light") || grp.name.to_s.start_with?("SKP_LuzFake_")
        next unless is_light

        grp.casts_shadows = false rescue nil
        grp.receives_shadows = false rescue nil

        # Identifica faces da base fechada (tampa sólida no ar) e remove
        to_del = []
        grp.entities.grep(Sketchup::Face).each do |f|
          next unless f && f.valid?
          f.edges.each do |e|
            e.hidden = true rescue nil
            e.soft = true rescue nil
            e.smooth = true rescue nil
            e.casts_shadows = false rescue nil
          end
          if f.normal.z.abs > 0.65 && f.edges.all? { |e| e.faces.size <= 1 }
            to_del << f
          end
        end
        to_del.each { |f| f.erase! rescue nil }
        atualizadas += 1
      end

      # 2. Atualiza materiais de degradê existentes para alpha ultra-translúcido etéreo
      model.materials.each do |m|
        next unless m && m.valid?
        if m.name.start_with?("SKP_LuzFake_Grad_") || m.name.start_with?("SKP_LuzFake_FitaGrad_") || m.name.start_with?("SKP_LuzFake_HaloGrad_")
          if m.name.include?("Grad_0")
            m.alpha = 0.16 rescue nil
          elsif m.name.include?("Grad_1")
            m.alpha = 0.07 rescue nil
          else
            m.alpha = 0.02 rescue nil
          end
        end
      end

      model.commit_operation
      model.active_view.invalidate rescue nil
      atualizadas
    rescue => err
      puts "[SKP RENDER PRO] Falha ao auto-suavizar luzes: #{err.message}"
      0
    end

    def pintar_emissivo_selecao(cor_hex = "#ffe7ae")
      model = Sketchup.active_model
      return unless model

      model.start_operation("Pintar Luz Emissiva", true)

      mat_name = "SKP_Luz_Emissiva_#{cor_hex.gsub('#', '')}"
      mat = model.materials[mat_name]
      unless mat && mat.valid?
        mat = model.materials.add(mat_name)
        mat.color = Sketchup::Color.new(cor_hex)
        mat.alpha = 1.0
      end

      pintadas = 0
      model.selection.each do |entity|
        if entity.is_a?(Sketchup::Face)
          entity.material = mat
          entity.back_material = mat
          pintadas += 1
        elsif entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
          entity.definition.entities.grep(Sketchup::Face).each do |sub_face|
            sub_face.material = mat
            sub_face.back_material = mat
            pintadas += 1
          end
        end
      end

      model.commit_operation
      model.active_view.invalidate

      msg = "✓ #{pintadas} face(s) pintada(s) com material emissivo #{cor_hex}!"
      Sketchup.status_text = "SKP Render Pro IA: #{msg}"
      UI.messagebox(msg) if pintadas > 0
    rescue => err
      puts "[SKP RENDER PRO] Erro ao pintar emissivo: #{err.message}"
    end

    def ativar_ferramenta_luz_fake(config_json = "{}")
      model = Sketchup.active_model
      return unless model
      tool = FakeLightTool.new(config_json)
      model.select_tool(tool)
    end

    # ==============================================================================
    # APLICAÇÃO DO ESTILO IDEAL PARA RENDER IA (CONFIGURAÇÃO IDÊNTICA AO VÍDEO)
    # ==============================================================================
    # MÉTODO OFICIAL: APLICAR ESTILO IDEAL DE RENDER IA (CONFIGURAÇÃO OFICIAL)
    # Conforme as configurações solicitadas nas capturas:
    # - Arestas: Arestas=ON, Perfis=1, Cor=Todas iguais (Preto #000000), Tracejados=OFF, Ext=2, Prof=4, Extrem=7
    # - Faces: Sombreado com texturas (RenderMode 2), Transparência=Mais bonito, Oclusão ambiental=ON
    # - Fundo: "Cores de face padrão. Arestas de perfil. Cor de plano de fundo azul celeste e cinza."
    # - Sombras: Fuso UTC-03:00, Horário 11:45, Data 10/01 (1 de Outubro), Claro=89, Escuro=73, Sol=ON, Solo=ON, Faces=ON
    # - Apoio: Eixos=OFF, Guias=OFF, Geometria oculta=OFF, Objetos ocultos=OFF
    # ==============================================================================
    def aplicar_estilo_render_ia(silencioso = false)
      model = Sketchup.active_model
      unless model
        UI.messagebox("Nenhum modelo ativo no SketchUp.") unless silencioso
        return false
      end

      model.start_operation("Aplicar Estilo IA", true) rescue nil

      # 1. RENDERING OPTIONS (Arestas, Faces, Fundo, Modelagem)
      ro = model.rendering_options
      begin
        # --- Arestas (Aba Aresta da captura) ---
        ro["DisplayEdges"] = true         # [x] Arestas: MARCADO
        ro["DrawBackEdges"] = false       # [ ] Arestas posteriores: DESMARCADO
        ro["DrawProfiles"] = true         # [x] Perfis: MARCADO
        ro["ProfileWidth"] = 1            # Perfis: 1
        ro["DrawSilhouettes"] = true rescue nil
        ro["SilhouetteWidth"] = 1 rescue nil
        ro["DrawDepthQue"] = false        # [ ] Profundidade: DESMARCADO
        ro["DepthQueWidth"] = 4           # Valor 4
        ro["DrawExtension"] = false       # [ ] Extensão: DESMARCADO
        ro["ExtensionLength"] = 2         # Valor 2
        ro["DrawEndpoints"] = false       # [ ] Extremidades: DESMARCADO
        ro["EndpointLength"] = 7          # Valor 7
        ro["DrawDashes"] = false          # [ ] Tracejados: DESMARCADO
        ro["EdgeColorMode"] = 1 rescue nil # Cor: Todas iguais (1 = Todas iguais, 0 = Por material, 2 = Por eixo)
        ro["DefaultEdgeColor"] = Sketchup::Color.new(0, 0, 0) rescue nil # Cor preta
        ro["EdgeColor"] = Sketchup::Color.new(0, 0, 0) rescue nil        # Cor preta

        # --- Faces (Aba Face da captura) ---
        ro["FaceFrontColor"] = Sketchup::Color.new(255, 255, 255) rescue nil # Cor da frente: Branco
        ro["FaceBackColor"] = Sketchup::Color.new(165, 179, 189) rescue nil  # Cor do verso: Cinza
        ro["RenderMode"] = 2              # 4º ícone: Sombreado com texturas
        ro["Texture"] = true rescue nil   # Texturas ativadas
        ro["DrawXRay"] = false            # Raios X: DESMARCADO
        ro["Transparency"] = true rescue nil # [x] Transparência do material: MARCADO
        ro["MaterialTransparency"] = true rescue nil
        # Qualidade: Mais bonito (Nicer = 2 no SketchUp Ruby API, ou 1 conforme versão)
        ro["TransparencySort"] = 2 rescue nil
        if ro["TransparencySort"] != 2
          ro["TransparencySort"] = 1 rescue nil
        end
        ro["XRayOpacity"] = 65 rescue nil # Opacidade do raio-x: 65

        # [x] Oclusão ambiental: MARCADO (SketchUp 2024+)
        ro["AmbientOcclusion"] = true rescue nil
        ro["DrawAmbientOcclusion"] = true rescue nil
        ro["AmbientOcclusionDistance"] = 15.0 rescue nil # Distância suave (~15 polegadas / ~0.38m)
        ro["AmbientOcclusionIntensity"] = 0.20 rescue nil # Intensidade suave (~20%)

        # --- Fundo (Cor de plano de fundo azul celeste e cinza) ---
        ro["BackgroundColor"] = Sketchup::Color.new(206, 211, 217) rescue nil # Fundo cinza suave
        ro["DrawSky"] = true              # Céu: MARCADO
        ro["SkyColor"] = Sketchup::Color.new(198, 218, 238) rescue nil # Céu: azul celeste suave
        ro["DrawGround"] = false          # Solo: DESMARCADO
        ro["GroundColor"] = Sketchup::Color.new(206, 211, 217) rescue nil
        ro["DrawUnderground"] = false rescue nil

        # --- Marca d'água ---
        ro["DisplayWatermark"] = false rescue nil

        # --- Elementos de Apoio / Modelagem ---
        ro["ShowAxes"] = false            # Eixos: DESMARCADOS
        ro["DrawGuides"] = false          # Guias: DESMARCADAS
        ro["DrawHiddenGeometry"] = false  # Geometria oculta: DESMARCADA
        ro["DrawHiddenObjects"] = false rescue nil # Objetos ocultos: DESMARCADOS
        ro["DisplaySectionPlanes"] = false rescue nil # Planos de corte: DESMARCADOS
        ro["DisplaySectionCuts"] = true rescue nil   # Cortes de seção: MARCADOS
      rescue => err_ro
        puts "[SKP RENDER PRO] Aviso ao configurar rendering_options: #{err_ro.message}"
      end

      # 2. SOMBRAS (Bandeja Sombras da captura)
      si = model.shadow_info
      begin
        si["DisplayShadows"] = true       # [x] Sombras ativadas (ícone do sol no topo)
        si["TZOffset"] = -3.0 rescue nil  # Fuso: UTC-03:00

        # Horário: 11:45 | Data: 10/01 (1 de Outubro no SketchUp)
        ano = Time.now.year rescue 2026
        data_sombra = Time.local(ano, 10, 1, 11, 45, 0) rescue Time.now
        si["ShadowTime"] = data_sombra rescue nil

        si["Light"] = 89                  # Claro: 89
        si["Dark"] = 73                   # Escuro: 73
        si["UseSunForAllShading"] = true  # [x] Usar o sol para fazer sombras: MARCADO
        si["DisplayOnAllFaces"] = true    # [x] Em faces: MARCADO
        si["DisplayOnGround"] = true      # [x] No solo: MARCADO
        si["DisplayFromEdges"] = false    # [ ] Das arestas: DESMARCADO
      rescue => err_si
        puts "[SKP RENDER PRO] Aviso ao configurar shadow_info: #{err_si.message}"
      end

      # 3. ATUALIZAÇÃO E NOME DO ESTILO ("Estilo de projeto arquitetônico2")
      begin
        styles = model.styles
        if styles
          current_style = styles.selected_style
          if current_style
            current_style.name = "Estilo de projeto arquitetônico2" rescue nil
            current_style.description = "Cores de face padrão. Arestas de perfil. Cor de plano de fundo azul celeste e cinza." rescue nil
            styles.update_selected_style rescue nil
          end
        end
      rescue => err_st
        puts "[SKP RENDER PRO] Aviso ao atualizar estilo: #{err_st.message}"
      end

      # 4. ATUALIZA CENA ATIVA SE HOUVER (Estilo 16 e Sombras 32)
      begin
        if model.pages && model.pages.selected_page
          model.pages.selected_page.update(16 | 32) rescue nil
        end
      rescue => _
      end

      model.commit_operation rescue nil
      model.active_view.invalidate rescue nil

      msg = "✓ Estilo IA aplicado com sucesso!\n\n• Arestas: 1px, Perfis: 1, Tracejados: Desativados, Cor: Todas iguais (Preto)\n• Faces: Sombreado com texturas, Transparência: Mais bonito, Oclusão ambiental: Ativada\n• Fundo: Azul celeste e cinza (Céu ativo, Solo desativado)\n• Sombras: Fuso UTC-03:00, 11:45h, 10/01 (Claro: 89, Escuro: 73, Sol ativo)\n• Eixos, Guias e Geometria oculta desativados"
      Sketchup.status_text = "SKP Render Pro IA: Estilo IA aplicado com sucesso (Sombras 11:45, Claro 89 / Escuro 73)!"

      if @dialog && @dialog.visible?
        js = "if (window.dispatchEvent) { window.dispatchEvent(new CustomEvent('skp-style-applied', { detail: { name: 'Estilo de projeto arquitetônico2' } })); }"
        @dialog.execute_script(js) rescue nil
      end

      UI.messagebox(msg) unless silencioso
      true
    rescue => e
      puts "[SKP RENDER PRO] Erro ao aplicar estilo IA: #{e.message}"
      Sketchup.status_text = "SKP Render Pro IA: Erro ao aplicar estilo: #{e.message}"
      false
    end

    # Identifica dinamicamente a pasta oficial de Plugins do SketchUp ativa do usuário
    def obter_pasta_plugins
      # 1. Tenta a pasta onde o próprio arquivo do plugin skp_render_pro está rodando
      dir_atual = File.dirname(File.expand_path(__FILE__)) rescue nil
      if dir_atual && File.directory?(dir_atual) && (dir_atual.downcase.include?("plugin") || dir_atual.downcase.include?("sketchup"))
        return dir_atual
      end

      # 2. Pasta oficial de plugins registrada no SketchUp
      dir_oficial = Sketchup.find_support_file("Plugins") rescue nil
      return dir_oficial if dir_oficial && File.directory?(dir_oficial)

      # 3. Fallback para a pasta do arquivo atual se for diretório válido
      return dir_atual if dir_atual && File.directory?(dir_atual)

      # 4. Fallback padrão seguro
      Sketchup.temp_dir rescue Dir.pwd
    end

    # Salva o arquivo skp_render_pro.rb abrindo a janela DIRETAMENTE na pasta de Plugins do SketchUp do usuário
    def salvar_plugin_na_pasta_plugins(codigo_ruby = nil)
      plugins_dir = obter_pasta_plugins

      # Abre o diálogo nativo do Windows/Mac já posicionado dentro da pasta de Plugins do SketchUp:
      save_path = UI.savepanel("Salvar Plugin na Pasta de Plugins do SketchUp", plugins_dir, "skp_render_pro.rb")

      if save_path.nil? || save_path.to_s.strip.empty?
        Sketchup.status_text = "SKP Render Pro IA: Salvamento de plugin cancelado."
        return false
      end

      save_path = save_path.to_s.strip
      save_path += ".rb" unless save_path.downcase.end_with?(".rb")

      # Se o código não veio via parâmetro JS, baixa diretamente do servidor
      if codigo_ruby.nil? || codigo_ruby.to_s.strip.empty? || codigo_ruby.to_s.strip.start_with?("<")
        begin
          require 'net/http'
          require 'uri'
          require 'openssl'

          uri = URI.parse("#{app_url}/api/download/skp_render_pro.rb?t=#{Time.now.to_i}")
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = (uri.scheme == "https")
          http.verify_mode = OpenSSL::SSL::VERIFY_NONE rescue nil
          http.open_timeout = 8
          http.read_timeout = 15

          req = Net::HTTP::Get.new(uri.request_uri)
          req["User-Agent"] = "SketchUp-SKPRenderPro"
          res = http.request(req)

          if res.is_a?(Net::HTTPSuccess) && !res.body.include?("<!doctype")
            codigo_ruby = res.body
          else
            UI.messagebox("Aviso: Não foi possível baixar diretamente. Abrindo download no navegador...")
            UI.openURL("#{app_url}/api/download/skp_render_pro_protected.rb")
            return false
          end
        rescue => err_net
          puts "[SKP RENDER PRO] Erro no download Ruby: #{err_net.message}"
          UI.openURL("#{app_url}/api/download/skp_render_pro_protected.rb")
          return false
        end
      end

      # Validação estrita
      if codigo_ruby.to_s.strip.start_with?("<") || codigo_ruby.to_s.include?("<!doctype")
        UI.messagebox("Erro: O conteúdo retornado não é um arquivo Ruby válido.")
        return false
      end

      # Grava o plugin diretamente na pasta de plugins selecionada
      begin
        File.open(save_path, "w:UTF-8") do |f|
          f.write(codigo_ruby)
        end

        Sketchup.status_text = "SKP Render Pro IA: Plugin salvo com sucesso na pasta Plugins!"
        UI.messagebox("✓ Sucesso!\n\nO plugin skp_render_pro.rb foi salvo diretamente na pasta de Plugins do seu SketchUp:\n\n#{save_path}\n\nO arquivo já está no local correto! Basta reiniciar o SketchUp para que a versão mais recente entre em vigor.")

        if @dialog && @dialog.visible?
          js = "if (window.dispatchEvent) { window.dispatchEvent(new CustomEvent('skp-plugin-saved-direct', { detail: { path: #{save_path.dump} } })); }"
          @dialog.execute_script(js) rescue nil
        end
        true
      rescue => err_write
        puts "[SKP RENDER PRO] Erro ao gravar plugin: #{err_write.message}"
        UI.messagebox("Erro ao salvar arquivo na pasta de plugins:\n#{err_write.message}\n\nTente executar o SketchUp como Administrador.")
        false
      end
    end

    def setup_dialog_callbacks(dlg)
      return unless dlg

      # Callbacks de diagnóstico e reconexão do servidor:
      dlg.add_action_callback("tentar_reconectar") do |_context|
        recarregar_painel
      end

      dlg.add_action_callback("usar_servidor_local") do |_context|
        Sketchup.write_default(NOME_REGISTRO, "ServidorURL", "http://localhost:3000")
        UI.messagebox("✓ Conexão alterada para http://localhost:3000!\n\nCertifique-se de executar 'iniciar_servidor_local.bat' no seu computador.")
        recarregar_painel
      end

      dlg.add_action_callback("abrir_configurar_servidor") do |_context|
        SKPRenderPro.configurar_servidor_dialog
      end

      # Callback caso a interface web solicite os dados do PC e da licença:
      dlg.add_action_callback("pedir_info_licenca") do |_context|
        meu_id = obter_id_pc
        lic_salva = Sketchup.read_default(NOME_REGISTRO, "ChaveAtivacao") || ""
        script = "if (window.onSketchupLicenseInfo) { window.onSketchupLicenseInfo(#{meu_id.to_json}, #{lic_salva.to_json}); }"
        dlg.execute_script(script)
      end

      # Callback caso a interface web detecte licença ativada/renovada no servidor:
      dlg.add_action_callback("atualizar_chave_ativada") do |_context, nova_chave|
        if nova_chave && !nova_chave.to_s.strip.empty?
          Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", nova_chave.to_s.strip)
          Sketchup.write_default(NOME_REGISTRO, "UltimoTimestampUso", Time.now.to_i.to_s)
          puts "[SKP Render Pro] Chave de ativação atualizada e gravada com sucesso!"
        end
      end

      # Callback caso a interface web detecte licença revogada no servidor:
      dlg.add_action_callback("revogar_licenca_local") do |_context|
        Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", "")
        puts "[SKP Render Pro] Licença local resetada devido a alteração no servidor."
      end

      # Callback caso o usuário/admin queira limpar a licença local pela interface:
      dlg.add_action_callback("limpar_licenca_local") do |_context|
        Sketchup.write_default(NOME_REGISTRO, "ChaveAtivacao", "")
        UI.messagebox("Licença local do SketchUp limpa com sucesso!\n\nVocê já pode inserir uma nova chave ou redefinir no painel.")
      end

      dlg.add_action_callback("copiar_prompt") do |_context, prompt_text|
        copy_to_clipboard(prompt_text.to_s)
        Sketchup.status_text = "SKP Render Pro IA: Prompt copiado com sucesso!"
      end

      # Callback para aplicar o Estilo IA oficial (Sombras 11:45, 89/73, perfis 1, oclusão ambiental, etc.)
      dlg.add_action_callback("aplicar_estilo_render_ia") do |_context|
        aplicar_estilo_render_ia(false)
      end

      # Callback para copiar imagem nativamente para a área de transferência do Windows / Mac
      dlg.add_action_callback("copiar_imagem") do |_context, base64_image|
        begin
          if base64_image && base64_image.include?(",")
            raw_data = base64_image.split(",")[1]
            bytes = Base64.decode64(raw_data)
            
            require 'tempfile'
            temp_file = File.join(Dir.tmpdir, "skp_copy_#{Time.now.to_i}_#{rand(1000)}.png")
            File.binwrite(temp_file, bytes)

            if Sketchup.platform == :platform_win
              clean_path = temp_file.gsub('/', '\\')
              ps = "powershell -NoProfile -NonInteractive -Command \"Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('#{clean_path}'))\""
              Thread.new {
                system(ps)
                sleep 2
                File.delete(temp_file) if File.exist?(temp_file)
              }
            else
              cmd = "osascript -e 'set the clipboard to (read (POSIX file \"#{temp_file}\") as JPEG picture)'"
              system(cmd)
              File.delete(temp_file) if File.exist?(temp_file)
            end
            Sketchup.status_text = "SKP Render Pro IA: Imagem copiada para a área de transferência!"
          end
        rescue => err
          puts "Erro ao copiar imagem via SketchUp: #{err.message}"
        end
      end

      dlg.add_action_callback("abrir_gem") do |_context, url|
        open_gem_dialog(url.to_s)
      end

      # Callbacks para as IAs auxiliares integradas no SketchUp (Janelas 100% independentes):
      dlg.add_action_callback("abrir_skp_ia1") do |_context, url|
        open_skp_ia1_dialog(url.to_s)
      end

      dlg.add_action_callback("abrir_skp_ia2") do |_context, url|
        open_skp_ia2_dialog(url.to_s)
      end

      # Callback para abrir o Sketch Print Wizard (compatibilidade):
      dlg.add_action_callback("abrir_sketch_print_wizard") do |_context, url|
        open_skp_ia1_dialog(url.to_s)
      end

      # Callback para abrir a janela dedicada de Materiais e Objetos dentro do SketchUp:
      dlg.add_action_callback("abrir_dialogo_materiais") do |_context, url|
        open_materials_dialog(url.to_s)
      end

      # Callback para Gerador de Espelhos Realistas com reflexão física
      dlg.add_action_callback("gerar_espelho_real") do |_context, config_json|
        gerar_espelho_real(false, nil, nil, config_json)
      end

      # Callback para ativar a ferramenta interativa de mouse (acendimento em verde esmeralda)
      dlg.add_action_callback("ativar_ferramenta_reflexo") do |_context, config_json|
        ativar_ferramenta_reflexo(config_json.to_s)
      end

      # Callback para apagar todos os reflexos criados na cena
      dlg.add_action_callback("apagar_todos_reflexos") do |_context, *args|
        apagar_todos_reflexos(false)
      end

      # Callback para restaurar cores reais de reflexos já existentes
      dlg.add_action_callback("corrigir_cores_reflexos") do |_context, *args|
        corrigir_cores_reflexos_existentes(false)
      end

      # Callbacks para Iluminação Fake (Spot e Fita de LED)
      dlg.add_action_callback("ativar_ferramenta_luz_fake") do |_context, config_json|
        ativar_ferramenta_luz_fake(config_json.to_s)
      end

      dlg.add_action_callback("apagar_todas_luzes_fake") do |_context, *args|
        apagar_todas_luzes_fake(false)
      end

      dlg.add_action_callback("pintar_emissivo_selecao") do |_context, cor_hex|
        pintar_emissivo_selecao((cor_hex || "#ffe7ae").to_s)
      end

      # Callback para abrir qualquer URL externa no navegador padrão do usuário:
      dlg.add_action_callback("abrir_url_externa") do |_context, url|
        UI.openURL(url.to_s)
      end

      # Callback para salvar o arquivo .rb abrindo DIRETAMENTE na pasta de plugins do SketchUp do usuário:
      dlg.add_action_callback("salvar_plugin_direto") do |_context, code_content|
        salvar_plugin_na_pasta_plugins(code_content.to_s)
      end

      # Compatibilidade: se baixar_rb for chamado, também usa o salvamento direto na pasta Plugins
      dlg.add_action_callback("baixar_rb") do |_context, code_content|
        salvar_plugin_na_pasta_plugins(code_content.to_s)
      end

      dlg.add_action_callback("sync_overlay") do |_context, ratio, width, height, safe_frame, rule_of_thirds|
        toggle_viewport_overlay(ratio.to_f, width.to_f, height.to_f, safe_frame, rule_of_thirds)
      end

      # Callback para desativar e limpar completamente a moldura e tarjas no SketchUp
      dlg.add_action_callback("desativar_moldura") do |_context|
        disable_viewport_overlay(Sketchup.active_model)
      end

      dlg.add_action_callback("capturar_viewport") do |_context, target_width, target_height|
        begin
          export_and_send_snapshot(target_width.to_i, target_height.to_i)
        rescue => err
          puts "[SKP RENDER PRO] Erro ao capturar viewport: #{err.message}"
        end
      end

      dlg.add_action_callback("capturar_todas_cenas_lote") do |_context, target_width, target_height|
        begin
          export_all_pages_batch(target_width.to_i, target_height.to_i)
        rescue => err
          puts "[SKP RENDER PRO] Erro ao capturar lote de cenas: #{err.message}"
        end
      end

      # Callback nativo para salvar o print no computador via diálogo de arquivos do SketchUp
      dlg.add_action_callback("salvar_print") do |_context, base64_image, filename|
        begin
          if base64_image && base64_image.include?(",")
            raw_data = base64_image.split(",")[1]
            bytes = Base64.decode64(raw_data)
            default_name = filename.to_s.empty? ? "Print_SketchUp.jpg" : filename.to_s
            save_path = UI.savepanel("Salvar Print do SketchUp com Resolução Rigorosa", "", default_name)
            if save_path && !save_path.empty?
              save_path += ".jpg" unless save_path.downcase.end_with?(".jpg", ".jpeg", ".png")
              File.binwrite(save_path, bytes)
              Sketchup.status_text = "SKP Render Pro IA: Print salvo com sucesso em #{save_path}"
              UI.messagebox("✓ Print salvo com sucesso no computador!\n\nLocal: #{save_path}")
            end
          end
        rescue => err
          puts "Erro ao salvar print via SketchUp: #{err.message}"
        end
      end

      # Callbacks para Panorama 360° com IA
      dlg.add_action_callback("iniciar_selecao_360") do |_context, mode, eye_h|
        tool = Panorama360PickerTool.new(mode.to_s, (eye_h || 1.60).to_f)
        Sketchup.active_model.select_tool(tool)
      end

      dlg.add_action_callback("cancelar_selecao_360") do |_context|
        @panorama_front_point = nil
        @panorama_obs_point = nil
        Sketchup.active_model.select_tool(nil) rescue nil
        Sketchup.active_model.active_view.invalidate rescue nil
      end

      dlg.add_action_callback("capturar_cubemap_360") do |_context, eye_height_m, face_sz|
        sz = face_sz.to_i > 0 ? face_sz.to_i : 2048
        export_360_cubemap((eye_height_m || 1.60).to_f, sz)
      end

      dlg.add_action_callback("suavizar_luzes_fakes") do |_context|
        qtd = auto_suavizar_luzes_fakes_modelo(true)
        js = "if (window.showToast) { window.showToast('✓ #{qtd} luz(es) fake(s) suavizada(s) para degradê realista!'); }"
        dlg.execute_script(js) rescue nil
      end

      dlg.add_action_callback("limpar_luzes_fakes") do |_context|
        apagar_todas_luzes_fake(true)
        js = "if (window.showToast) { window.showToast('✓ Todas as luzes fakes foram removidas do modelo!'); }"
        dlg.execute_script(js) rescue nil
      end

      # Callbacks para Janela Separada de Prévia 360° no SketchUp
      dlg.add_action_callback("abrir_dialogo_360") do |_context, data_url|
        open_panorama360_dialog(data_url.to_s)
      end

      dlg.add_action_callback("solicitar_imagem_360_inicial") do |_context|
        if @last_panorama_data
          js = "if (window.carregarPanorama360Externo) { window.carregarPanorama360Externo(#{@last_panorama_data.to_json}); }"
          dlg.execute_script(js) rescue nil
        end
      end

      dlg.add_action_callback("aplicar_panorama_no_plugin") do |_context, data_url|
        if data_url && data_url.to_s.start_with?("data:image")
          @last_panorama_data = data_url.to_s
        end
        if @dialog && @dialog.visible?
          js = "window.dispatchEvent(new CustomEvent('skp-360-usar-panorama', { detail: { dataUrl: #{data_url.to_json} } }));"
          @dialog.execute_script(js) rescue nil
          @dialog.bring_to_front rescue nil
        end
      end

      # Callback para executar comandos de preparação de cena no SketchUp
      dlg.add_action_callback("executar_comando_cena") do |_context, command_name, _params_json|
        begin
          model = Sketchup.active_model
          return unless model

          params = {}
          if _params_json && !_params_json.to_s.empty?
            begin
              require 'json'
              params = JSON.parse(_params_json.to_s)
            rescue => _
              params = {}
            end
          end

          case command_name.to_s
          when "definir_distancia_focal"
            mm = (params["focal_length"] || params[:focal_length]).to_f
            if mm > 0
              camera = model.active_view.camera
              camera.perspective = true if camera.respond_to?(:perspective=)
              if camera.respond_to?(:focal_length=)
                camera.focal_length = mm
              else
                # Cálculo de campo de visão (FOV em graus) baseado em sensor 35mm full frame (36mm de largura)
                rad = 2.0 * Math.atan(18.0 / mm)
                deg = rad * (180.0 / Math::PI)
                camera.fov = deg
              end
              @saved_user_focal_length = mm
              model.active_view.invalidate
              Sketchup.status_text = "SKP Render Pro IA: Câmera ajustada para #{mm.round(1)}mm"
            end
          when "definir_formato"
            ratio_val = (params["ratio"] || params[:ratio]).to_f
            w_val = (params["width"] || params[:width]).to_f
            h_val = (params["height"] || params[:height]).to_f
            safe_frame_val = params.key?("safe_frame") ? params["safe_frame"] : true
            toggle_viewport_overlay(ratio_val, w_val, h_val, safe_frame_val, false) rescue nil
            Sketchup.status_text = "SKP Render Pro IA: Formato definido para #{params['label']} #{params['sublabel']} (#{w_val.to_i}x#{h_val.to_i}px)"
          when "ativar_sombras"
            begin
              model.shadow_info["DisplayShadows"] = true
              model.shadow_info["Light"] = 92 rescue nil
              model.shadow_info["Dark"] = 82 rescue nil
            rescue
            end
            model.active_view.invalidate rescue nil
            Sketchup.status_text = "SKP Render Pro IA: Sombras ativadas (Claro: 92, Escuro: 82)!"
          when "abrir_dialogo_materiais"
            open_materials_dialog(params["url"])
          when "abrir_skp_ia1"
            open_skp_ia1_dialog(params["url"] || params[:url] || 'https://skp-render-pro-7f071a69.base44.app/login')
          when "abrir_skp_ia2"
            open_skp_ia2_dialog(params["url"] || params[:url] || 'https://read-txt-app-1.preview.emergentagent.com/?utm_source=share')
          when "abrir_sketch_print_wizard"
            open_skp_ia1_dialog(params["url"] || params[:url] || 'https://skp-render-pro-7f071a69.base44.app/login')
          when "aplicar_estilo_render_ia"
            aplicar_estilo_render_ia(false)
          when "gerar_espelho_real"
            gerar_espelho_real(false, nil, nil, params.to_json)
          when "ativar_ferramenta_reflexo"
            ativar_ferramenta_reflexo(params.to_json)
          when "apagar_todos_reflexos"
            apagar_todos_reflexos(false)
          when "corrigir_cores_reflexos"
            corrigir_cores_reflexos_existentes(false)
          when "ativar_ferramenta_luz_fake"
            ativar_ferramenta_luz_fake(params.to_json)
          when "apagar_todas_luzes_fake", "limpar_luzes_fakes"
            apagar_todas_luzes_fake(false)
          when "suavizar_luzes_fakes"
            auto_suavizar_luzes_fakes_modelo(false)
          when "pintar_emissivo_selecao"
            pintar_emissivo_selecao(params["color"] || params[:color] || "#ffe7ae")
          when "capturar_todas_cenas_lote"
            w_lote = (params["width"] || params[:width] || 2000).to_i
            h_lote = (params["height"] || params[:height] || 2500).to_i
            export_all_pages_batch(w_lote, h_lote)
          end
        rescue => err
          puts "Erro ao executar comando de cena: #{err.message}"
        end
      end
    end

    def copy_to_clipboard(text)
      str = text.to_s.dup.force_encoding('UTF-8')

      if Sketchup.platform == :platform_win
        # A API interna legada UI.set_clipboard do SketchUp Windows grava como ANSI (Win-1252),
        # corrompendo caracteres acentuados (ã, é, ó, ç, etc.) em mojibake (Ã£, Ã©, etc.).
        # Para garantir 100% de fidelidade UTF-8, decodificamos Base64 diretamente no PowerShell:
        begin
          require 'base64'
          b64 = Base64.strict_encode64(str)
          ps_command = "powershell -NoProfile -NonInteractive -Command \"$bytes = [System.Convert]::FromBase64String('#{b64}'); $txt = [System.Text.Encoding]::UTF8.GetString($bytes); Set-Clipboard -Value $txt\""
          Thread.new { system(ps_command) }
          return
        rescue => e
          puts "[SKP RENDER PRO] Falha ao copiar via PowerShell UTF-8: #{e.message}"
        end
      end

      if UI.respond_to?(:set_clipboard)
        UI.set_clipboard(str)
      else
        IO.popen('pbcopy', 'w:UTF-8') { |f| f << str } rescue nil
      end
    rescue => e
      puts "Erro ao copiar para clipboard: #{e.message}"
    end

    # Gera um relatório descritivo de todas as luzes configuradas no modelo para a IA
    def gerar_relatorio_iluminacao_ia
      begin
        model = Sketchup.active_model
        return "" unless model
        
        luzes = []
        # Varre grupos da raiz com segurança
        model.entities.each do |e|
          next unless e.is_a?(Sketchup::Group) && e.valid? && e.get_attribute("SKP_RENDER_PRO_AI", "type")
          luzes << {
            type: e.get_attribute("SKP_RENDER_PRO_AI", "type"),
            color: e.get_attribute("SKP_RENDER_PRO_AI", "color"),
            intensity: e.get_attribute("SKP_RENDER_PRO_AI", "intensity"),
            reach: e.get_attribute("SKP_RENDER_PRO_AI", "reach")
          }
        end
        
        # Varre definições (luzes em componentes) com proteção
        model.definitions.each do |cdef|
          next if cdef.deleted? || !cdef.valid?
          cdef.entities.grep(Sketchup::Group).each do |grp|
            next unless grp.valid? && grp.get_attribute("SKP_RENDER_PRO_AI", "type")
            luzes << {
              type: grp.get_attribute("SKP_RENDER_PRO_AI", "type"),
              color: grp.get_attribute("SKP_RENDER_PRO_AI", "color"),
              intensity: grp.get_attribute("SKP_RENDER_PRO_AI", "intensity"),
              reach: grp.get_attribute("SKP_RENDER_PRO_AI", "reach")
            }
          end
        end

        return "" if luzes.empty?
        
        report = "\n💡 CONFIGURAÇÃO DE ILUMINAÇÃO TÉCNICA ATIVA NA CENA:\n"
        luzes.uniq.each do |l|
          desc = case l[:type]
                 when "spot" then "Spot de embutir focado"
                 when "plafon" then "Plafon de luz difusa"
                 when "fita_led" then "Fita de LED linear"
                 when "fita_led_espelho" then "Retroiluminação (Halo) de espelho"
                 else "Fonte de luz artificial"
                 end
          report += "- #{desc}: Cor #{l[:color]}, Intensidade #{l[:intensity]}%, Alcance #{l[:reach]}cm. (Interpretá-los como feixes fotométricos reais com degradê e penumbra).\n"
        end
        report
      rescue => err
        puts "[SKP RENDER PRO] Aviso ao ler relatório de luz: #{err.message}"
        ""
      end
    end

    def export_and_send_snapshot(w = 1600, h = 1200, lights_report = nil, *args)
      model = Sketchup.active_model
      return unless model
      view = model.active_view
      return unless view

      begin
        lights_report = gerar_relatorio_iluminacao_ia if lights_report.nil?
      rescue
        lights_report = ""
      end

      w = 1600 if w.to_i <= 0
      h = 1200 if h.to_i <= 0
      w = w.to_i
      h = h.to_i

      # Aumentado o limite de resolução para permitir prints de alta qualidade (4K/8K)
      # Mantemos um teto de 8000px apenas por segurança extrema do sistema
      max_dim = 8000
      if w > max_dim || h > max_dim
        if w > h
          h = (h.to_f * max_dim / w).round
          w = max_dim
        else
          w = (w.to_f * max_dim / h).round
          h = max_dim
        end
      end

      camera = view.camera
      target_ratio = w.to_f / h.to_f
      saved_focal = (camera && camera.respond_to?(:focal_length)) ? camera.focal_length : nil
      saved_fov = (camera && camera.respond_to?(:fov)) ? camera.fov : nil

      temp_path = File.join(Dir.tmpdir, "skp_render_snapshot_#{Time.now.to_i}.jpg")

      keys = {
        :filename => temp_path,
        :width => w,
        :height => h,
        :antialias => true,
        :compression => 0.92
      }

      view.write_image(keys)

      # Restaura rigorosamente a câmera para aspecto livre (0.0) e preserva a distância focal exata
      if camera
        if camera.respond_to?(:aspect_ratio=) && camera.aspect_ratio != 0.0
          camera.aspect_ratio = 0.0
        end
        if saved_focal && camera.respond_to?(:focal_length=) && saved_focal > 0
          camera.focal_length = saved_focal
        elsif saved_fov && camera.respond_to?(:fov=) && saved_fov > 0
          camera.fov = saved_fov
        end
      end

      if File.exist?(temp_path) && @dialog && @dialog.visible?
        file_bytes = File.binread(temp_path)
        base64_data = "data:image/jpeg;base64,#{Base64.strict_encode64(file_bytes)}"

        payload = {
          dataUrl: base64_data,
          width: w,
          height: h,
          ratio: target_ratio,
          lighting_report: lights_report.to_s
        }
        json_str = payload.to_json

        js_code = "window.dispatchEvent(new CustomEvent('skp-image-captured', { detail: #{json_str} }));"
        @dialog.execute_script(js_code)

        if @materials_dialog && @materials_dialog.visible?
          @materials_dialog.execute_script(js_code) rescue nil
        end

        File.delete(temp_path) rescue nil

        Sketchup.status_text = "SKP Render Pro IA: Print capturado da cena na moldura (#{w}x#{h}px)!"
      end
    rescue => e
      puts "Erro ao capturar viewport: #{e.message}"
    end

    def export_all_pages_batch(w = 2000, h = 2500)
      model = Sketchup.active_model
      return unless model
      view = model.active_view
      return unless view

      pages = model.pages
      if !pages || pages.size == 0
        export_and_send_snapshot(w, h)
        return
      end

      lights_report = ""
      begin
        lights_report = gerar_relatorio_iluminacao_ia
      rescue
        lights_report = ""
      end

      w = 2000 if w.to_i <= 0
      h = 2500 if h.to_i <= 0
      w = [w.to_i, 4096].min
      h = [h.to_i, 4096].min
      target_ratio = w.to_f / h.to_f

      saved_page = pages.selected_page
      page_opts = model.options["PageOptions"] rescue nil
      saved_show_trans = page_opts ? (page_opts["ShowTransition"] rescue nil) : nil
      if page_opts
        page_opts["ShowTransition"] = false rescue nil
      end

      pages.to_a.first(15).each_with_index do |pg, idx|
        begin
          pages.selected_page = pg
          view.refresh rescue nil

          temp_path = File.join(Dir.tmpdir, "skp_batch_page_#{idx}_#{Time.now.to_i}.jpg")
          view.write_image({
            :filename => temp_path,
            :width => w,
            :height => h,
            :antialias => true,
            :compression => 0.90
          })

          if File.exist?(temp_path) && @dialog && @dialog.visible?
            file_bytes = File.binread(temp_path)
            base64_data = "data:image/jpeg;base64,#{Base64.strict_encode64(file_bytes)}"
            payload = {
              dataUrl: base64_data,
              width: w,
              height: h,
              ratio: target_ratio,
              lighting_report: lights_report.to_s,
              page_name: pg.name.to_s,
              batch_mode: true
            }
            js_code = "window.dispatchEvent(new CustomEvent('skp-image-captured', { detail: #{payload.to_json} }));"
            @dialog.execute_script(js_code)
            File.delete(temp_path) rescue nil
          end
        rescue => e_pg
          puts "[SKP RENDER PRO] Erro ao capturar cena #{pg.name}: #{e_pg.message}"
        end
      end

      if saved_page
        pages.selected_page = saved_page rescue nil
      end
      if page_opts && !saved_show_trans.nil?
        page_opts["ShowTransition"] = saved_show_trans rescue nil
      end
      view.refresh rescue nil
      Sketchup.status_text = "SKP Render Pro IA: #{[pages.size, 15].min} cenas capturadas em lote com sucesso!"
    rescue => e
      puts "Erro em export_all_pages_batch: #{e.message}"
    end

    def export_360_cubemap(eye_height_m = 1.60, face_size = 2048)
      model = Sketchup.active_model
      return unless model
      view = model.active_view
      return unless view
      camera = view.camera
      return unless camera

      # 1. Suaviza automaticamente fachos pesados e remove tampas de luzes existentes na cena
      auto_suavizar_luzes_fakes_modelo rescue nil

      saved_eye = camera.eye
      saved_target = camera.target
      saved_up = camera.up
      saved_perspective = camera.perspective?
      saved_fov = (camera.respond_to?(:fov)) ? camera.fov : 35.0
      saved_aspect = camera.aspect_ratio

      # 2. Salva e padroniza iluminação global fixa no espaço 3D mundial
      # CRÍTICO: UseSunForAllShading = true impede que o farol (headlight) da lente do SketchUp
      # gire com a câmera a cada face gerando cortes claros/escuros no meio das paredes e teto
      saved_sun_shading = nil
      saved_dark = nil
      if model.shadow_info
        saved_sun_shading = model.shadow_info["UseSunForAllShading"] rescue nil
        saved_dark = model.shadow_info["Dark"] rescue nil
        model.shadow_info["UseSunForAllShading"] = true rescue nil
        if saved_dark && saved_dark < 55
          model.shadow_info["Dark"] = 65 rescue nil
        end
      end

      # 3. Desativa temporariamente qualquer overlay ativo para não desenhar molduras nas faces
      saved_overlays_state = {}
      if defined?(Sketchup::Overlay) && model.respond_to?(:overlays)
        begin
          model.overlays.each do |ov|
            if ov.respond_to?(:enabled)
              saved_overlays_state[ov] = ov.enabled?
              ov.enabled = false rescue nil
            end
          end
        rescue => _
        end
      end

      if @panorama_obs_point
        eye_height_inch = (eye_height_m.to_f > 0 ? eye_height_m.to_f : 1.60).m
        eye = Geom::Point3d.new(@panorama_obs_point.x, @panorama_obs_point.y, @panorama_obs_point.z + eye_height_inch)
        obs_origin = @panorama_obs_point
      else
        eye = saved_eye
        obs_origin = eye
      end

      if @panorama_front_point
        f_vec = @panorama_front_point - obs_origin
      else
        f_vec = saved_target - saved_eye
      end
      f_vec.z = 0
      f_vec = Geom::Vector3d.new(0, 1, 0) if f_vec.length <= 0.001
      f_vec.normalize!

      up_vec = Geom::Vector3d.new(0, 0, 1)
      right_vec = (f_vec * up_vec).normalize
      back_vec = f_vec.reverse
      left_vec = right_vec.reverse

      faces_config = {
        :front => { :target => eye + f_vec, :up => up_vec },
        :right => { :target => eye + right_vec, :up => up_vec },
        :back => { :target => eye + back_vec, :up => up_vec },
        :left => { :target => eye + left_vec, :up => up_vec },
        :top => { :target => eye + up_vec, :up => back_vec },
        :bottom => { :target => eye - up_vec, :up => f_vec }
      }

      encoded_faces = {}
      temp_files = []

      faces_config.each do |face_name, cfg|
        camera.perspective = true
        camera.aspect_ratio = 1.0
        camera.fov = 90.0
        camera.set(eye, cfg[:target], cfg[:up])
        view.refresh rescue nil

        t_file = File.join(Dir.tmpdir, "skp_360_#{face_name}_#{Time.now.to_f.to_s.gsub('.', '_')}.jpg")
        temp_files << t_file

        view.write_image({
          :filename => t_file,
          :width => face_size,
          :height => face_size,
          :antialias => true,
          :compression => 0.94
        })

        if File.exist?(t_file)
          bytes = File.binread(t_file)
          encoded_faces[face_name] = "data:image/jpeg;base64,#{Base64.strict_encode64(bytes)}"
        end
      end

      require 'json'
      json_payload = { :faces => encoded_faces }.to_json
      js = "window.dispatchEvent(new CustomEvent('skp-360-cubemap-ready', { detail: #{json_payload} }));"

      if @dialog && @dialog.visible?
        @dialog.execute_script(js)
      end
      if @panorama_dialog && @panorama_dialog.visible?
        @panorama_dialog.execute_script(js) rescue nil
      end
      Sketchup.status_text = "SKP Render Pro IA: 6 faces 360° capturadas com sucesso e costuradas!"
    rescue => e
      puts "Erro ao exportar cubemap 360: #{e.message}"
    ensure
      # Restaura overlays
      if defined?(Sketchup::Overlay) && model && model.respond_to?(:overlays)
        saved_overlays_state.each do |ov, state|
          ov.enabled = state rescue nil
        end
      end
      # Restaura iluminação e sombreamento original
      if model && model.shadow_info
        model.shadow_info["UseSunForAllShading"] = saved_sun_shading unless saved_sun_shading.nil?
        model.shadow_info["Dark"] = saved_dark unless saved_dark.nil?
      end
      # Restaura rigorosamente a câmera original
      if camera && saved_eye && saved_target && saved_up
        camera.perspective = saved_perspective rescue nil
        camera.aspect_ratio = saved_aspect rescue nil
        camera.set(saved_eye, saved_target, saved_up) rescue nil
        if camera.respond_to?(:fov=)
          camera.fov = saved_fov rescue nil
        end
      end
      temp_files.each { |f| File.delete(f) rescue nil } if temp_files
    end

    def ensure_overlay_for_model(model = Sketchup.active_model)
      return nil unless model && defined?(Sketchup::Overlay) && model.respond_to?(:overlays)
      target_id = "skp_render_pro.safe_frame_overlay"
      
      existing = nil
      begin
        model.overlays.each do |ov|
          if (ov.respond_to?(:overlay_id) && ov.overlay_id == target_id) || (ov.respond_to?(:id) && ov.id == target_id)
            existing = ov
            break
          end
        end
      rescue => _
      end

      return existing if existing

      new_overlay = SafeFrameOverlay.new
      begin
        model.overlays.add(new_overlay)
      rescue => err
        puts "[SKP Render Pro] Falha ao registrar overlay: #{err.message}"
      end
      new_overlay
    rescue => e
      puts "[SKP Render Pro] Erro no ensure_overlay_for_model: #{e.message}"
      nil
    end

    def disable_viewport_overlay(model = Sketchup.active_model)
      return unless model
      @current_safe_frame = false
      @current_rule_of_thirds = false

      # 1. Reseta a câmera ativa do SketchUp (remove imediatamente as tarjas/letterbox)
      view = model.active_view
      if view && view.camera && view.camera.respond_to?(:aspect_ratio=)
        view.camera.aspect_ratio = 0.0
      end

      # 2. Desativa todos os overlays do modelo
      if defined?(Sketchup::Overlay) && model.respond_to?(:overlays)
        begin
          target_id = "skp_render_pro.safe_frame_overlay"
          model.overlays.each do |ov|
            if (ov.respond_to?(:overlay_id) && ov.overlay_id == target_id) || (ov.respond_to?(:id) && ov.id == target_id)
              ov.update_settings(0.8, false, false) if ov.respond_to?(:update_settings)
              ov.enabled = false rescue nil
            end
          end
        rescue => _
        end
      end

      # 3. Cancela ferramenta de desenho legada (para SketchUp < 2023)
      if @overlay_tool && model.tools.active_tool == @overlay_tool
        model.select_tool(nil)
      end

      # 4. Redesenha a tela do SketchUp limpa
      view.invalidate if view
    rescue => e
      puts "[SKP Render Pro] Erro ao desativar moldura: #{e.message}"
    end

    def toggle_viewport_overlay(ratio, width = nil, height = nil, safe_frame = true, rule_of_thirds = false)
      model = Sketchup.active_model
      return unless model

      is_safe = (safe_frame == true || safe_frame.to_s.strip.downcase == 'true' || safe_frame.to_s == '1')
      is_thirds = (rule_of_thirds == true || rule_of_thirds.to_s.strip.downcase == 'true' || rule_of_thirds.to_s == '1')

      # Se o usuário desativou a moldura no botão: desliga e limpa a tela instantaneamente
      unless is_safe || is_thirds
        disable_viewport_overlay(model)
        return
      end

      w_val = width.to_f
      h_val = height.to_f
      r = (w_val > 0 && h_val > 0) ? (w_val / h_val) : (ratio.to_f > 0 ? ratio.to_f : 0.8)

      @current_ratio = r
      @current_safe_frame = is_safe
      @current_rule_of_thirds = is_thirds

      view = model.active_view
      camera = view ? view.camera : nil

      # 1. Ajuste nativo da Câmera (Letterbox/Pillarbox nativo):
      if camera && camera.respond_to?(:aspect_ratio=)
        camera.aspect_ratio = r
      end

      # 2. SketchUp 2023+ (Sketchup::Overlay):
      if defined?(Sketchup::Overlay) && model.respond_to?(:overlays)
        overlay = ensure_overlay_for_model(model)
        if overlay
          overlay.update_settings(r, is_safe, is_thirds)
          begin
            overlay.enabled = true
          rescue => _
          end
        end
      else
        # Fallback para versões mais antigas do SketchUp (< 2023):
        @overlay_tool ||= ViewportOverlayTool.new
        @overlay_tool.update_settings(r, is_safe, is_thirds)
        if model.tools.active_tool.nil? || model.tools.active_tool == @overlay_tool
          model.select_tool(@overlay_tool)
        end
      end

      view.invalidate if view
    rescue => e
      puts "Erro no toggle_viewport_overlay: #{e.message}"
    end
  end

  if defined?(Sketchup::Overlay)
    class SafeFrameOverlay < Sketchup::Overlay
      attr_accessor :ratio, :safe_frame, :rule_of_thirds

      def initialize
        super("skp_render_pro.safe_frame_overlay", "SKP Render Pro IA - Moldura")
        @ratio = 0.8
        @safe_frame = true
        @rule_of_thirds = false
      end

      def update_settings(ratio, safe_frame, rule_of_thirds)
        @ratio = ratio.to_f > 0 ? ratio.to_f : 0.8
        @safe_frame = safe_frame
        @rule_of_thirds = rule_of_thirds
        begin
          self.enabled = (@safe_frame || @rule_of_thirds)
        rescue => _
        end
        Sketchup.active_model.active_view.invalidate if Sketchup.active_model && Sketchup.active_model.active_view
      end

      def draw(view)
        return unless @safe_frame || @rule_of_thirds
        w = view.vpwidth.to_f
        h = view.vpheight.to_f
        return if w <= 0 || h <= 0

        view_ratio = w / h
        if view_ratio > @ratio
          box_h = h
          box_w = h * @ratio
        else
          box_w = w
          box_h = w / @ratio
        end

        x0 = (w - box_w) / 2.0
        y0 = (h - box_h) / 2.0
        x1 = x0 + box_w
        y1 = y0 + box_h

        if @safe_frame
          # Máscara escura translúcida fora da área de enquadramento
          view.drawing_color = Sketchup::Color.new(0, 0, 0, 140)
          if y0 > 0
            view.draw2d(GL_QUADS, [
              Geom::Point3d.new(0, 0, 0), Geom::Point3d.new(w, 0, 0),
              Geom::Point3d.new(w, y0, 0), Geom::Point3d.new(0, y0, 0)
            ])
          end
          if y1 < h
            view.draw2d(GL_QUADS, [
              Geom::Point3d.new(0, y1, 0), Geom::Point3d.new(w, y1, 0),
              Geom::Point3d.new(w, h, 0), Geom::Point3d.new(0, h, 0)
            ])
          end
          if x0 > 0
            view.draw2d(GL_QUADS, [
              Geom::Point3d.new(0, y0, 0), Geom::Point3d.new(x0, y0, 0),
              Geom::Point3d.new(x0, y1, 0), Geom::Point3d.new(0, y1, 0)
            ])
          end
          if x1 < w
            view.draw2d(GL_QUADS, [
              Geom::Point3d.new(x1, y0, 0), Geom::Point3d.new(w, y0, 0),
              Geom::Point3d.new(w, y1, 0), Geom::Point3d.new(x1, y1, 0)
            ])
          end

          # Borda nítida de enquadramento verde esmeralda
          view.drawing_color = Sketchup::Color.new(74, 222, 128, 255)
          view.line_width = 2
          view.draw2d(GL_LINE_LOOP, [
            Geom::Point3d.new(x0, y0, 0), Geom::Point3d.new(x1, y0, 0),
            Geom::Point3d.new(x1, y1, 0), Geom::Point3d.new(x0, y1, 0)
          ])

          # Cantoneiras reforçadas nos 4 cantos para visual profissional de visor de câmera
          c_len = [box_w * 0.05, box_h * 0.05, 22.0].min
          view.line_width = 4
          # Canto Superior Esquerdo
          view.draw2d(GL_LINES, [
            Geom::Point3d.new(x0, y0, 0), Geom::Point3d.new(x0 + c_len, y0, 0),
            Geom::Point3d.new(x0, y0, 0), Geom::Point3d.new(x0, y0 + c_len, 0)
          ])
          # Canto Superior Direito
          view.draw2d(GL_LINES, [
            Geom::Point3d.new(x1, y0, 0), Geom::Point3d.new(x1 - c_len, y0, 0),
            Geom::Point3d.new(x1, y0, 0), Geom::Point3d.new(x1, y0 + c_len, 0)
          ])
          # Canto Inferior Esquerdo
          view.draw2d(GL_LINES, [
            Geom::Point3d.new(x0, y1, 0), Geom::Point3d.new(x0 + c_len, y1, 0),
            Geom::Point3d.new(x0, y1, 0), Geom::Point3d.new(x0, y1 - c_len, 0)
          ])
          # Canto Inferior Direito
          view.draw2d(GL_LINES, [
            Geom::Point3d.new(x1, y1, 0), Geom::Point3d.new(x1 - c_len, y1, 0),
            Geom::Point3d.new(x1, y1, 0), Geom::Point3d.new(x1, y1 - c_len, 0)
          ])

          # Texto informativo sutil no canto da moldura
          begin
            ratio_label = sprintf('%.2f', @ratio)
            view.draw_text(
              Geom::Point3d.new(x0 + 8, y0 + 16, 0),
              "SKP RENDER PRO [#{ratio_label}]",
              { color: Sketchup::Color.new(74, 222, 128, 220), size: 10 }
            )
          rescue => _
          end
        end

        if @rule_of_thirds
          view.drawing_color = Sketchup::Color.new(74, 222, 128, 160)
          view.line_width = 1

          x_third1 = x0 + box_w * (1.0 / 3.0)
          x_third2 = x0 + box_w * (2.0 / 3.0)
          view.draw2d(GL_LINES, [
            Geom::Point3d.new(x_third1, y0, 0), Geom::Point3d.new(x_third1, y1, 0),
            Geom::Point3d.new(x_third2, y0, 0), Geom::Point3d.new(x_third2, y1, 0)
          ])

          y_third1 = y0 + box_h * (1.0 / 3.0)
          y_third2 = y0 + box_h * (2.0 / 3.0)
          view.draw2d(GL_LINES, [
            Geom::Point3d.new(x0, y_third1, 0), Geom::Point3d.new(x1, y_third1, 0),
            Geom::Point3d.new(x0, y_third2, 0), Geom::Point3d.new(x1, y_third2, 0)
          ])
        end
      end
    end
  end

  class ViewportOverlayTool
    attr_accessor :ratio, :safe_frame, :rule_of_thirds

    def initialize
      @ratio = 0.8
      @safe_frame = false
      @rule_of_thirds = false
    end

    def update_settings(ratio, safe_frame, rule_of_thirds)
      @ratio = ratio.to_f > 0 ? ratio.to_f : 0.8
      @safe_frame = safe_frame
      @rule_of_thirds = rule_of_thirds
      Sketchup.active_model.active_view.invalidate
    end

    def draw(view)
      w = view.vpwidth.to_f
      h = view.vpheight.to_f
      return if w <= 0 || h <= 0

      view_ratio = w / h
      if view_ratio > @ratio
        box_h = h
        box_w = h * @ratio
      else
        box_w = w
        box_h = w / @ratio
      end

      x0 = (w - box_w) / 2.0
      y0 = (h - box_h) / 2.0
      x1 = x0 + box_w
      y1 = y0 + box_h

      if @safe_frame
        view.drawing_color = Sketchup::Color.new(74, 222, 128, 102)
        view.draw2d(GL_QUADS, [
          Geom::Point3d.new(0, 0, 0), Geom::Point3d.new(w, 0, 0),
          Geom::Point3d.new(w, y0, 0), Geom::Point3d.new(0, y0, 0)
        ])
        view.draw2d(GL_QUADS, [
          Geom::Point3d.new(0, y1, 0), Geom::Point3d.new(w, y1, 0),
          Geom::Point3d.new(w, h, 0), Geom::Point3d.new(0, h, 0)
        ])
        view.draw2d(GL_QUADS, [
          Geom::Point3d.new(0, y0, 0), Geom::Point3d.new(x0, y0, 0),
          Geom::Point3d.new(x0, y1, 0), Geom::Point3d.new(0, y1, 0)
        ])
        view.draw2d(GL_QUADS, [
          Geom::Point3d.new(x1, y0, 0), Geom::Point3d.new(w, y0, 0),
          Geom::Point3d.new(w, y1, 0), Geom::Point3d.new(x1, y1, 0)
        ])

        view.drawing_color = Sketchup::Color.new(74, 222, 128, 255)
        view.line_width = 2
        view.draw2d(GL_LINE_LOOP, [
          Geom::Point3d.new(x0, y0, 0), Geom::Point3d.new(x1, y0, 0),
          Geom::Point3d.new(x1, y1, 0), Geom::Point3d.new(x0, y1, 0)
        ])
      end

      if @rule_of_thirds
        view.drawing_color = Sketchup::Color.new(74, 222, 128, 160)
        view.line_width = 1

        x_third1 = x0 + box_w * (1.0 / 3.0)
        x_third2 = x0 + box_w * (2.0 / 3.0)
        view.draw2d(GL_LINES, [
          Geom::Point3d.new(x_third1, y0, 0), Geom::Point3d.new(x_third1, y1, 0),
          Geom::Point3d.new(x_third2, y0, 0), Geom::Point3d.new(x_third2, y1, 0)
        ])

        y_third1 = y0 + box_h * (1.0 / 3.0)
        y_third2 = y0 + box_h * (2.0 / 3.0)
        view.draw2d(GL_LINES, [
          Geom::Point3d.new(x0, y_third1, 0), Geom::Point3d.new(x1, y_third1, 0),
          Geom::Point3d.new(x0, y_third2, 0), Geom::Point3d.new(x1, y_third2, 0)
        ])
      end
    end

    def onCancel(_reason, view)
      view.invalidate
    end
  end

  class Panorama360PickerTool
    def initialize(mode = 'wall', eye_height = 1.60)
      @mode = mode # 'wall' ou 'observer'
      @eye_height = eye_height
      @cursor_point = nil
      @ip = Sketchup::InputPoint.new
    end

    def activate
      msg = @mode == 'wall' ? "360°: Clique em uma parede para ser a frente do panorama." : "360°: Clique no piso para posicionar o observador."
      Sketchup.status_text = msg
    end

    def onMouseMove(flags, x, y, view)
      @ip.pick(view, x, y)
      if @ip.valid?
        @cursor_point = @ip.position
        view.invalidate
      end
    end

    def onLButtonDown(flags, x, y, view)
      @ip.pick(view, x, y)
      return unless @ip.valid?
      pt = @ip.position

      if @mode == 'wall'
        SKPRenderPro.panorama_front_point = pt
        js = "window.dispatchEvent(new CustomEvent('skp-360-ponto-definido', { detail: { type: 'wall' } }));"
        if SKPRenderPro.dialog && SKPRenderPro.dialog.visible?
          SKPRenderPro.dialog.execute_script(js)
        end
        if SKPRenderPro.panorama_dialog && SKPRenderPro.panorama_dialog.visible?
          SKPRenderPro.panorama_dialog.execute_script(js) rescue nil
        end
        Sketchup.status_text = "360°: Parede de frente definida!"
      else
        SKPRenderPro.panorama_obs_point = pt
        js = "window.dispatchEvent(new CustomEvent('skp-360-ponto-definido', { detail: { type: 'observer' } }));"
        if SKPRenderPro.dialog && SKPRenderPro.dialog.visible?
          SKPRenderPro.dialog.execute_script(js)
        end
        if SKPRenderPro.panorama_dialog && SKPRenderPro.panorama_dialog.visible?
          SKPRenderPro.panorama_dialog.execute_script(js) rescue nil
        end
        Sketchup.status_text = "360°: Observador posicionado no piso!"
      end

      # Retorna para ferramenta de seleção após o clique
      Sketchup.active_model.select_tool(nil)
    end

    def draw(view)
      return unless @cursor_point

      if @mode == 'observer'
        # Desenha círculo azul no chão no ponto do cursor
        radius = 0.45.m
        segments = 32
        circle_pts = []
        (0...segments).each do |i|
          angle = 2.0 * Math::PI * i / segments
          circle_pts << Geom::Point3d.new(
            @cursor_point.x + radius * Math.cos(angle),
            @cursor_point.y + radius * Math.sin(angle),
            @cursor_point.z + 0.02.m
          )
        end
        view.drawing_color = Sketchup::Color.new(57, 98, 82, 230)
        view.line_width = 3
        view.draw(GL_LINE_LOOP, circle_pts)

        # Se já tiver parede frontal selecionada, traça linha conectando ao ponto frontal
        front_pt = SKPRenderPro.panorama_front_point
        if front_pt
          view.drawing_color = Sketchup::Color.new(74, 222, 128, 255)
          view.line_width = 2
          view.draw(GL_LINES, [@cursor_point, front_pt])
        end
      else
        # Modo parede: desenha mirante de precisão no ponto
        view.drawing_color = Sketchup::Color.new(245, 158, 11, 255)
        view.line_width = 2
        p1 = Geom::Point3d.new(@cursor_point.x - 0.25.m, @cursor_point.y, @cursor_point.z)
        p2 = Geom::Point3d.new(@cursor_point.x + 0.25.m, @cursor_point.y, @cursor_point.z)
        p3 = Geom::Point3d.new(@cursor_point.x, @cursor_point.y - 0.25.m, @cursor_point.z)
        p4 = Geom::Point3d.new(@cursor_point.x, @cursor_point.y + 0.25.m, @cursor_point.z)
        view.draw(GL_LINES, [p1, p2, p3, p4])
      end
    end

    def onCancel(_reason, view)
      view.invalidate
    end
  end

  # ==============================================================================
  # FERRAMENTA INTERATIVA DE MOUSE: RECONHECIMENTO DE FACES EM VERDE ESMERALDA
  # ==============================================================================
  # Quando o usuário passa o mouse na cena, a face sob o cursor ACENDE NO VERDE DO PLUGIN
  # Ao clicar, projeta o reflexo físico exato da câmera naquela face.
  # Pressionar ESC cancela a ferramenta.
  class SurfaceReflectTool
    def initialize(config_json = "{}")
      @config_json = config_json
      @ph = nil
      @hover_face = nil
      @hover_tr = Geom::Transformation.new
      @cursor_pt = nil
      @ip = Sketchup::InputPoint.new

      # Cores do plugin SKP Render Pro (Verde Esmeralda #10b981)
      # Borda sólida verde viva: RGB(16, 185, 129, 255)
      # Preenchimento translúcido verde elegante: RGB(16, 185, 129, 115)
      @border_color = Sketchup::Color.new(16, 185, 129, 255)
      @fill_color   = Sketchup::Color.new(16, 185, 129, 115)
    end

    def activate
      Sketchup.status_text = "SKP Render Pro: Passe o mouse para iluminar a face em verde e CLIQUE para gerar o reflexo. (ESC para sair)"
    end

    def deactivate(view)
      @hover_face = nil
      @hover_tr = Geom::Transformation.new
      view.invalidate if view
    end

    def onMouseMove(flags, x, y, view)
      # Só processa se esta ferramenta for a ferramenta ativa
      return unless Sketchup.active_model && Sketchup.active_model.tools.active_tool == self

      @ph = view.pick_helper
      @ph.do_pick(x, y)
      
      picked_face = nil
      picked_tr = Geom::Transformation.new

      # Varre o caminho de picking para encontrar Face (direta ou dentro de grupo/componente)
      (0...@ph.count).each do |idx|
        leaf = @ph.leaf_at(idx)
        if leaf.is_a?(Sketchup::Face)
          picked_face = leaf
          picked_tr = @ph.transformation_at(idx)
          break
        end
      end

      # Fallback usando best_picked
      if !picked_face
        elem = @ph.best_picked
        if elem.is_a?(Sketchup::Face)
          picked_face = elem
        elsif elem.is_a?(Sketchup::Group) || elem.is_a?(Sketchup::ComponentInstance)
          picked_tr = elem.transformation
          sub_faces = elem.definition.entities.grep(Sketchup::Face)
          picked_face = sub_faces.find { |f| f.material && f.material.name =~ /espelho|mirror|reflex|vidro|glass|tv/i } || sub_faces.max_by(&:area)
        end
      end

      if picked_face != @hover_face
        @hover_face = picked_face
        @hover_tr = picked_tr
        view.invalidate
      end
    end

    def onLButtonDown(flags, x, y, view)
      return unless @hover_face && @hover_face.valid?

      face_to_reflect = @hover_face
      tr_to_reflect   = @hover_tr

      # 1. LIMPA IMEDIATAMENTE A MOLDURA VERDE DE MARCAÇÃO
      @hover_face = nil
      @hover_tr   = Geom::Transformation.new

      # 2. Desativa esta ferramenta antes de gerar qualquer elemento
      shift_held = (flags & MK_SHIFT) != 0 rescue false
      model = Sketchup.active_model
      model.select_tool(nil) if model && !shift_held

      # 3. Limpa seleções ativas para não aparecer nenhuma moldura ou pontilhado azul na tela
      model.selection.clear if model

      # 4. Redesenha a tela imediatamente para que a moldura verde suma da visualização
      view.invalidate if view
      view.refresh if view

      # 5. Gera o reflexo na face agora com a tela 100% limpa (sem moldura e sem seleção)
      SKPRenderPro.gerar_espelho_real(false, face_to_reflect, tr_to_reflect, @config_json)

      # 6. Garante limpeza final de seleção e redesenho
      model.selection.clear if model
      view.invalidate if view
    end

    # Tecla ESC sai da ferramenta
    def onKeyDown(key, repeat, flags, view)
      if key == 27 # ESC
        @hover_face = nil
        @hover_tr   = Geom::Transformation.new
        view.invalidate if view
        Sketchup.active_model.select_tool(nil)
        Sketchup.status_text = "SKP Render Pro: Seleção de reflexo cancelada."
      end
    end

    # Desenha o acendimento em verde esmeralda na face
    def draw(view)
      # Só desenha se a ferramenta estiver realmente ativa
      return unless Sketchup.active_model && Sketchup.active_model.tools.active_tool == self
      return unless @hover_face && @hover_face.valid?

      # Vértices da face em coordenadas globais
      outer_loop = @hover_face.outer_loop
      return unless outer_loop

      pts = outer_loop.vertices.map { |v| v.position.transform(@hover_tr) }
      return if pts.size < 3

      # 1. Preenchimento verde esmeralda translúcido
      view.drawing_color = @fill_color
      
      # SketchUp draw_polygon / draw com triangulação segura de polígonos convexos ou côncavos
      mesh = @hover_face.mesh
      if mesh && mesh.count_polygons > 0
        (1..mesh.count_polygons).each do |poly_idx|
          poly_pts = mesh.polygon_points_at(poly_idx).map { |p| p.transform(@hover_tr) }
          view.draw(GL_POLYGON, poly_pts) if poly_pts.size >= 3
        end
      else
        view.draw(GL_POLYGON, pts)
      end

      # 2. Contorno nítido de realce verde esmeralda
      view.drawing_color = @border_color
      view.line_width = 3
      view.draw(GL_LINE_LOOP, pts)

      # 3. Desenha também os loops internos (furos) se houver
      @hover_face.loops.each do |loop_item|
        next if loop_item == outer_loop
        inner_pts = loop_item.vertices.map { |v| v.position.transform(@hover_tr) }
        view.draw(GL_LINE_LOOP, inner_pts) if inner_pts.size >= 3
      end
    end

    def onCancel(_reason, view)
      @hover_face = nil
      view.invalidate if view
    end
  end

  # ==============================================================================
  # FERRAMENTA DE ILUMINAÇÃO FAKE INTERATIVA (SPOTS E FITAS DE LED)
  # ==============================================================================
  class FakeLightTool
    def initialize(config_json = "{}")
      @config_json = config_json
      @config = {}
      begin
        require 'json'
        @config = JSON.parse(config_json.to_s)
      rescue => _
        @config = {}
      end

      @mode = (@config["light_type"] || @config[:light_type] || "fita_led").to_s
      @obj_type = (@config["object_type"] || @config[:object_type] || "marcenaria").to_s
      @color_hex = (@config["color"] || @config[:color] || "#ffe7ae").to_s

      @ph = nil
      @hover_entity = nil
      @hover_tr = Geom::Transformation.new
      @accumulated_edges = []

      # Cores verde esmeralda no viewport (Padrão SKP Render Pro)
      @border_green = Sketchup::Color.new(16, 185, 129, 255)
      @fill_green   = Sketchup::Color.new(52, 211, 153, 130)
    end

    def activate
      if @mode == "spot" || @mode == "plafon"
        Sketchup.status_text = "Luz Fake (#{@mode.capitalize}): Clique na face da luminária no teto (o cone desce dela). ESC para sair."
      elsif @obj_type == "espelho"
        Sketchup.status_text = "Luz Fake (Fita Espelho): Clique na face do espelho para contornar a borda. ESC para sair."
      else
        Sketchup.status_text = "Luz Fake (Fita Marcenaria): Clique na linha. Segure Shift para somar várias linhas e pressione Enter. ESC para sair."
      end
    end

    def deactivate(view)
      @hover_entity = nil
      @accumulated_edges.clear
      view.invalidate if view
    end

    def onMouseMove(flags, x, y, view)
      @ph = view.pick_helper
      @ph.do_pick(x, y)

      picked_ent = nil
      picked_tr = Geom::Transformation.new

      if @mode == "fita_led" && @obj_type == "marcenaria"
        (0...@ph.count).each do |idx|
          leaf = @ph.leaf_at(idx)
          if leaf.is_a?(Sketchup::Edge)
            picked_ent = leaf
            picked_tr = @ph.transformation_at(idx)
            break
          end
        end
        if !picked_ent
          (0...@ph.count).each do |idx|
            leaf = @ph.leaf_at(idx)
            if leaf.is_a?(Sketchup::Face)
              picked_ent = leaf
              picked_tr = @ph.transformation_at(idx)
              break
            end
          end
        end
      else
        (0...@ph.count).each do |idx|
          leaf = @ph.leaf_at(idx)
          if leaf.is_a?(Sketchup::Face)
            picked_ent = leaf
            picked_tr = @ph.transformation_at(idx)
            break
          end
        end
      end

      if !picked_ent
        elem = @ph.best_picked
        if elem.is_a?(Sketchup::Face) || elem.is_a?(Sketchup::Edge)
          picked_ent = elem
        elsif elem.is_a?(Sketchup::Group) || elem.is_a?(Sketchup::ComponentInstance)
          picked_tr = elem.transformation
          picked_ent = elem.definition.entities.grep(Sketchup::Face).first
        end
      end

      if picked_ent != @hover_entity
        @hover_entity = picked_ent
        @hover_tr = picked_tr
        view.invalidate
      end
    end

    def onLButtonDown(flags, x, y, view)
      shift_held = (flags & MK_SHIFT) != 0 rescue false

      if @hover_entity && @hover_entity.valid?
        target_ent = @hover_entity
        target_tr  = @hover_tr

        # Limpa imediatamente o hover para a moldura sumir
        @hover_entity = nil unless shift_held
        model = Sketchup.active_model
        model.selection.clear if model

        if (@mode == "spot" || @mode == "plafon") && target_ent.is_a?(Sketchup::Face)
          SKPRenderPro.gerar_spot_fake_na_face(target_ent, target_tr, @config)
          view.invalidate
          Sketchup.active_model.select_tool(nil) unless shift_held
        elsif @mode == "fita_led" && @obj_type == "espelho" && target_ent.is_a?(Sketchup::Face)
          SKPRenderPro.gerar_fita_led_espelho(target_ent, target_tr, @config)
          view.invalidate
          Sketchup.active_model.select_tool(nil) unless shift_held
        elsif @mode == "fita_led" && @obj_type == "marcenaria"
          edge_pts = []
          if target_ent.is_a?(Sketchup::Edge)
            edge_pts = [target_ent.start.position.transform(target_tr), target_ent.end.position.transform(target_tr)]
          elsif target_ent.is_a?(Sketchup::Face)
            target_ent.outer_loop.edges.each do |e|
              @accumulated_edges << [e.start.position.transform(target_tr), e.end.position.transform(target_tr)]
            end
          end

          if edge_pts.size == 2
            @accumulated_edges << edge_pts
          end

          if shift_held
            Sketchup.status_text = "Linha somada (#{@accumulated_edges.size} linhas). Clique em mais linhas ou aperte ENTER para gerar."
            view.invalidate
          else
            SKPRenderPro.gerar_fita_led_marcenaria(@accumulated_edges, @config)
            @accumulated_edges.clear
            view.invalidate
            Sketchup.active_model.select_tool(nil)
          end
        end

        model.selection.clear if model
        view.invalidate if view
      end
    end

    def onKeyDown(key, repeat, flags, view)
      if key == 27 # ESC
        @accumulated_edges.clear
        Sketchup.active_model.select_tool(nil)
        Sketchup.status_text = "SKP Render Pro: Seleção de luz fake cancelada."
      elsif key == 13 # ENTER
        if @mode == "fita_led" && @obj_type == "marcenaria" && !@accumulated_edges.empty?
          SKPRenderPro.gerar_fita_led_marcenaria(@accumulated_edges, @config)
          @accumulated_edges.clear
          view.invalidate
          Sketchup.active_model.select_tool(nil)
        end
      end
    end

    def draw(view)
      if !@accumulated_edges.empty?
        view.drawing_color = @border_green
        view.line_width = 4
        @accumulated_edges.each do |pts|
          view.draw(GL_LINES, pts) if pts.size == 2
        end
      end

      return unless @hover_entity && @hover_entity.valid?

      if @hover_entity.is_a?(Sketchup::Edge)
        p1 = @hover_entity.start.position.transform(@hover_tr)
        p2 = @hover_entity.end.position.transform(@hover_tr)
        view.drawing_color = @border_green
        view.line_width = 5
        view.draw(GL_LINES, [p1, p2])
      elsif @hover_entity.is_a?(Sketchup::Face)
        outer_loop = @hover_entity.outer_loop
        return unless outer_loop
        pts = outer_loop.vertices.map { |v| v.position.transform(@hover_tr) }
        return if pts.size < 3

        view.drawing_color = @fill_green
        mesh = @hover_entity.mesh
        if mesh && mesh.count_polygons > 0
          (1..mesh.count_polygons).each do |poly_idx|
            poly_pts = mesh.polygon_points_at(poly_idx).map { |p| p.transform(@hover_tr) }
            view.draw(GL_POLYGON, poly_pts) if poly_pts.size >= 3
          end
        else
          view.draw(GL_POLYGON, pts)
        end

        view.drawing_color = @border_green
        view.line_width = 3
        view.draw(GL_LINE_LOOP, pts)
      end
    end

    def onCancel(_reason, view)
      @hover_entity = nil
      @accumulated_edges.clear
      view.invalidate if view
    end
  end

  class RenderProAppObserver < Sketchup::AppObserver
    def expectsStartupModelNotifications
      true
    end

    def onNewModel(model)
      reapply(model)
    end

    def onOpenModel(model)
      reapply(model)
    end

    def onActivateModel(model)
      reapply(model)
    end

    private

    def reapply(model)
      if SKPRenderPro.dialog && SKPRenderPro.dialog.visible? && SKPRenderPro.current_safe_frame
        SKPRenderPro.toggle_viewport_overlay(
          SKPRenderPro.current_ratio || 0.8,
          nil,
          nil,
          SKPRenderPro.current_safe_frame,
          SKPRenderPro.current_rule_of_thirds || false
        )
      else
        SKPRenderPro.disable_viewport_overlay(model) rescue nil
      end
    rescue => _
    end
  end

  Sketchup.add_observer(RenderProAppObserver.new) rescue nil

  module Icons
    ICON_PNG_24_B64 = "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".freeze
    ICON_PNG_32_B64 = "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".freeze
    GEM_PNG_24_B64  = "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".freeze
    GEM_PNG_32_B64  = "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".freeze

    def self.get_icon_paths
      folder = Sketchup.temp_dir
      icon_24 = File.join(folder, "skp_render_pro_icon_24.png")
      icon_32 = File.join(folder, "skp_render_pro_icon_32.png")

      begin
        unless File.exist?(icon_24) && File.size(icon_24) > 100
          File.open(icon_24, "wb") { |f| f.write(Base64.decode64(ICON_PNG_24_B64)) }
        end
        unless File.exist?(icon_32) && File.size(icon_32) > 100
          File.open(icon_32, "wb") { |f| f.write(Base64.decode64(ICON_PNG_32_B64)) }
        end
      rescue => e
        puts "[SKP Render Pro] Erro ao gravar ícones: #{e.message}"
      end

      { small: icon_24, large: icon_32 }
    end

    def self.get_gem_icon_paths
      folder = Sketchup.temp_dir
      gem_24 = File.join(folder, "gemini_gem_icon_24.png")
      gem_32 = File.join(folder, "gemini_gem_icon_32.png")

      begin
        unless File.exist?(gem_24) && File.size(gem_24) > 100
          File.open(gem_24, "wb") { |f| f.write(Base64.decode64(GEM_PNG_24_B64)) }
        end
        unless File.exist?(gem_32) && File.size(gem_32) > 100
          File.open(gem_32, "wb") { |f| f.write(Base64.decode64(GEM_PNG_32_B64)) }
        end
      rescue => _
      end

      { small: gem_24, large: gem_32 }
    end
  end
end

# ==============================================================================
# REGISTRO NO MENU "EXTENSÕES", SUBMENU E BARRA DE FERRAMENTAS (TOOLBAR / ATALHO)
# ==============================================================================
unless defined?($skp_render_pro_ui_initialized) && $skp_render_pro_ui_initialized
  $skp_render_pro_ui_initialized = true

  # 1. Registro Limpo no Menu "Extensões" (Extensions)
  ext_menu = nil
  begin
    ext_menu = UI.menu("Extensions")
  rescue => _
  end
  ext_menu ||= (UI.menu("Plugins") rescue nil)

  if ext_menu
    # Cria Submenu Único e Limpo dentro de Extensões apenas com Abrir Painel
    submenu = ext_menu.add_submenu(SKPRenderPro::PLUGIN_NAME)

    submenu.add_item("⚡ Abrir Painel #{SKPRenderPro::PLUGIN_NAME}") do
      SKPRenderPro.open_dialog
    end
  end

  # 2. Criação da Barra de Ferramentas (Toolbar com Atalho Único do Painel SKP Render Pro)
  toolbar = UI::Toolbar.new(SKPRenderPro::PLUGIN_NAME)
  SKPRenderPro.toolbar = toolbar

  icons = SKPRenderPro::Icons.get_icon_paths

  cmd1 = UI::Command.new("Painel #{SKPRenderPro::PLUGIN_NAME}") do
    SKPRenderPro.open_dialog
  end
  cmd1.tooltip = "#{SKPRenderPro::PLUGIN_NAME} - Renderizador IA"
  cmd1.status_bar_text = "Abrir painel SKP Render Pro IA"
  cmd1.small_icon = icons[:small]
  cmd1.large_icon = icons[:large]
  toolbar.add_item(cmd1)

  # Força restauração e exibição imediata do atalho
  toolbar.restore
  toolbar.show

  # 3. Registro no Gerenciador de Extensões do SketchUp
  if defined?(SketchupExtension)
    begin
      path_ext = (defined?(__FILE__) && __FILE__ != "(eval)") ? __FILE__ : "skp_render_pro.rb"
      ext = SketchupExtension.new(SKPRenderPro::PLUGIN_NAME, path_ext)
      ext.version     = "2.1.0"
      ext.description = "Renderizador Fotorealista com Inteligência Artificial para SketchUp"
      ext.creator     = "SKP Render Pro"
      ext.copyright   = "2026"
      Sketchup.register_extension(ext, true)
    rescue => _
    end
  end

  file_loaded(__FILE__) rescue nil
  file_loaded("skp_render_pro.rb") rescue nil
end

# Inicialização concluída: O diálogo só é aberto quando o usuário clicar no botão de atalho ou menu
puts "[SKP Render Pro] Plugin carregado com sucesso. Use a barra de ferramentas ou menu Extensões para abrir o painel."

#-------------------------------------------------------------------------------
# Real Mirror Generator for SketchUp (Compatibilidade Direta com o Código Original)
# Descrição: Gera textura de reflexão física em espelhos com corte automático
#-------------------------------------------------------------------------------
module RealMirrorGenerator
  def self.generate
    SKPRenderPro.gerar_espelho_real
  end

  unless file_loaded?("real_mirror_generator_menu")
    # Adiciona ao menu Extensões / Plugins
    plugins_menu = UI.menu('Plugins') || UI.menu('Extensions')
    if plugins_menu
      plugins_menu.add_item("Gerar Espelho Realista") { RealMirrorGenerator.generate }
    end

    # Adiciona ao menu de contexto (Botão direito do mouse)
    UI.add_context_menu_handler do |menu|
      selection = Sketchup.active_model.selection rescue nil
      if selection && !selection.empty?
        menu.add_separator
        menu.add_item("Gerar Reflexão do Espelho") { RealMirrorGenerator.generate }
      end
    end

    file_loaded("real_mirror_generator_menu")
  end
end

