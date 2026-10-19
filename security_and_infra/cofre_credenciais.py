#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cofre de Credenciais - Sistema de Criptografia Autenticada (AES / Fernet + PBKDF2 HMAC-SHA256)
Permite criptografar e descriptografar de forma segura arquivos de credenciais sensíveis.
"""

import os
import sys
import base64
import getpass
from pathlib import Path

try:
    from cryptography.fernet import Fernet, InvalidToken
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
except ImportError:
    print("❌ Biblioteca 'cryptography' não encontrada. Instalando ou verifique seu ambiente Python.")
    sys.exit(1)

DEFAULT_PLAINTEXT = Path("credentials.env")
DEFAULT_ENCRYPTED = Path("credentials.enc")
MAGIC_HEADER = b"COFREV1:"
SALT_SIZE = 16
ITERATIONS = 480000

def derive_key(password: str, salt: bytes) -> bytes:
    """Deriva uma chave criptográfica forte de 256 bits a partir da senha e salt."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=ITERATIONS,
    )
    return base64.urlsafe_b64encode(kdf.derive(password.encode("utf-8")))

def encrypt_file(plaintext_path: Path, encrypted_path: Path):
    if not plaintext_path.exists():
        print(f"❌ Arquivo original não encontrado: {plaintext_path}")
        return False

    print(f"\n🔒 Criptografando: {plaintext_path}")
    pwd = getpass.getpass("Digite uma senha forte para criptografar: ")
    if not pwd:
        print("❌ A senha não pode estar vazia.")
        return False

    pwd_confirm = getpass.getpass("Confirme a senha: ")
    if pwd != pwd_confirm:
        print("❌ As senhas não coincidem. Operação cancelada.")
        return False

    salt = os.urandom(SALT_SIZE)
    key = derive_key(pwd, salt)
    fernet = Fernet(key)

    data = plaintext_path.read_bytes()
    encrypted_data = fernet.encrypt(data)

    # Formato final no arquivo: MAGIC_HEADER + salt (16 bytes) + dados_criptografados
    encrypted_path.write_bytes(MAGIC_HEADER + salt + encrypted_data)
    print(f"✅ Arquivo criptografado gerado com sucesso: {encrypted_path}")

    resp = input(f"\nDeseja APAGAR o arquivo original em texto puro ({plaintext_path}) por segurança? [S/n]: ").strip().lower()
    if resp in ("s", "sim", ""):
        plaintext_path.unlink()
        print(f"🗑️ Arquivo original ({plaintext_path}) removido. Guarde sua senha com segurança!")
    else:
        print("⚠️ Arquivo original mantido no disco.")
    return True

def decrypt_file(encrypted_path: Path, plaintext_path: Path):
    if not encrypted_path.exists():
        print(f"❌ Arquivo criptografado não encontrado: {encrypted_path}")
        return False

    raw_content = encrypted_path.read_bytes()
    if not raw_content.startswith(MAGIC_HEADER) or len(raw_content) < len(MAGIC_HEADER) + SALT_SIZE:
        print("❌ Formato de arquivo criptografado inválido ou desconhecido.")
        return False

    payload = raw_content[len(MAGIC_HEADER):]
    salt = payload[:SALT_SIZE]
    ciphertext = payload[SALT_SIZE:]

    print(f"\n🔓 Descriptografando: {encrypted_path}")
    pwd = getpass.getpass("Digite a senha do cofre: ")

    key = derive_key(pwd, salt)
    fernet = Fernet(key)

    try:
        decrypted_data = fernet.decrypt(ciphertext)
    except InvalidToken:
        print("\n❌ Acesso negado: Senha incorreta ou dados corrompidos!")
        return False

    print("\n✅ Descriptografia realizada com sucesso!")
    print("---------------------------------------------------")
    print("Escolha como deseja visualizar/utilizar as credenciais:")
    print("[1] Exibir no terminal agora (Sem salvar em texto puro no disco - Mais seguro)")
    print("[2] Restaurar o arquivo original (.md) no disco")
    escolha = input("Opção [1/2]: ").strip()

    if escolha == "2":
        plaintext_path.write_bytes(decrypted_data)
        print(f"📄 Arquivo restaurado com sucesso: {plaintext_path}")
    else:
        print("\n================= CONTEÚDO DO ARQUIVO =================")
        print(decrypted_data.decode("utf-8", errors="replace"))
        print("=======================================================")
    return True

def main():
    print("===================================================")
    print("🔒 COFRE DE CREDENCIAIS - SERVIDOR ITÁLIA 🔒")
    print("===================================================")

    if len(sys.argv) > 1:
        action = sys.argv[1].lower()
        if action in ("enc", "criptografar"):
            encrypt_file(DEFAULT_PLAINTEXT, DEFAULT_ENCRYPTED)
            return
        elif action in ("dec", "descriptografar", "ler"):
            decrypt_file(DEFAULT_ENCRYPTED, DEFAULT_PLAINTEXT)
            return

    print("[1] Criptografar arquivo de credenciais (.md -> .enc)")
    print("[2] Descriptografar / Visualizar credenciais (.enc)")
    print("[0] Sair")
    opc = input("\nEscolha uma opção: ").strip()

    if opc == "1":
        encrypt_file(DEFAULT_PLAINTEXT, DEFAULT_ENCRYPTED)
    elif opc == "2":
        decrypt_file(DEFAULT_ENCRYPTED, DEFAULT_PLAINTEXT)
    elif opc == "0":
        print("Saindo...")
    else:
        print("Opção inválida.")

if __name__ == "__main__":
    main()
