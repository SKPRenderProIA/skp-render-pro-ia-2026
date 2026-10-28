# ==============================================================================
# GERADOR DE LICENÇAS - SKP RENDER PRO IA
# Script em Ruby para o Administrador / Desenvolvedor Gerar Licenças para Clientes
# ==============================================================================
#
# COMO USAR:
# 1) Via Terminal / Prompt de Comando:
#      ruby gerador_licenca.rb "UUID-DO-PC-DO-CLIENTE" "2027-12-31 18:00:00"
#      (Suporta data pura "AAAA-MM-DD" ou com hora "AAAA-MM-DD HH:MM:SS" ou "AAAA-MM-DDTHH:MM")
#
# 2) Ou apenas rode:
#      ruby gerador_licenca.rb
#    (Ele irá pedir interativamente o ID e a data/hora de validade)
#
# 3) No Console Ruby do próprio SketchUp:
#    Cole o código e chame:
#      GeradorLicencaSKP.gerar("ID-DO-PC", "2027-12-31 18:00:00")
# ==============================================================================

require 'base64'
require 'openssl'
require 'json'
require 'date'

module GeradorLicencaSKP
  # DEVE SER EXATAMENTE A MESMA CHAVE SECRETA DO ARQUIVO skp_render_pro.rb:
  CHAVE_SECRETA = "Minha_Senha_Secreta_Sketchup_2026!".freeze

  def self.gerar(id_pc, validade_str = nil)
    id_limpo = id_pc.to_s.strip
    if id_limpo.empty?
      puts "ERRO: O ID do computador não pode estar vazio!"
      return nil
    end

    # Se não informar validade, define 1 ano a partir de hoje por padrão
    validade_str = (Date.today + 365).strftime('%Y-%m-%d') if validade_str.nil? || validade_str.strip.empty?

    # Monta estrutura JSON idêntica à esperada pelo plugin
    dados_hash = {
      "id" => id_limpo,
      "validade" => validade_str.strip
    }
    dados_json = JSON.generate(dados_hash)

    # Assinatura criptográfica HMAC-SHA256
    assinatura = OpenSSL::HMAC.hexdigest('SHA256', CHAVE_SECRETA, dados_json)

    # Concatenação e codificação em Base64
    payload = "#{dados_json}|#{assinatura}"
    licenca_final = Base64.strict_encode64(payload)

    puts "\n" + "=" * 65
    puts "  CHAVE DE LICENÇA GERADA COM SUCESSO - SKP RENDER PRO IA"
    puts "=" * 65
    puts "ID DO COMPUTADOR : #{id_limpo}"
    puts "DATA DE VALIDADE : #{validade_str}"
    puts "-" * 65
    puts "LICENÇA DO CLIENTE (COPIE E ENVIE PARA ELE):"
    puts "\n#{licenca_final}\n\n"
    puts "=" * 65

    licenca_final
  end
end

# Execução direta via terminal/linha de comando
if __FILE__ == $0
  id_arg = ARGV[0]
  validade_arg = ARGV[1]

  if id_arg.nil? || id_arg.strip.empty?
    puts "=== GERADOR DE LICENÇA SKP RENDER PRO IA ==="
    print "Digite ou cole o ID do PC do cliente: "
    id_arg = STDIN.gets&.strip
    print "Digite a validade (Ex: 2026-12-31 ou 2026-12-31 18:00:00) [Pressione ENTER para 1 ano]: "
    validade_arg = STDIN.gets&.strip
    validade_arg = nil if validade_arg && validade_arg.empty?
  end

  GeradorLicencaSKP.gerar(id_arg, validade_arg)
end
